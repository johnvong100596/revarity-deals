#!/usr/bin/env node
/**
 * TRUE single-take drone fly-through hero via Veo 3.1 (Gemini API) → public/hero/hero-veo.mp4.
 *
 * One continuous shot, no cuts — unlike the stitched 8-segment Higgsfield version. Writes to hero-veo.mp4
 * (not hero-loop.mp4) so the working hero stays intact until you verify, then swap:
 *     cp public/hero/hero-veo.mp4 public/hero/hero-loop.mp4   (back up the old one first)
 *
 * Requires GEMINI_API_KEY with Veo access (paid tier). Veo base clip = 8s; for a longer journey, Veo 3.1
 * can extend +7s up to 20× — see README note at bottom. This script renders the base single take.
 *
 * Usage:  node --env-file=.env.local scripts/render-hero-veo.mjs
 */
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stat, writeFile } from "node:fs/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "hero", "hero-veo.mp4");
const MODEL = process.env.VEO_MODEL || "veo-3.1-generate-preview";
const RES = process.env.VEO_RES || "720p"; // "720p" | "1080p" (1080p forces 8s)

const PROMPT = `A single continuous aerial drone shot, one unbroken take, absolutely no cuts. The camera glides out of a sun-drenched Tulum villa bedroom through open glass doors onto a balcony, then sweeps low and fast over white sand and glassy turquoise surf. It tilts upward and accelerates into a bright blue sky, pushing through a soft sunlit cloud, and emerges high over a glittering Dubai skyline at golden hour, banking gracefully past mirrored skyscrapers toward one warmly glowing penthouse window. Smooth cinematic FPV drone motion, photorealistic, warm editorial color grade, volumetric golden light, gentle atmospheric haze, aspirational luxury short-stay travel mood. No text, no logos, no people.`;

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) { console.error("Missing GEMINI_API_KEY"); process.exit(1); }
  const ai = new GoogleGenAI({ apiKey });

  console.log(`Veo ${MODEL}: single-take fly-through (${RES}, 16:9, 8s)…`);
  let op = await ai.models.generateVideos({
    model: MODEL,
    prompt: PROMPT,
    config: { aspectRatio: "16:9", resolution: RES, durationSeconds: 8 },
  });

  let waited = 0;
  while (!op.done) {
    await new Promise((r) => setTimeout(r, 10000));
    waited += 10;
    console.log(`  …generating (${waited}s elapsed)`);
    op = await ai.operations.getVideosOperation({ operation: op });
  }

  if (op.error) { console.error("Veo error:", JSON.stringify(op.error)); process.exit(1); }
  const vids = op.response?.generatedVideos || [];
  if (!vids.length) { console.error("No video returned. Response:", JSON.stringify(op.response).slice(0, 600)); process.exit(1); }

  try {
    await ai.files.download({ file: vids[0].video, downloadPath: OUT });
  } catch (e) {
    const uri = vids[0].video?.uri || vids[0].video?.videoUri;
    if (!uri) throw e;
    const res = await fetch(uri, { headers: { "x-goog-api-key": apiKey } });
    if (!res.ok) throw new Error(`download ${res.status}`);
    await writeFile(OUT, Buffer.from(await res.arrayBuffer()));
  }

  const s = await stat(OUT);
  console.log(`\n✓ wrote ${OUT} (${(s.size / 1e6).toFixed(2)} MB)`);
  console.log("Next: verify, then swap into hero-loop.mp4.");
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
