#!/usr/bin/env node
/**
 * Render the 2 beats Veo couldn't (quota-capped) via Higgsfield image→video, into public/hero/veo-seg/.
 *   3-danang-dragon  ← clean controlled-fire frame (danang-cand-12.5.jpg)
 *   4-ski-cottage    ← 06-ski-resort.png still
 * Uploads each source to Vercel Blob (public URL Higgsfield can fetch), animates, downloads the mp4.
 *
 * Requires HF_API_KEY + HF_API_SECRET + BLOB_READ_WRITE_TOKEN.
 * Usage: node --env-file=.env.local scripts/render-fallback-beats.mjs
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HERO = join(ROOT, "public", "hero");
const SEGDIR = join(HERO, "veo-seg");
const BASE = process.env.HF_CLOUD_URL || "https://platform.higgsfield.ai";
const KEY = process.env.HF_API_KEY || process.env.HIGGSFIELD_API_KEY_ID || "";
const SECRET = process.env.HF_API_SECRET || process.env.HIGGSFIELD_API_KEY_SECRET || "";
const BLOB = process.env.BLOB_READ_WRITE_TOKEN || "";

const BEATS = [
  { key: "3-danang-dragon", src: join(SEGDIR, "frames", "danang-cand-12.5.jpg"), mime: "image/jpeg",
    motion: "The golden dragon breathes a steady, controlled stream of orange fire forward over the river; flames flicker and glow, lights shimmer on the dark water; slow gentle cinematic drift along the bridge. Photorealistic, no drone, no aircraft, no explosion." },
  { key: "4-ski-cottage", src: join(HERO, "06-ski-resort.png"), mime: "image/png",
    motion: "Slow cinematic aerial drift over a snow-dusted alpine ski resort at pink alpenglow dusk, gentle parallax toward cozy cabins with warm glowing windows. Photorealistic, no drone, no aircraft." },
];

const auth = () => `Key ${KEY}:${SECRET}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadBlob(buf, name, mime) {
  const { put } = await import("@vercel/blob");
  const { url } = await put(`hero-src/${name}`, buf, { access: "public", token: BLOB, contentType: mime, addRandomSuffix: true });
  return url;
}
async function startVideo(imageUrl, prompt) {
  const res = await fetch(`${BASE}/v1/image2video/dop`, {
    method: "POST", headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ params: { model: "dop-turbo", prompt, input_images: [{ type: "image_url", image_url: imageUrl }] } }),
  });
  if (!res.ok) throw new Error(`create ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json(); if (!j.id) throw new Error("no job-set id"); return j.id;
}
async function pollVideo(setId) {
  const res = await fetch(`${BASE}/v1/job-sets/${setId}`, { headers: { Authorization: auth() } });
  if (!res.ok) throw new Error(`poll ${res.status}`);
  const job = (await res.json()).jobs?.[0] || {};
  return { status: job.status, url: job.results?.raw?.url || job.results?.min?.url || null };
}

async function renderBeat(b) {
  const out = join(SEGDIR, `${b.key}.mp4`);
  const url = await uploadBlob(await readFile(b.src), `${b.key}.${b.mime === "image/png" ? "png" : "jpg"}`, b.mime);
  const setId = await startVideo(url, b.motion);
  console.log(`[${b.key}] queued (${setId})`);
  for (let i = 0; i < 180; i++) {
    await sleep(5000);
    const { status, url: r } = await pollVideo(setId);
    if (status === "completed" && r) { await writeFile(out, Buffer.from(await (await fetch(r)).arrayBuffer())); console.log(`[${b.key}] ✓ → ${out}`); return; }
    if (status === "failed" || status === "nsfw") throw new Error(`job ${status}`);
  }
  throw new Error("timed out");
}

async function main() {
  if (!KEY || !SECRET) { console.error("Missing HF_API_KEY/SECRET"); process.exit(1); }
  if (!BLOB) { console.error("Missing BLOB_READ_WRITE_TOKEN"); process.exit(1); }
  for (const b of BEATS) { try { await renderBeat(b); } catch (e) { console.error(`[${b.key}] FAILED: ${e.message}`); process.exitCode = 1; } }
  console.log("\nDone. Now run scripts/stitch-hero.mjs to assemble all 5 beats.");
}
main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
