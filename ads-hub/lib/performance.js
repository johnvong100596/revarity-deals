import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";

/**
 * Per-post performance store (Blob/fs). EMPTY until a connected channel's insights writer fills it
 * (that writer is wired when a real Meta/IG account is connected). rankWinners() then surfaces the
 * top performers so the studio can auto-make more like them (the double-down). (Loop B.)
 *   post shape: { creativeId, channel, postedAt, views, likes, saves, clicks }
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const KEY = "state/performance.json";
const FILE = path.join(OUTPUT_DIR, "_performance.json");
const EMPTY = { posts: [], updatedAt: null };

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }

export async function readPerformance() {
  if (DRIVER === "cloud") {
    try { const { head } = await blobApi(); const b = await head(KEY); if (!b?.url) return { ...EMPTY }; const r = await fetch(b.url, { cache: "no-store" }); return r.ok ? await r.json() : { ...EMPTY }; }
    catch { return { ...EMPTY }; }
  }
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { ...EMPTY }; }
}

/** Top performers to double down on. metric defaults to views. */
export function rankWinners(posts, metric = "views", n = 10) {
  return [...(posts || [])].sort((a, b) => (b?.[metric] || 0) - (a?.[metric] || 0)).slice(0, n);
}
