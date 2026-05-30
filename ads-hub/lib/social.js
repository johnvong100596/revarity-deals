import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";

/**
 * Social connections + post schedule (Blob/fs, mirrors lib/swipe.js).
 * Each person connects their own channel and controls which approved ads flow to their account.
 * Posting is QUEUED here; nothing publishes until a channel is Connected and the human approves the
 * queue (approve-the-queue model). Real publish/insights wiring lands when Connect is pressed.
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const KEY = "state/social.json";
const FILE = path.join(OUTPUT_DIR, "_social.json");
export const CHANNELS = ["instagram", "facebook", "meta_ads"];
const EMPTY = {
  connections: { instagram: { connected: false }, facebook: { connected: false }, meta_ads: { connected: false } },
  schedule: [], // [{ id, creativeId, channel, account, postAt, status:"queued"|"posted", by }]
  updatedAt: null,
};

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }

export async function readSocial() {
  if (DRIVER === "cloud") {
    try { const { head } = await blobApi(); const b = await head(KEY); if (!b?.url) return { ...EMPTY }; const r = await fetch(b.url, { cache: "no-store" }); return r.ok ? await r.json() : { ...EMPTY }; }
    catch { return { ...EMPTY }; }
  }
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { ...EMPTY }; }
}

export async function writeSocial(state) {
  state.updatedAt = new Date().toISOString();
  if (DRIVER === "cloud") { const { put } = await blobApi(); await put(KEY, JSON.stringify(state), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }); }
  else { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); }
  return state;
}
