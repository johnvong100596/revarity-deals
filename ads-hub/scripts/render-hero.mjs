#!/usr/bin/env node
/**
 * Render the home hero "drone journey" background and write public/hero/hero-loop.mp4.
 *
 * Pipeline (self-contained — no public site required, the prod site is auth-gated):
 *   1. upload the 8 local stills to Vercel Blob (public URLs Higgsfield can fetch)
 *   2. fire 8 Higgsfield image→video jobs in parallel (each animates one still with subtle drone motion)
 *   3. poll + download each clip to public/hero/clips/<n>-<name>.mp4
 *   4. stitch them in order into public/hero/hero-loop.mp4 via ffmpeg-static (hard cuts; the <video loop>
 *      attribute repeats it). For crossfades, see docs/VIDEO-PROMPTS.md §1c.
 *
 * Note: Higgsfield's image2video animates ONE still — it does not produce a true continuous fly-through.
 * For a single-take journey use Veo 3 (GEMINI_API_KEY is present) with the master prompt in VIDEO-PROMPTS.md §1a.
 *
 * Requirements: Node 18+, env HF_API_KEY + HF_API_SECRET + BLOB_READ_WRITE_TOKEN.
 * Usage:  node --env-file=.env.local scripts/render-hero.mjs
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HERO = join(ROOT, "public", "hero");
const CLIPS = join(HERO, "clips");

const BASE = process.env.HF_CLOUD_URL || "https://platform.higgsfield.ai";
const KEY = process.env.HF_API_KEY || process.env.HIGGSFIELD_API_KEY_ID || "";
const SECRET = process.env.HF_API_SECRET || process.env.HIGGSFIELD_API_KEY_SECRET || "";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

const COMMON = " — slow, smooth, cinematic drone motion, golden-hour editorial grade, no text, no people";
const SEGMENTS = [
  ["01-bedroom-city", "slow push-in through a sunlit villa bedroom toward open doors and bright daylight beyond"],
  ["02-over-city", "aerial drift forward high over a coastal city at golden hour, gentle parallax"],
  ["03-sky", "push up into deep blue sky through a soft cloud that fills the frame"],
  ["04-tulum-aerial", "descend and skim low over turquoise surf and white sand, banking gently"],
  ["05-villa-door", "glide toward a glowing villa doorway and high-rise window at dusk"],
  ["06-ski-resort", "rise over a snow-dusted alpine ski resort in pink alpenglow"],
  ["07-cottage-fire", "drift past a cozy timber cottage with warm firelight in the windows"],
  ["08-highrise-night", "bank over a glittering night city skyline, curving back toward warm light"],
];

const authHeader = () => `Key ${KEY}:${SECRET}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadStill(name) {
  const { put } = await import("@vercel/blob");
  const buf = await readFile(join(HERO, `${name}.png`));
  const { url } = await put(`hero-src/${name}.png`, buf, {
    access: "public", token: BLOB_TOKEN, contentType: "image/png", addRandomSuffix: true,
  });
  return url;
}

async function startVideo(imageUrl, prompt) {
  const res = await fetch(`${BASE}/v1/image2video/dop`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ params: { model: "dop-turbo", prompt, input_images: [{ type: "image_url", image_url: imageUrl }] } }),
  });
  if (!res.ok) throw new Error(`create ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  if (!j.id) throw new Error("no job-set id");
  return j.id;
}

async function pollVideo(setId) {
  const res = await fetch(`${BASE}/v1/job-sets/${setId}`, { headers: { Authorization: authHeader() } });
  if (!res.ok) throw new Error(`poll ${res.status}`);
  const job = (await res.json()).jobs?.[0] || {};
  return { status: job.status, url: job.results?.raw?.url || job.results?.min?.url || null };
}

async function renderOne(idx, [name, motion]) {
  const tag = `${String(idx + 1).padStart(2, "0")}-${name}`;
  try {
    const imageUrl = await uploadStill(name);
    const setId = await startVideo(imageUrl, motion + COMMON);
    console.log(`[${tag}] queued (${setId})`);
    for (let i = 0; i < 180; i++) {
      await sleep(5000);
      const { status, url } = await pollVideo(setId);
      if (status === "completed" && url) {
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        const out = join(CLIPS, `${tag}.mp4`);
        await writeFile(out, buf);
        console.log(`[${tag}] ✓ downloaded`);
        return out;
      }
      if (status === "failed" || status === "nsfw") throw new Error(`job ${status}`);
    }
    throw new Error("timed out");
  } catch (e) {
    console.log(`[${tag}] ✗ ${e.message}`);
    return null;
  }
}

async function stitch(clips) {
  let ffmpeg;
  try { ffmpeg = (await import("ffmpeg-static")).default; } catch { ffmpeg = null; }
  const outFile = join(HERO, "hero-loop.mp4");
  if (!ffmpeg) {
    // no stitcher available — still deliver a moving background by using the first good aerial clip
    const pick = clips.find((c) => c.includes("02-over-city")) || clips[0];
    if (pick) { await writeFile(outFile, await readFile(pick)); console.log(`\nffmpeg-static missing → used ${pick} as hero-loop.mp4`); }
    return;
  }
  const listFile = join(CLIPS, "concat.txt");
  await writeFile(listFile, clips.map((c) => `file '${c.replace(/\\/g, "/")}'`).join("\n"));
  const args = ["-y", "-f", "concat", "-safe", "0", "-i", listFile.replace(/\\/g, "/"),
    "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", outFile.replace(/\\/g, "/")];
  await new Promise((res, rej) => {
    const p = spawn(ffmpeg, args, { stdio: "inherit" });
    p.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
  });
  console.log(`\n✓ stitched ${clips.length} clips → public/hero/hero-loop.mp4`);
}

async function main() {
  if (!KEY || !SECRET) { console.error("Missing HF_API_KEY / HF_API_SECRET."); process.exit(1); }
  if (!BLOB_TOKEN) { console.error("Missing BLOB_READ_WRITE_TOKEN (needed to give Higgsfield public image URLs)."); process.exit(1); }
  await mkdir(CLIPS, { recursive: true });
  console.log(`Rendering ${SEGMENTS.length} hero segments via Higgsfield (parallel)…\n`);
  const results = await Promise.all(SEGMENTS.map((seg, i) => renderOne(i, seg)));
  const clips = results.filter(Boolean).sort();
  if (!clips.length) { console.error("\nNo clips rendered — aborting stitch."); process.exit(1); }
  await stitch(clips);
  console.log("\nDone. The hero will pick up public/hero/hero-loop.mp4 automatically on next load.");
}

main().catch((e) => { console.error(e); process.exit(1); });
