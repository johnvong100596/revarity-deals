#!/usr/bin/env node
/**
 * Re-render the Da Nang + ski/cottage beats at NATIVE Veo 3.1 1080p (to match the other 3 Veo beats),
 * replacing the Higgsfield stand-ins. NON-DESTRUCTIVE: renders to *-veo.mp4 temp files and only swaps
 * them into 3-danang-dragon.mp4 / 4-ski-cottage.mp4 if BOTH succeed (backing up the Higgsfield ones to
 * *-hf.mp4). On persistent 429 it prints QUOTA_STILL_CAPPED and exits 1, leaving the working hero intact.
 *
 * Usage: node --env-file=.env.local scripts/retry-veo-beats.mjs
 */
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stat, writeFile, copyFile } from "node:fs/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEGDIR = join(ROOT, "public", "hero", "veo-seg");
const MODEL = process.env.VEO_MODEL || "veo-3.1-generate-preview";

const STYLE = " First-person aerial flying-camera point of view, as if the viewer is gliding through the air; smooth cinematic motion, photorealistic, ultra-detailed, sharp, high dynamic range, warm editorial color grade. Absolutely NO drone, aircraft, helicopter, rotor blades, propellers, or drone shadow anywhere in frame. No text, no logos, no people in focus.";
const BEATS = [
  ["3-danang-dragon", "Downtown Da Nang, Vietnam at night during the famous Dragon Bridge fire show. The iconic golden Dragon Bridge arches over the Han River; the dragon's head breathes a steady, controlled stream of warm orange fire forward into the night air, graceful glowing flames with light wisps of smoke, reflecting on the calm water, the lit riverside skyline behind. Glide smoothly along and past the bridge. The fire is an elegant performance — absolutely NO explosion, NO blast, NO fireball, NO mushroom cloud in the sky." + STYLE],
  ["4-ski-cottage", "Rise over a snow-dusted alpine ski resort glowing in soft pink alpenglow at dusk, then drift down past the slopes toward a cozy timber cottage with warm firelight flickering in its windows." + STYLE],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ATTEMPTS = Math.max(1, parseInt(process.env.VEO_ATTEMPTS || "8", 10)); // set VEO_ATTEMPTS=1 for a cheap fast-fail poll

async function startWithRetry(ai, prompt, key) {
  for (let a = 1; a <= ATTEMPTS; a++) {
    try {
      return await ai.models.generateVideos({ model: MODEL, prompt, config: { aspectRatio: "16:9", resolution: "1080p", durationSeconds: 8 } });
    } catch (e) {
      const msg = String(e?.message || e);
      if (/429|quota|RESOURCE_EXHAUSTED|rate/i.test(msg) && a < ATTEMPTS) {
        console.log(`  [${key}] 429 — wait 75s (attempt ${a})`);
        await sleep(75000);
        continue;
      }
      throw e;
    }
  }
  throw new Error("create exhausted");
}

async function renderBeat(ai, key, prompt, apiKey) {
  const out = join(SEGDIR, `${key}-veo.mp4`);
  let op = await startWithRetry(ai, prompt, key);
  let w = 0;
  while (!op.done) { await sleep(10000); w += 10; console.log(`  [${key}] ${w}s`); op = await ai.operations.getVideosOperation({ operation: op }); }
  if (op.error) throw new Error(JSON.stringify(op.error));
  const v = op.response?.generatedVideos?.[0]?.video;
  if (!v) throw new Error("no video");
  try { await ai.files.download({ file: v, downloadPath: out }); }
  catch (e) { const uri = v?.uri; if (!uri) throw e; const r = await fetch(uri, { headers: { "x-goog-api-key": apiKey } }); if (!r.ok) throw new Error(`dl ${r.status}`); await writeFile(out, Buffer.from(await r.arrayBuffer())); }
  const s = await stat(out);
  if (s.size < 100000) throw new Error("tiny file");
  console.log(`  [${key}] ✓ (${(s.size / 1e6).toFixed(1)} MB)`);
  return out;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) { console.error("Missing GEMINI_API_KEY"); process.exit(1); }
  const ai = new GoogleGenAI({ apiKey });

  const temps = [];
  try {
    for (const [key, prompt] of BEATS) {
      console.log(`Veo 1080p: ${key}…`);
      temps.push([key, await renderBeat(ai, key, prompt, apiKey)]);
    }
  } catch (e) {
    console.log(`QUOTA_STILL_CAPPED — ${String(e.message || e).slice(0, 160)}`);
    process.exit(1);
  }

  // both succeeded → back up Higgsfield versions and swap in the Veo ones
  for (const [key, tmp] of temps) {
    const dest = join(SEGDIR, `${key}.mp4`);
    try { await copyFile(dest, join(SEGDIR, `${key}-hf.mp4`)); } catch {}
    await copyFile(tmp, dest);
  }
  console.log("READY_TO_STITCH — both beats now native Veo 1080p");
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
