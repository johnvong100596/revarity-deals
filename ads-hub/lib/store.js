import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR, APPROVALS_FILE } from "./paths.js";

/**
 * Storage abstraction. All pages/API call these functions; the driver decides where
 * data lives. This is the seam that makes the hub Vercel-deployable.
 *
 *   STORE_DRIVER=fs    (default) — reads the engine's local output + writes approvals.json.
 *                                  Works on a laptop / VM. The dev + demo path.
 *   STORE_DRIVER=cloud           — Vercel Blob (PNGs) + Postgres (queue + approvals).
 *                                  Survives serverless' ephemeral FS. Publish a run with
 *                                  `scripts/ingest.mjs` (uploads local output → blob + pg).
 *
 * All functions are async so the cloud driver can do I/O without changing callers.
 */
const DRIVER = process.env.STORE_DRIVER || "fs";

const APPROVAL_NOTE =
  "Approved set is marked ready. Pushing live to Meta is a human action outside this hub (D-04).";

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

/* ───────────────────────── cloud driver (Vercel Blob + Postgres) ─────────────────────────
 * Dynamic imports so local `fs` runs need neither package installed. Provision with
 * lib/schema.sql; publish a run with scripts/ingest.mjs. */
// webpackIgnore: @vercel/postgres is an optional dep, only present in cloud deploys.
// Skip bundling so the default `fs` build never needs it installed.
async function pg() { const m = await import(/* webpackIgnore: true */ "@vercel/postgres"); return m.sql; }

async function cloudReadQueue() {
  const sql = await pg();
  const { rows } = await sql`SELECT * FROM creatives ORDER BY id`;
  return rows.map((r) => shape(
    { angle_id: r.angle_id, variant: r.variant, spec: r.spec, dimensions: r.dimensions,
      headline: r.headline, body: r.body, cta: r.cta, pricing_flag: r.pricing_flag,
      qa: { image_layer_verdict: r.qa, image_layer_reasons: r.qa_reasons || [], qa_model: r.qa_model } },
    r.id, !!r.image_url, r.image_url));
}
async function cloudGetImage(id) {
  const sql = await pg();
  const { rows } = await sql`SELECT image_url FROM creatives WHERE id = ${id} LIMIT 1`;
  return rows[0]?.image_url ? { kind: "url", url: rows[0].image_url } : null;
}
async function cloudReadApprovals() {
  const sql = await pg();
  const { rows } = await sql`SELECT id, decision, updated_at FROM approvals`;
  const decisions = {}; let updatedAt = null;
  for (const r of rows) { decisions[r.id] = r.decision; if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at; }
  return { updatedAt, note: APPROVAL_NOTE, decisions };
}
async function cloudWriteApprovals(decisions) {
  const sql = await pg();
  await sql`DELETE FROM approvals`;
  for (const [id, decision] of Object.entries(decisions)) {
    await sql`INSERT INTO approvals (id, decision, updated_at) VALUES (${id}, ${decision}, NOW())`;
  }
  return { updatedAt: new Date().toISOString(), note: APPROVAL_NOTE, decisions };
}

/* ───────────────────────── shared ───────────────────────── */
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

/* ───────────────────────── public API (driver-routed) ───────────────────────── */
export async function readQueue() { return DRIVER === "cloud" ? cloudReadQueue() : fsReadQueue(); }
export async function getImage(id) { return DRIVER === "cloud" ? cloudGetImage(id) : fsGetImage(id); }
export async function readApprovals() { return DRIVER === "cloud" ? cloudReadApprovals() : fsReadApprovals(); }
export async function writeApprovals(decisions) {
  const allowed = new Set(["approve", "hold", "reject"]);
  const clean = Object.fromEntries(Object.entries(decisions).filter(([, v]) => allowed.has(v)));
  return DRIVER === "cloud" ? cloudWriteApprovals(clean) : fsWriteApprovals(clean);
}
