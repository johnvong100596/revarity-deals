import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR, APPROVALS_FILE } from "./paths.js";
import { claimViolations } from "./claims.js";

/**
 * Storage abstraction. All pages/API call these functions; the driver decides where data lives.
 *
 *   STORE_DRIVER=fs    (default) — reads the engine's local output + writes approvals.json.
 *                                  Laptop/VM dev + demo path.
 *   STORE_DRIVER=cloud           — Vercel Blob ONLY. queue + approvals are JSON blobs, images
 *                                  are blobs. Survives serverless' ephemeral FS, no database.
 *                                  Publish a run with `scripts/ingest.mjs`.
 *
 * All functions are async so the cloud driver can do I/O without changing callers.
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const APPROVAL_NOTE = "Approved set is marked ready. Pushing live to Meta is a human action outside this hub (D-04).";
export const QUEUE_KEY = "state/queue.json";
// Per-item draft blobs (one card per key). The render batch writes here instead of
// read-modify-writing the shared queue.json, so a concurrent writer (hourly cron
// double-down, human Create, MCP) can't clobber a draft during the ~9-min render.
export const QUEUE_ITEMS_PREFIX = "queue-items/";
export const APPROVALS_KEY = "state/approvals.json";
export const REJECT_LOG_KEY = "state/reject-log.json";
export const COMPUTE_LOG_KEY = "state/compute-log.json";
export const REMOVED_KEY = "state/removed.json";
export const MCP_LOG_KEY = "state/mcp-log.json";
const TRASH_DAYS = 30;

function shape(rec, id, hasImg, image_url, ad_url, ad_photo_url) {
  return {
    id, angle_id: rec.angle_id, variant: rec.variant, spec: rec.spec, dimensions: rec.dimensions,
    headline: rec.headline, body: rec.body, cta: rec.cta, pricing_flag: rec.pricing_flag || null,
    qa: rec.qa?.image_layer_verdict || "—", qa_reasons: rec.qa?.image_layer_reasons || [],
    qa_model: rec.qa?.qa_model || "",
    vertical: (rec.spec || "").includes("story") || (rec.spec || "").includes("vertical"),
    source: rec.source || null, created_at: rec.created_at || null,
    hasImg, image_url: image_url || null, ad_url: ad_url || null, ad_photo_url: ad_photo_url || null,
    video_url: rec.video_url || null,
    scores: rec.scores || null,
    mode: rec.mode || null, disclosure: rec.disclosure || null, script: rec.script || null,
    // money-arc render-batch extras (Phase-1b): second placement, carousel sets, QC-gate data
    video_url_feed: rec.video_url_feed || null,
    carousel_ig: rec.carousel_ig || null, carousel_tt: rec.carousel_tt || null,
    qc: rec.qc_gates || rec.qc || null, caption: rec.caption || null, disclaimer: rec.disclaimer || null,
    // remote-connector provenance (D-17)
    submitted_by: rec.submitted_by || null,
    // in-place script edit (Review): a video whose text changed needs a re-render before approve
    render_stale: rec.render_stale || null, edited_at: rec.edited_at || null,
    // photo-first creation: the specific Library photos this draft was built from (provenance)
    sourcePhotos: rec.sourcePhotos || null,
  };
}
const suffixFor = (v) => (v === "ad" ? ".ad.png" : v === "ad-photo" ? ".ad-photo.png" : ".png");

/* ───────────────────────── filesystem driver ───────────────────────── */
function fsReadQueue() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  const cards = [];
  for (const angle of fs.readdirSync(OUTPUT_DIR).sort()) {
    const dir = path.join(OUTPUT_DIR, angle);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle.startsWith("_")) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const base = f.replace(/\.json$/, "");
      const id = `${angle}/${base}`, q = encodeURIComponent(id);
      const adUrl = fs.existsSync(path.join(dir, `${base}.ad.png`)) ? `/api/image?id=${q}&v=ad` : null;
      const adPhotoUrl = fs.existsSync(path.join(dir, `${base}.ad-photo.png`)) ? `/api/image?id=${q}&v=ad-photo` : null;
      cards.push(shape(rec, id, fs.existsSync(path.join(dir, `${base}.png`)), null, adUrl, adPhotoUrl));
    }
  }
  return cards;
}
function fsGetImage(id, variant) {
  const safe = id.replace(/\.\./g, "").replace(/^\/+/, "");
  const p = path.join(OUTPUT_DIR, `${safe}${suffixFor(variant)}`);
  if (!p.startsWith(OUTPUT_DIR) || !fs.existsSync(p)) return null;
  return { kind: "file", path: p };
}
function fsReadApprovals() {
  if (!fs.existsSync(APPROVALS_FILE)) return { updatedAt: null, decisions: {} };
  try { return JSON.parse(fs.readFileSync(APPROVALS_FILE, "utf8")); } catch { return { updatedAt: null, decisions: {} }; }
}
function fsWriteApprovals(decisions) {
  const payload = { updatedAt: new Date().toISOString(), note: APPROVAL_NOTE, decisions };
  fs.writeFileSync(APPROVALS_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

/* ───────────────────────── cloud driver — Vercel Blob only ─────────────────────────
 * webpackIgnore: @vercel/blob is optional, present only in cloud deploys; never bundled
 * into the default fs build. queue.json holds pre-shaped cards; images are public blobs. */
async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }
// exact-pathname lookup (pathnames are stable: ingest uses addRandomSuffix:false)
async function blobUrl(key) {
  const { head } = await blobApi();
  try { const b = await head(key); return b?.url || null; } catch { return null; }
}
async function fetchJson(url) {
  try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; }
}
// The legacy single queue.json (human Create / MCP / double-down append here).
async function readLegacyQueue() {
  const url = await blobUrl(QUEUE_KEY);
  return (url && (await fetchJson(url))) || [];
}
// The per-item draft blobs (render batch writes here; clobber-proof). Paginate:
// Blob list() caps at ~1000/page, so follow the cursor or drafts past 1000 would
// silently vanish from every reader (and become undeletable).
async function listQueueItems() {
  try {
    const { list } = await blobApi();
    const all = [];
    let cursor;
    do {
      const res = await list({ prefix: QUEUE_ITEMS_PREFIX, cursor });
      all.push(...(res.blobs || []));
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);
    const cards = await Promise.all(all.map((b) => fetchJson(b.url)));
    return cards.filter(Boolean);
  } catch { return []; }
}
// Readers see BOTH sources, unioned + deduped by id, newest first. Only readers
// union — appends/deletes still target their own store so neither can copy the
// other's rows back into itself (which would re-expose render drafts to clobber).
async function cloudReadQueue() {
  const [legacy, items] = await Promise.all([readLegacyQueue(), listQueueItems()]);
  const byId = new Map();
  for (const c of legacy) if (c && c.id) byId.set(c.id, c);
  for (const c of items) if (c && c.id) byId.set(c.id, c); // per-item wins on id collision
  return [...byId.values()].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}
async function cloudGetImage(id, variant) {
  const url = await blobUrl(`creatives/${id}${suffixFor(variant)}`);
  return url ? { kind: "url", url } : null;
}
async function cloudReadApprovals() {
  const url = await blobUrl(APPROVALS_KEY);
  return (url && (await fetchJson(url))) || { updatedAt: null, note: APPROVAL_NOTE, decisions: {} };
}
async function cloudWriteApprovals(decisions) {
  const { put } = await blobApi();
  const payload = { updatedAt: new Date().toISOString(), note: APPROVAL_NOTE, decisions };
  await put(APPROVALS_KEY, JSON.stringify(payload), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  return payload;
}

/* ───────────────────────── append hub-generated creatives ─────────────────────────
 * items: [{ rec, adPng: Buffer }]. rec.id is `hub-generated/<uid>`. In fs mode they land in
 * output/hub-generated/ (picked up by fsReadQueue). In cloud mode the image is a Blob and the
 * pre-shaped card is prepended to queue.json. Generated creatives still stop at the queue (D-04). */
const HUB_DIR_NAME = "hub-generated";
function fsAppend(items) {
  const dir = path.join(OUTPUT_DIR, HUB_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  for (const { rec, adPng } of items) {
    const base = String(rec.id).split("/").pop();
    fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(rec, null, 2));
    if (adPng) fs.writeFileSync(path.join(dir, `${base}.ad.png`), adPng);
  }
  return items.length;
}
async function cloudAppend(items, { isolated = false } = {}) {
  const { put } = await blobApi();
  // Isolated: write each card as its OWN blob under queue-items/ — no read-modify-
  // write of the shared queue.json, so a concurrent writer can't clobber these.
  if (isolated) {
    let count = 0;
    for (const { rec, adPng } of items) {
      const id = rec.id;
      if (adPng) await put(`creatives/${id}.ad.png`, adPng, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/png" });
      const q = encodeURIComponent(id);
      const card = shape(rec, id, !!adPng, null, adPng ? `/api/image?id=${q}&v=ad` : null, null);
      await put(`${QUEUE_ITEMS_PREFIX}${encodeURIComponent(id)}.json`, JSON.stringify(card), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
      count++;
    }
    return count;
  }
  // Default: prepend into the shared queue.json (reads ONLY the legacy blob, never
  // the per-item union — so it can't absorb render drafts and re-expose them).
  const queue = await readLegacyQueue();
  for (const { rec, adPng } of items) {
    const id = rec.id;
    if (adPng) await put(`creatives/${id}.ad.png`, adPng, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/png" });
    const q = encodeURIComponent(id);
    queue.unshift(shape(rec, id, !!adPng, null, adPng ? `/api/image?id=${q}&v=ad` : null, null));
  }
  await put(QUEUE_KEY, JSON.stringify(queue), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  return queue.length;
}
export async function appendCreatives(items, opts) { return DRIVER === "cloud" ? cloudAppend(items, opts) : fsAppend(items); }

/* ───────────────────────── site photo Library (photo-first creation) ─────────────────────────
 * A site-wide library of REAL photos operators drop in (upload) or import from Drive — the single
 * source of truth every prompter shares. Blob-backed, per-item (clobber-proof, same pattern as the
 * render queue): each photo is { id, url, name, source, created_at }; the image bytes are their own
 * public blob. The render pipeline draws its real photos from here (Drive is a fallback while empty),
 * and the MCP connector lists it so Slack/Cowork prompt against the same set. fs mode → output/library/. */
export const LIBRARY_PREFIX = "library-items/"; // per-item index JSON
const LIBRARY_IMG_PREFIX = "library-img/"; // the image bytes
const LIBRARY_DIR = path.join(OUTPUT_DIR, "library");
const libId = () => `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const extFor = (ct = "") => (/png/i.test(ct) ? "png" : /webp/i.test(ct) ? "webp" : /gif/i.test(ct) ? "gif" : "jpg");

export async function listLibraryPhotos() {
  if (DRIVER === "cloud") {
    try {
      const { list } = await blobApi();
      const all = [];
      let cursor;
      do {
        const res = await list({ prefix: LIBRARY_PREFIX, cursor });
        all.push(...(res.blobs || []));
        cursor = res.hasMore ? res.cursor : undefined;
      } while (cursor);
      const recs = (await Promise.all(all.map((b) => fetchJson(b.url)))).filter(Boolean);
      return recs.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    } catch { return []; }
  }
  try {
    if (!fs.existsSync(LIBRARY_DIR)) return [];
    return fs.readdirSync(LIBRARY_DIR).filter((f) => f.endsWith(".json"))
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, f), "utf8")); } catch { return null; } })
      .filter(Boolean).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  } catch { return []; }
}

export async function addLibraryPhoto({ buffer, name, source = "upload", contentType = "image/jpeg" }) {
  const id = libId();
  const ext = extFor(contentType);
  const safeName = (String(name || "photo").replace(/[^\w.\- ]+/g, "").trim().slice(0, 120)) || "photo";
  if (DRIVER === "cloud") {
    const { put } = await blobApi();
    const img = await put(`${LIBRARY_IMG_PREFIX}${id}.${ext}`, buffer, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType });
    const rec = { id, url: img.url, name: safeName, source, created_at: Date.now() };
    await put(`${LIBRARY_PREFIX}${id}.json`, JSON.stringify(rec), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return rec;
  }
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  fs.writeFileSync(path.join(LIBRARY_DIR, `${id}.${ext}`), buffer);
  const rec = { id, url: `/api/library/img/${id}.${ext}`, name: safeName, source, created_at: Date.now() };
  fs.writeFileSync(path.join(LIBRARY_DIR, `${id}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

export async function deleteLibraryPhoto(id) {
  if (!id) return false;
  if (DRIVER === "cloud") {
    const { del } = await blobApi();
    const idxUrl = await blobUrl(`${LIBRARY_PREFIX}${id}.json`);
    const rec = idxUrl ? await fetchJson(idxUrl) : null;
    try { if (rec?.url) await del(rec.url); } catch {}
    try { if (idxUrl) await del(idxUrl); } catch {}
    return true;
  }
  try { for (const f of fs.readdirSync(LIBRARY_DIR)) if (f.startsWith(`${id}.`)) fs.unlinkSync(path.join(LIBRARY_DIR, f)); } catch {}
  return true;
}

/** Render helper: pull up to `limit` Library photos as { name, buffer } (mirrors drive.fetchFolderPhotos). */
export async function fetchLibraryPhotoBuffers(limit = 8) {
  const recs = (await listLibraryPhotos()).slice(0, limit);
  const out = [];
  for (const r of recs) {
    try { const res = await fetch(r.url, { cache: "no-store" }); if (res.ok) out.push({ name: r.name, buffer: Buffer.from(await res.arrayBuffer()) }); }
    catch (e) { console.warn(`[library] skip ${r.name}:`, e?.message || e); }
  }
  return out;
}

/* ───────────────────────── in-place text edit (Review "Edit script") ─────────────────────────
 * Update a draft's TEXT surfaces in place. The API layer re-runs the claims lock on the edit
 * BEFORE calling this, so a violating edit never persists. Money-arc render drafts are formula-
 * locked — only the opening hook (headline) + post caption are editable; body/cta/disclaimer stay
 * the fixed, claims-cleared spine. A VIDEO draft's captions/VO are burned in, so an edit no longer
 * matches the pixels → it's flagged render_stale and Review blocks approval until a re-render clears
 * it (ffmpeg runs on GitHub Actions, not here). A STATIC draft's copy IS the card text, so it
 * updates live. Persists as an isolated per-item blob (race-free; supersedes any legacy copy). */
const EDITABLE_TEXT = ["headline", "body", "cta", "caption"];
export function editableFields(card) {
  return card && card.qc ? ["headline", "caption"] : EDITABLE_TEXT; // money-arc: hook + caption only
}
async function readOneCreative(id) {
  const q = await readQueueRaw();
  return q.find((c) => c.id === id) || null;
}
export async function updateCreative(id, patch = {}) {
  const card = await readOneCreative(id);
  if (!card) return { ok: false, error: "not_found" };
  const allow = editableFields(card);
  const clean = {};
  for (const k of allow) if (k in patch && typeof patch[k] === "string") clean[k] = patch[k].slice(0, 2000);

  if (DRIVER === "cloud") {
    // Per-item blobs store SHAPED cards read back verbatim (no re-shape), so merge onto the
    // shaped card and rewrite the blob. Isolated → race-free; supersedes any legacy copy of this id.
    const next = { ...card, ...clean, edited_at: Date.now() };
    if (card.video_url) next.render_stale = true; // burned captions/VO now mismatch → GH-Actions re-render
    if (card.qc?.gate2?.checks) { // re-run the money-arc gate-2 "only verified claim" precheck
      const allText = [next.headline, next.body, next.cta, next.caption, next.disclaimer].filter(Boolean).join("\n");
      next.qc = { ...next.qc, gate2: { ...next.qc.gate2, checks: { ...next.qc.gate2.checks, onlyVerifiedClaim: claimViolations(allText).length === 0 } } };
    }
    const { put } = await blobApi();
    await put(`${QUEUE_ITEMS_PREFIX}${encodeURIComponent(id)}.json`, JSON.stringify(next), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return { ok: true, card: next };
  }

  // fs (dev): patch the RAW rec on disk so it round-trips through fsReadQueue's shape().
  const base = String(id).split("/").pop();
  const file = path.join(OUTPUT_DIR, HUB_DIR_NAME, `${base}.json`);
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  Object.assign(raw, clean, { edited_at: Date.now() });
  if (card.video_url) raw.render_stale = true;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(raw, null, 2));
  return { ok: true, card: { ...card, ...clean, edited_at: raw.edited_at, render_stale: raw.render_stale || card.render_stale || null } };
}

/* ───────────────────────── permanently delete a creative ─────────────────────────
 * Only invoked from the Review "Rejected" section's explicit Delete action (two-step: reject → delete).
 * Removes the card from the queue (and best-effort the public image blob). D-04 unaffected. */
function fsDelete(id) {
  const safe = String(id).replace(/\.\./g, "").replace(/^\/+/, "");
  for (const ext of [".json", ".png", ".ad.png", ".ad-photo.png"]) {
    const p = path.join(OUTPUT_DIR, `${safe}${ext}`);
    try { if (p.startsWith(OUTPUT_DIR) && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
}
async function cloudDelete(id) {
  const { put, del } = await blobApi();
  // Remove from BOTH stores: filter the legacy queue.json (read legacy only, so we
  // don't write per-item rows back into it) and delete the per-item blob if present.
  const legacy = (await readLegacyQueue()).filter((c) => c.id !== id);
  await put(QUEUE_KEY, JSON.stringify(legacy), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  try { const u = await blobUrl(`${QUEUE_ITEMS_PREFIX}${encodeURIComponent(id)}.json`); if (u) await del(u); } catch {}
  try { for (const v of ["ad", "ad-photo"]) { const u = await blobUrl(`creatives/${id}${suffixFor(v)}`); if (u) await del(u); } } catch {}
}
export async function deleteCreative(id) {
  if (!id) return false;
  if (DRIVER === "cloud") await cloudDelete(id); else fsDelete(id);
  return true;
}

/* ───────────────────────── soft remove → 30-day trash ─────────────────────────
 * "Remove" hides a creative EVERYWHERE (queue, gallery, counts, winner-ranking, the
 * posting path) without destroying it: ids live in a removed map { id: removedAtISO }.
 * The public readQueue() filters against the map, so every consumer is excluded by
 * default. Trash restores in one click; entries older than TRASH_DAYS hard-delete on
 * the next trash read. */
const REMOVED_FILE = path.join(OUTPUT_DIR, "removed.json");
async function readRemovedMap() {
  if (DRIVER === "cloud") {
    const url = await blobUrl(REMOVED_KEY);
    return (url && (await fetchJson(url))) || {};
  }
  try { return JSON.parse(fs.readFileSync(REMOVED_FILE, "utf8")); } catch { return {}; }
}
async function writeRemovedMap(map) {
  if (DRIVER === "cloud") {
    const { put } = await blobApi();
    await put(REMOVED_KEY, JSON.stringify(map), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  } else {
    fs.mkdirSync(path.dirname(REMOVED_FILE), { recursive: true });
    fs.writeFileSync(REMOVED_FILE, JSON.stringify(map, null, 2));
  }
}
/** Soft-remove (or restore) a batch of creatives. Returns the new trash size. */
export async function removeCreatives(ids = [], { restore = false } = {}) {
  const clean = (Array.isArray(ids) ? ids : []).map((i) => String(i)).filter(Boolean);
  if (!clean.length) return { trash: null };
  const map = await readRemovedMap();
  for (const id of clean) {
    if (restore) delete map[id];
    else map[id] = map[id] || new Date().toISOString();
  }
  await writeRemovedMap(map);
  return { trash: Object.keys(map).length };
}
const trashDaysLeft = (removedAt) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(removedAt).getTime()) / 86400000));
/** Trash view: removed-but-recoverable items. Purges anything past TRASH_DAYS (hard delete). */
export async function readTrash() {
  const [q, map] = await Promise.all([readQueueRaw(), readRemovedMap()]);
  let dirty = false;
  for (const [id, at] of Object.entries(map)) {
    if (trashDaysLeft(at) <= 0) { await deleteCreative(id).catch(() => {}); delete map[id]; dirty = true; }
  }
  if (dirty) await writeRemovedMap(map);
  return q.filter((c) => map[c.id]).map((c) => ({ ...c, removed_at: map[c.id], trash_days_left: trashDaysLeft(map[c.id]) }));
}

/** Upload a source image to PUBLIC Blob and return its URL (Cloud video needs a fetchable image_url). Cloud only. */
export async function putPublicImage(buf, name = "src") {
  if (DRIVER !== "cloud") throw new Error("video needs Blob image hosting — set STORE_DRIVER=cloud (+ BLOB_READ_WRITE_TOKEN)");
  const { put } = await blobApi();
  const b = await put(`gen-src/${name}.png`, buf, { access: "public", addRandomSuffix: true, contentType: "image/png" });
  return b.url;
}

/** Host a generated voiceover (mp3). cloud → public Blob; fs → public/gen-audio (served statically by Next). */
export async function putPublicAudio(buf, name = "vo") {
  if (DRIVER === "cloud") {
    const { put } = await blobApi();
    const b = await put(`gen-audio/${name}.mp3`, buf, { access: "public", addRandomSuffix: true, contentType: "audio/mpeg" });
    return b.url;
  }
  const dir = path.join(process.cwd(), "public", "gen-audio");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.mp3`), buf);
  return `/gen-audio/${name}.mp3`;
}

/** Host a generated video (mp4). cloud → public Blob; fs → public/gen-video (served statically by Next). */
export async function putPublicVideo(buf, name = "vid") {
  if (DRIVER === "cloud") {
    const { put } = await blobApi();
    const b = await put(`gen-video/${name}.mp4`, buf, { access: "public", addRandomSuffix: true, contentType: "video/mp4" });
    return b.url;
  }
  const dir = path.join(process.cwd(), "public", "gen-video");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.mp4`), buf);
  return `/gen-video/${name}.mp4`;
}

/** Host a carousel slide (png). cloud → public Blob; fs → public/gen-carousel. */
export async function putPublicPng(buf, name = "slide") {
  if (DRIVER === "cloud") {
    const { put } = await blobApi();
    const b = await put(`gen-carousel/${name}.png`, buf, { access: "public", addRandomSuffix: true, contentType: "image/png" });
    return b.url;
  }
  const dir = path.join(process.cwd(), "public", "gen-carousel");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.png`), buf);
  return `/gen-carousel/${name}.png`;
}

/* ───────────────────────── reject-reason log (Phase-1b) ─────────────────────────
 * Append-only audit trail of WHY drafts get rejected — feeds the "what to stop
 * generating" loop. Written on Review save; one JSON blob/file. Single-writer
 * (one human review session) so the blob read-modify-write race is acceptable here
 * — unlike queue.json bulk appends (see rebuild-batch). */
const REJECT_LOG_FILE = path.join(OUTPUT_DIR, "reject-log.json");
function fsReadRejectLog() {
  try { return JSON.parse(fs.readFileSync(REJECT_LOG_FILE, "utf8")); } catch { return []; }
}
async function cloudReadRejectLog() {
  const url = await blobUrl(REJECT_LOG_KEY);
  return (url && (await fetchJson(url))) || [];
}
export async function readRejectLog() { return DRIVER === "cloud" ? cloudReadRejectLog() : fsReadRejectLog(); }
export async function appendRejectLog(entries = []) {
  const clean = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && e.id)
    .map((e) => ({ id: String(e.id), reason: String(e.reason || "").slice(0, 500), at: new Date().toISOString() }));
  if (!clean.length) return { appended: 0 };
  const log = await readRejectLog();
  // skip exact repeats (same reason as that id's latest entry) so re-saves don't spam the trail
  const latest = new Map(log.map((e) => [e.id, e.reason]));
  const fresh = clean.filter((e) => latest.get(e.id) !== e.reason);
  if (!fresh.length) return { appended: 0, total: log.length };
  const next = [...log, ...fresh];
  if (DRIVER === "cloud") {
    const { put } = await blobApi();
    await put(REJECT_LOG_KEY, JSON.stringify(next), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  } else {
    fs.mkdirSync(path.dirname(REJECT_LOG_FILE), { recursive: true });
    fs.writeFileSync(REJECT_LOG_FILE, JSON.stringify(next, null, 2));
  }
  return { appended: fresh.length, total: next.length };
}

/* ───────────────────────── MCP submission log (remote connector, D-17) ─────────────────────────
 * Append-only audit trail of EVERY remote-connector call that touches the queue — which API key
 * (member) sent what, when, and what it cost. Same bounded-ledger pattern as the compute log. */
const MCP_LOG_FILE = path.join(OUTPUT_DIR, "mcp-log.json");
async function readMcpLogRaw() {
  if (DRIVER === "cloud") {
    const url = await blobUrl(MCP_LOG_KEY);
    return (url && (await fetchJson(url))) || [];
  }
  try { return JSON.parse(fs.readFileSync(MCP_LOG_FILE, "utf8")); } catch { return []; }
}
export async function readMcpLog() { return readMcpLogRaw(); }
export async function appendMcpLog(entry) {
  try {
    if (!entry || !entry.member) return false;
    const log = await readMcpLogRaw();
    log.push({
      member: String(entry.member), tool: String(entry.tool || ""), draft_id: entry.draft_id || null,
      credits: Number(entry.credits) || 0, note: String(entry.note || "").slice(0, 300), at: new Date().toISOString(),
    });
    const trimmed = log.slice(-2000);
    if (DRIVER === "cloud") {
      const { put } = await blobApi();
      await put(MCP_LOG_KEY, JSON.stringify(trimmed), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    } else {
      fs.mkdirSync(path.dirname(MCP_LOG_FILE), { recursive: true });
      fs.writeFileSync(MCP_LOG_FILE, JSON.stringify(trimmed, null, 2));
    }
    return true;
  } catch { return false; } // audit-log hiccup must not fail a submission
}

/* ───────────────────────── compute-spend ledger (engine-audit P0-1c) ─────────────────────────
 * Append-only log of render-compute estimates, one entry per engine start. Feeds the running
 * meter in Create. Best-effort by design: a ledger hiccup must never fail a render. Same
 * read-modify-write caveat as queue.json — the UI fires generates sequentially, so acceptable. */
const COMPUTE_LOG_FILE = path.join(OUTPUT_DIR, "compute-log.json");
function fsReadComputeLog() {
  try { return JSON.parse(fs.readFileSync(COMPUTE_LOG_FILE, "utf8")); } catch { return []; }
}
async function cloudReadComputeLog() {
  const url = await blobUrl(COMPUTE_LOG_KEY);
  return (url && (await fetchJson(url))) || [];
}
export async function readComputeLog() { return DRIVER === "cloud" ? cloudReadComputeLog() : fsReadComputeLog(); }
export async function appendComputeLog(entry) {
  try {
    if (!entry || !entry.kind) return false;
    const log = await readComputeLog();
    log.push({ kind: String(entry.kind), credits: Number(entry.credits) || 0, note: String(entry.note || "").slice(0, 200), at: new Date().toISOString() });
    const trimmed = log.slice(-2000); // ledger, not archive — keep it bounded
    if (DRIVER === "cloud") {
      const { put } = await blobApi();
      await put(COMPUTE_LOG_KEY, JSON.stringify(trimmed), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    } else {
      fs.mkdirSync(path.dirname(COMPUTE_LOG_FILE), { recursive: true });
      fs.writeFileSync(COMPUTE_LOG_FILE, JSON.stringify(trimmed, null, 2));
    }
    return true;
  } catch { return false; } // never fail the render over the meter
}

/* ───────────────────────── public API (driver-routed) ───────────────────────── */
async function readQueueRaw() { return DRIVER === "cloud" ? cloudReadQueue() : fsReadQueue(); }
/** The live queue — soft-removed items are filtered out for EVERY consumer (gallery, counts,
 *  ranking, posting). Use readTrash() to see what's removed. */
export async function readQueue() {
  const [q, removed] = await Promise.all([readQueueRaw(), readRemovedMap()]);
  if (!Object.keys(removed).length) return q;
  return q.filter((c) => !removed[c.id]);
}
export async function getImage(id, variant) { return DRIVER === "cloud" ? cloudGetImage(id, variant) : fsGetImage(id, variant); }
/** Public CDN URL of a creative's ad image (for Meta publishing, which needs a fetchable URL). Cloud only. */
export async function publicImageUrl(id, variant = "ad") { return DRIVER === "cloud" ? blobUrl(`creatives/${id}${suffixFor(variant)}`) : null; }
export async function readApprovals() { return DRIVER === "cloud" ? cloudReadApprovals() : fsReadApprovals(); }
export async function writeApprovals(decisions) {
  const allowed = new Set(["approve", "hold", "reject"]);
  const clean = Object.fromEntries(Object.entries(decisions).filter(([, v]) => allowed.has(v)));
  return DRIVER === "cloud" ? cloudWriteApprovals(clean) : fsWriteApprovals(clean);
}
