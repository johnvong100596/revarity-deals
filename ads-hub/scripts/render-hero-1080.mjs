#!/usr/bin/env node
/**
 * High-quality stitched hero fly-through → public/hero/hero-loop.mp4 (1080p).
 *
 * Veo 3.1 extension is 720p-only, so for 1080p we render each location as its own crisp 8s 1080p
 * single-take (text-to-video, NO visible drone), then stitch them with match-cut crossfades so it reads
 * as one continuous journey. Includes the new Da Nang Dragon Bridge fire beat.
 *
 * Backs up the current hero-loop.mp4 → hero-loop-prev.mp4. Per-segment 1080p clips kept in public/hero/veo-seg/.
 * Requires GEMINI_API_KEY (Veo access). Usage: node --env-file=.env.local scripts/render-hero-1080.mjs
 */
import { GoogleGenAI } from "@google/genai";
import ffmpegPath from "ffmpeg-static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { mkdir, writeFile, stat, copyFile, access } from "node:fs/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HERO = join(ROOT, "public", "hero");
const SEGDIR = join(HERO, "veo-seg");
const OUT = join(HERO, "hero-loop.mp4");
const MODEL = process.env.VEO_MODEL || "veo-3.1-generate-preview";
const TRIM = 6.5, XF = 1.0; // per-segment seconds used + crossfade seconds → total = n*TRIM − (n−1)*XF

// Pure aerial flying-camera POV; the negative kills any visible aircraft/drone.
const STYLE = " First-person aerial flying-camera point of view, as if the viewer is gliding through the air; smooth cinematic motion, photorealistic, ultra-detailed, sharp, high dynamic range, warm editorial color grade. Absolutely NO drone, aircraft, helicopter, rotor blades, propellers, or drone shadow anywhere in frame. No text, no logos, no people in focus.";
const SEGMENTS = [
  ["1-villa-beach", "Glide out of a sun-drenched Tulum villa bedroom through open glass doors onto a balcony, then sweep low and fast over white sand and glassy turquoise surf at golden hour." + STYLE],
  ["2-cloud-dubai", "Accelerate upward off the water into a bright blue sky, pushing through a soft sunlit cloud that fills the frame, then emerge high over a glittering Dubai skyline at golden hour, banking gracefully past mirrored skyscrapers toward one warmly glowing penthouse window." + STYLE],
  ["3-danang-dragon", "Downtown Da Nang, Vietnam at night during the famous Dragon Bridge fire show. The iconic golden Dragon Bridge arches over the Han River; the dragon's head breathes a steady, controlled stream of warm orange fire forward into the night air, graceful glowing flames with light wisps of smoke, reflecting on the calm water, the lit riverside skyline behind. Glide smoothly along and past the bridge. The fire is an elegant performance — absolutely NO explosion, NO blast, NO fireball, NO mushroom cloud in the sky." + STYLE],
  ["4-ski-cottage", "Rise over a snow-dusted alpine ski resort glowing in soft pink alpenglow at dusk, then drift down past the slopes toward a cozy timber cottage with warm firelight flickering in its windows." + STYLE],
  ["5-night-skyline", "Rise gently over a sparkling night city skyline, lights twinkling far below, the motion easing as if arriving home, a calm aspirational finish." + STYLE],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fileOk(p) { try { const s = await stat(p); return s.size > 100000; } catch { return false; } }

// Create with retry/backoff on 429 (Veo 1080p has a low concurrency/RPM quota).
async function startWithRetry(ai, prompt, key) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await ai.models.generateVideos({ model: MODEL, prompt, config: { aspectRatio: "16:9", resolution: "1080p", durationSeconds: 8 } });
    } catch (e) {
      const msg = String(e?.message || e);
      if (/429|quota|RESOURCE_EXHAUSTED|rate/i.test(msg) && attempt < 5) {
        const wait = 30 * attempt;
        console.log(`  [${key}] 429 — backing off ${wait}s (attempt ${attempt})`);
        await sleep(wait * 1000);
        continue;
      }
      throw e;
    }
  }
}

async function renderSeg(ai, [key, prompt], apiKey) {
  const out = join(SEGDIR, `${key}.mp4`);
  if (await fileOk(out)) { console.log(`  [${key}] reuse (already rendered)`); return out; }
  try {
    let op = await startWithRetry(ai, prompt, key);
    let waited = 0;
    while (!op.done) { await sleep(10000); waited += 10; console.log(`  [${key}] ${waited}s`); op = await ai.operations.getVideosOperation({ operation: op }); }
    if (op.error) throw new Error(JSON.stringify(op.error));
    const video = op.response?.generatedVideos?.[0]?.video;
    if (!video) throw new Error("no video");
    try { await ai.files.download({ file: video, downloadPath: out }); }
    catch (e) { const uri = video?.uri; if (!uri) throw e; const r = await fetch(uri, { headers: { "x-goog-api-key": apiKey } }); if (!r.ok) throw new Error(`dl ${r.status}`); await writeFile(out, Buffer.from(await r.arrayBuffer())); }
    console.log(`  [${key}] ✓`);
    return out;
  } catch (e) { console.log(`  [${key}] ✗ ${e.message?.slice(0, 140)}`); return null; }
}

function stitch(clips) {
  return new Promise((res, rej) => {
    const trims = clips.map((_, i) => `[${i}:v]trim=0:${TRIM},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=24[v${i}]`).join(";");
    let chain = "", prev = "v0";
    for (let i = 1; i < clips.length; i++) {
      const o = (i * (TRIM - XF)).toFixed(2);
      const out = i === clips.length - 1 ? "vout" : `x${i}`;
      chain += `;[${prev}][v${i}]xfade=transition=fade:duration=${XF}:offset=${o}[${out}]`;
      prev = out;
    }
    const filter = trims + chain;
    const args = ["-y", ...clips.flatMap((c) => ["-i", c.replace(/\\/g, "/")]),
      "-filter_complex", filter, "-map", clips.length > 1 ? "[vout]" : "[v0]",
      "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", OUT.replace(/\\/g, "/")];
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "inherit"] });
    p.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
  });
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) { console.error("Missing GEMINI_API_KEY"); process.exit(1); }
  const ai = new GoogleGenAI({ apiKey });
  await mkdir(SEGDIR, { recursive: true });

  console.log(`Rendering ${SEGMENTS.length} segments at 1080p (sequential, resumable, no visible drone)…`);
  const results = [];
  for (const s of SEGMENTS) results.push(await renderSeg(ai, s, apiKey)); // sequential = quota-safe; existing segs reused instantly
  const clips = SEGMENTS.map(([k]) => join(SEGDIR, `${k}.mp4`)).filter((_, i) => results[i]); // keep order, only successful
  if (clips.length < 2) { console.error(`Only ${clips.length} segment(s) rendered — need ≥2 to stitch.`); process.exit(1); }

  try { await access(OUT); await copyFile(OUT, join(HERO, "hero-loop-prev.mp4")); console.log("backed up previous hero-loop.mp4 → hero-loop-prev.mp4"); } catch {}
  console.log(`Stitching ${clips.length} clips with crossfades → hero-loop.mp4 …`);
  await stitch(clips);
  const s = await stat(OUT);
  console.log(`\n✓ hero-loop.mp4 written (${(s.size / 1e6).toFixed(2)} MB, 1080p, ${(clips.length * TRIM - (clips.length - 1) * XF).toFixed(1)}s)`);
  if (clips.length < SEGMENTS.length) console.log(`Note: ${SEGMENTS.length - clips.length} segment(s) failed and were skipped.`);
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
