import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR, APPROVALS_FILE } from "./paths.js";

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
export const APPROVALS_KEY = "state/approvals.json";

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
async function cloudReadQueue() {
  const url = await blobUrl(QUEUE_KEY);
  return (url && (await fetchJson(url))) || [];
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
async function cloudAppend(items) {
  const { put } = await blobApi();
  const queue = await cloudReadQueue();
  for (const { rec, adPng } of items) {
    const id = rec.id;
    if (adPng) await put(`creatives/${id}.ad.png`, adPng, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/png" });
    const q = encodeURIComponent(id);
    queue.unshift(shape(rec, id, !!adPng, null, adPng ? `/api/image?id=${q}&v=ad` : null, null));
  }
  await put(QUEUE_KEY, JSON.stringify(queue), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  return queue.length;
}
export async function appendCreatives(items) { return DRIVER === "cloud" ? cloudAppend(items) : fsAppend(items); }

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

/* ───────────────────────── public API (driver-routed) ───────────────────────── */
export async function readQueue() { return DRIVER === "cloud" ? cloudReadQueue() : fsReadQueue(); }
export async function getImage(id, variant) { return DRIVER === "cloud" ? cloudGetImage(id, variant) : fsGetImage(id, variant); }
/** Public CDN URL of a creative's ad image (for Meta publishing, which needs a fetchable URL). Cloud only. */
export async function publicImageUrl(id, variant = "ad") { return DRIVER === "cloud" ? blobUrl(`creatives/${id}${suffixFor(variant)}`) : null; }
export async function readApprovals() { return DRIVER === "cloud" ? cloudReadApprovals() : fsReadApprovals(); }
export async function writeApprovals(decisions) {
  const allowed = new Set(["approve", "hold", "reject"]);
  const clean = Object.fromEntries(Object.entries(decisions).filter(([, v]) => allowed.has(v)));
  return DRIVER === "cloud" ? cloudWriteApprovals(clean) : fsWriteApprovals(clean);
}
