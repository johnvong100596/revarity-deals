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

function shape(rec, id, hasImg, image_url) {
  return {
    id, angle_id: rec.angle_id, variant: rec.variant, spec: rec.spec, dimensions: rec.dimensions,
    headline: rec.headline, body: rec.body, cta: rec.cta, pricing_flag: rec.pricing_flag || null,
    qa: rec.qa?.image_layer_verdict || "—", qa_reasons: rec.qa?.image_layer_reasons || [],
    qa_model: rec.qa?.qa_model || "",
    vertical: (rec.spec || "").includes("story") || (rec.spec || "").includes("vertical"),
    hasImg, image_url: image_url || null,
  };
}

/* ───────────────────────── filesystem driver ───────────────────────── */
function fsReadQueue() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  const cards = [];
  for (const angle of fs.readdirSync(OUTPUT_DIR).sort()) {
    const dir = path.join(OUTPUT_DIR, angle);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const base = f.replace(/\.json$/, "");
      cards.push(shape(rec, `${angle}/${base}`, fs.existsSync(path.join(dir, `${base}.png`))));
    }
  }
  return cards;
}
function fsGetImage(id) {
  const safe = id.replace(/\.\./g, "").replace(/^\/+/, "");
  const p = path.join(OUTPUT_DIR, `${safe}.png`);
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
async function blobUrl(prefix) {
  const { list } = await blobApi();
  const { blobs } = await list({ prefix });
  return blobs[0]?.url || null;
}
async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  return r.ok ? r.json() : null;
}
async function cloudReadQueue() {
  const url = await blobUrl(QUEUE_KEY);
  return (url && (await fetchJson(url))) || [];
}
async function cloudGetImage(id) {
  const url = await blobUrl(`creatives/${id}.png`);
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

/* ───────────────────────── public API (driver-routed) ───────────────────────── */
export async function readQueue() { return DRIVER === "cloud" ? cloudReadQueue() : fsReadQueue(); }
export async function getImage(id) { return DRIVER === "cloud" ? cloudGetImage(id) : fsGetImage(id); }
export async function readApprovals() { return DRIVER === "cloud" ? cloudReadApprovals() : fsReadApprovals(); }
export async function writeApprovals(decisions) {
  const allowed = new Set(["approve", "hold", "reject"]);
  const clean = Object.fromEntries(Object.entries(decisions).filter(([, v]) => allowed.has(v)));
  return DRIVER === "cloud" ? cloudWriteApprovals(clean) : fsWriteApprovals(clean);
}
