import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";

/**
 * Short-lived holding pen between the Meta OAuth callback and the channel picker (D-18).
 * Holds the encrypted long-lived user token + the page list for ≤15 minutes while the
 * owner chooses which pages/IG accounts join the pool. Keyed by a hash of the signed
 * OAuth state; consumed (deleted) on finalize.
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const TTL_MS = 15 * 60 * 1000;
const key = (h) => `state/meta-pending-${h}.json`;
const file = (h) => path.join(OUTPUT_DIR, `_meta-pending-${h}.json`);

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }

export async function savePending(hash, data) {
  const payload = JSON.stringify({ ...data, ts: Date.now() });
  if (DRIVER === "cloud") {
    const { put } = await blobApi();
    await put(key(hash), payload, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  } else {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(file(hash), payload);
  }
}

export async function readPending(hash) {
  let j = null;
  if (DRIVER === "cloud") {
    try { const { head } = await blobApi(); const b = await head(key(hash)); if (b?.url) { const r = await fetch(b.url, { cache: "no-store" }); j = r.ok ? await r.json() : null; } } catch {}
  } else {
    try { j = JSON.parse(fs.readFileSync(file(hash), "utf8")); } catch {}
  }
  if (!j || !j.ts || Date.now() - j.ts > TTL_MS) return null;
  return j;
}

export async function deletePending(hash) {
  if (DRIVER === "cloud") {
    try { const { head, del } = await blobApi(); const b = await head(key(hash)); if (b?.url) await del(b.url); } catch {}
  } else {
    try { fs.unlinkSync(file(hash)); } catch {}
  }
}
