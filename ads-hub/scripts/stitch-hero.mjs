#!/usr/bin/env node
/**
 * Duration-aware stitch of the 5 hero beats (mixed Veo 1080p + Higgsfield clips of differing lengths)
 * into public/hero/hero-loop.mp4, with crossfades. Probes each clip's real duration so the xfade offsets
 * are correct even when clip lengths differ. Normalizes every beat to 1920×1080 / 24fps.
 *
 * Usage: node scripts/stitch-hero.mjs
 */
import ffmpegPath from "ffmpeg-static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { stat, copyFile, access } from "node:fs/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HERO = join(ROOT, "public", "hero");
const SEGDIR = join(HERO, "veo-seg");
const OUT = join(HERO, "hero-loop.mp4");
const ORDER = ["1-villa-beach", "2-cloud-dubai", "3-danang-dragon", "4-ski-cottage", "5-night-skyline"];
const MAXT = 6.5, XF = 1.0; // cap each beat at 6.5s of screen time; 1.0s crossfades

function run(args, capture = false) {
  return new Promise((res, rej) => {
    let out = "";
    const p = spawn(ffmpegPath, args, { stdio: capture ? ["ignore", "ignore", "pipe"] : ["ignore", "ignore", "inherit"] });
    if (capture) p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => (code === 0 || capture ? res(out) : rej(new Error(`ffmpeg ${code}`))));
  });
}
async function duration(file) {
  const err = await run(["-i", file.replace(/\\/g, "/")], true);
  const m = err.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 8;
}

async function main() {
  const clips = [];
  for (const k of ORDER) { const p = join(SEGDIR, `${k}.mp4`); try { await access(p); clips.push(p); } catch { console.log(`(skip missing ${k})`); } }
  if (clips.length < 2) { console.error("need ≥2 clips"); process.exit(1); }

  const T = [];
  for (const c of clips) { const d = await duration(c); T.push(Math.max(2, Math.min(d - 0.1, MAXT))); }
  console.log("beat screen-times:", clips.map((c, i) => `${c.split(/[\\/]/).pop()}=${T[i].toFixed(1)}s`).join("  "));

  const trims = clips.map((_, i) => `[${i}:v]trim=0:${T[i].toFixed(3)},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=24,format=yuv420p[v${i}]`).join(";");
  let chain = "", prev = "v0", cum = T[0];
  for (let i = 1; i < clips.length; i++) {
    const off = (cum - XF).toFixed(3);                 // offset_k = (Σ T[0..k-1]) − XF, in the running timeline
    const out = i === clips.length - 1 ? "vout" : `x${i}`;
    chain += `;[${prev}][v${i}]xfade=transition=fade:duration=${XF}:offset=${off}[${out}]`;
    prev = out; cum += (T[i] - XF);
  }
  const total = (T.reduce((a, b) => a + b, 0) - (clips.length - 1) * XF).toFixed(1);

  try { await access(OUT); await copyFile(OUT, join(HERO, "hero-loop-prev.mp4")); } catch {}
  const args = ["-y", ...clips.flatMap((c) => ["-i", c.replace(/\\/g, "/")]),
    "-filter_complex", trims + chain, "-map", clips.length > 1 ? "[vout]" : "[v0]",
    "-c:v", "libx264", "-crf", "29", "-maxrate", "4M", "-bufsize", "8M", "-preset", "slow",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0", "-g", "48", "-movflags", "+faststart", "-an", OUT.replace(/\\/g, "/")];
  console.log(`Stitching ${clips.length} beats → hero-loop.mp4 (~${total}s)…`);
  await run(args);
  const s = await stat(OUT);
  console.log(`\n✓ hero-loop.mp4 written (${(s.size / 1e6).toFixed(2)} MB, 1080p, ~${total}s)`);
}
main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
