import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";

/**
 * Generation job store (driver-aware, mirrors lib/store.js).
 *   STORE_DRIVER=fs    → jobs as JSON under creative-engine/output/_jobs (laptop/VM).
 *   STORE_DRIVER=cloud → jobs as Vercel Blob under jobs/<id>.json (serverless-safe).
 *
 * A job is short-lived state for an async generation (esp. video, which renders for minutes).
 * Each poll is its own short request — we never hold a serverless function open. (D-04: never publishes.)
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const JOBS_DIR = path.join(OUTPUT_DIR, "_jobs");
const key = (id) => `jobs/${id}.json`;

export function newId(prefix = "job") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }
async function blobPutJson(k, obj) {
  const { put } = await blobApi();
  await put(k, JSON.stringify(obj), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
}
async function blobGetJson(k) {
  const { head } = await blobApi();
  try { const b = await head(k); if (!b?.url) return null; const r = await fetch(b.url, { cache: "no-store" }); return r.ok ? await r.json() : null; }
  catch { return null; }
}

export async function saveJob(job) {
  job.updatedAt = new Date().toISOString();
  if (DRIVER === "cloud") await blobPutJson(key(job.id), job);
  else { fs.mkdirSync(JOBS_DIR, { recursive: true }); fs.writeFileSync(path.join(JOBS_DIR, `${job.id}.json`), JSON.stringify(job, null, 2)); }
  return job;
}

export async function getJob(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_.-]/g, "");
  if (!safe) return null;
  if (DRIVER === "cloud") return blobGetJson(key(safe));
  const p = path.join(JOBS_DIR, `${safe}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}
