/**
 * lib/render.js — the "real-photo bridge" slideshow render (ffmpeg port of
 * build_vo_ads.sh). Turns REAL listing photos (from Drive) + a locked money-arc
 * script + Zoe VO into a 1080x1920 vertical ad: hard-cut stills montage, burned
 * safe-zone captions, per-beat VO, gold end card + disclaimer, subtle bass bed.
 * No AI motion — deterministic, cheap, on-brand.
 *
 * Difference from the original script: the slide BACKGROUNDS are the real Drive
 * photos (scaled/cropped to frame), not hand-made still_*.png — that's the bridge.
 *
 * Runtime: shells to ffmpeg (ffmpeg-static, override FFMPEG_PATH). drawtext needs
 * real font files — set FONT_BOLD_PATH / FONT_REG_PATH / FONT_DISPLAY_PATH. When
 * a runtime piece is missing (ffmpeg, fonts) it throws a clear error; the batch
 * catches it and reports, never half-writes a draft. VO is optional: no VO →
 * caption-only silent beats, flagged voPending (honest, still reviewable).
 */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

const GOLD = process.env.RENDER_GOLD || "d9a859"; // brand-kit gold (brand.json v2.0, D-14)
const FPS = 30;
const CAPBOX = "fontcolor=white:box=1:boxcolor=black@0.42:boxborderw=24";

// The two playbook placements. Every ad ships in BOTH (OPERATOR-PLAYBOOK step 4):
// 1080x1920 Reels/TikTok/Stories + 1080x1350 IG feed. Vertical y-positions were
// tuned on 1920 and scale by height, so the reels output is unchanged.
export const SIZES = {
  reels: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
};
const sizeOf = (size) => {
  const s = SIZES[size];
  if (!s) throw new Error(`render: unknown size "${size}" (use ${Object.keys(SIZES).join("/")})`);
  return s;
};
const scaleY = (y, H) => Math.round((y * H) / 1920);

// Fixed per-beat durations (seconds) — the money-arc rhythm from build_vo_ads.sh.
// VO for a beat is padded/trimmed to its slide; a beat with no VO plays silent.
const BEATS = [
  { key: "hook", dur: 4.6 },
  { key: "problem", dur: 4.0 },
  { key: "weDoItAll", dur: 3.2 },
  { key: "cta", dur: 4.6 },
];
const END_CARD_DUR = 1.8;

function ffmpegBin() {
  // ffmpeg-static's default export is the bundled binary path; FFMPEG_PATH wins
  // (e.g. a system ffmpeg on a worker/host).
  return process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
}

function fonts() {
  const bold = process.env.FONT_BOLD_PATH;
  const reg = process.env.FONT_REG_PATH || bold;
  const display = process.env.FONT_DISPLAY_PATH || bold;
  if (!bold) throw new Error("fonts_not_configured: set FONT_BOLD_PATH (+ optional FONT_REG_PATH/FONT_DISPLAY_PATH) to .ttf files for burned captions.");
  return { bold, reg, display };
}

function run(bin, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", (e) => reject(new Error(`ffmpeg spawn failed (${bin}): ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-500)}`))));
  });
}

// ffmpeg drawtext reads caption text from a file (textfile=) so punctuation/
// unicode can't break the filter string. Returns the temp path.
async function capFile(dir, name, text) {
  const f = path.join(dir, `${name}.txt`);
  await writeFile(f, String(text || "").replace(/\r/g, ""), "utf8");
  return f;
}

// ffmpeg on Windows wants forward-slashed, escaped paths inside filter args.
const ffPath = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

/**
 * Render one money-arc ad.
 *   photos:   [{ name, buffer }] real Drive photos (>=1; cycled across beats)
 *   script:   moneyArc draft (voLines[], captions[], disclaimer, endCard, cta)
 *   voClips:  [{ buffer, provider, voice }] aligned to voLines, or [] for none
 *   size:     "reels" (1080x1920, default) | "feed" (1080x1350)
 * Returns { buffer, manifest }. Throws on missing ffmpeg/fonts/photos.
 */
export async function renderMoneyArcAd({ photos = [], script, voClips = [], size = "reels" }) {
  if (!script) throw new Error("render: script required");
  if (!photos.length) throw new Error("render: at least one real photo required (Drive bridge)");
  const { w: W, h: H } = sizeOf(size);
  const FIT = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
  const bin = ffmpegBin();
  const F = fonts();
  const dir = await mkdtemp(path.join(os.tmpdir(), "rev-render-"));
  const voProvider = voClips.find((v) => v?.provider)?.provider || null;
  // pending if ANY beat lacks audio — a partial VO set (e.g. live TTS died mid-batch) still
  // leaves silent beats, so it must not read as fully voiced.
  const voPending = BEATS.some((_, i) => !voClips[i]?.buffer);

  try {
    // Stage photos (one per beat, cycled) + VO clips.
    const beatFiles = [];
    for (let i = 0; i < BEATS.length; i++) {
      const photo = photos[i % photos.length];
      const img = path.join(dir, `bg${i}${path.extname(photo.name || "") || ".jpg"}`);
      await writeFile(img, photo.buffer);
      const caption = (script.captions && script.captions[i]) || (script.voLines && script.voLines[i]) || "";
      const capf = await capFile(dir, `cap${i}`, caption);
      let vo = null;
      if (voClips[i]?.buffer) {
        vo = path.join(dir, `vo${i}.mp3`);
        await writeFile(vo, voClips[i].buffer);
      }
      beatFiles.push({ img, capf, vo, dur: BEATS[i].dur });
    }

    // Build each beat: photo bg → fit → burn caption → audio (VO padded/trimmed, or silence).
    const parts = [];
    for (let i = 0; i < beatFiles.length; i++) {
      const b = beatFiles[i];
      const out = path.join(dir, `beat${i}.mp4`);
      const drawtext = `drawtext=textfile='${ffPath(b.capf)}':fontfile='${ffPath(F.bold)}':fontsize=52:line_spacing=12:${CAPBOX}:x=(w-text_w)/2:y=h-${scaleY(560, H)}`;
      const args = ["-y", "-loop", "1", "-framerate", String(FPS), "-t", String(b.dur), "-i", b.img];
      if (b.vo) args.push("-i", b.vo);
      else args.push("-f", "lavfi", "-t", String(b.dur), "-i", "anullsrc=r=48000:cl=stereo");
      const aChain = b.vo ? "[1:a]apad,atrim=0:" + b.dur + ",asetpts=N/SR/TB[a]" : "[1:a]atrim=0:" + b.dur + "[a]";
      args.push(
        "-filter_complex",
        `[0:v]${FIT},setsar=1,${drawtext},format=yuv420p[v];${aChain}`,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", String(FPS),
        "-c:a", "aac", "-ar", "48000", "-ac", "2", "-t", String(b.dur), out,
      );
      await run(bin, args, { cwd: dir });
      parts.push(out);
    }

    // End card: gold wordmark + claim + DM + disclaimer on black.
    const endOut = path.join(dir, "endcard.mp4");
    const claimf = await capFile(dir, "claim", (script.cta || "").replace(/\s+DM.*/i, "").trim() || "$0 down for qualified properties");
    const dmf = await capFile(dir, "dm", "DM “SETUP”");
    const discf = await capFile(dir, "disc", script.disclaimer || "");
    const endDraw = [
      `drawtext=text='Revarity':fontfile='${ffPath(F.display)}':fontcolor=0x${GOLD}:fontsize=112:x=(w-text_w)/2:y=${scaleY(600, H)}`,
      `drawtext=textfile='${ffPath(claimf)}':fontfile='${ffPath(F.bold)}':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=${scaleY(820, H)}`,
      `drawtext=textfile='${ffPath(dmf)}':fontfile='${ffPath(F.bold)}':fontcolor=0x${GOLD}:fontsize=66:x=(w-text_w)/2:y=${scaleY(910, H)}`,
      `drawtext=textfile='${ffPath(discf)}':fontfile='${ffPath(F.reg)}':fontcolor=white@0.65:fontsize=26:line_spacing=8:x=(w-text_w)/2:y=${scaleY(1440, H)}`,
      "format=yuv420p",
    ].join(",");
    await run(bin, [
      "-y", "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:d=${END_CARD_DUR}:r=${FPS}`,
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-filter_complex", `[0:v]${endDraw}[v]`, "-map", "[v]", "-map", "1:a",
      "-t", String(END_CARD_DUR), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-ar", "48000", "-ac", "2", endOut,
    ], { cwd: dir });
    parts.push(endOut);

    // Concat all beats + end card.
    const listf = path.join(dir, "list.txt");
    await writeFile(listf, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"), "utf8");
    const raw = path.join(dir, "raw.mp4");
    await run(bin, ["-y", "-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", raw], { cwd: dir });

    // Subtle low bass bed under the VO (VO stays clear).
    const total = BEATS.reduce((s, b) => s + b.dur, 0) + END_CARD_DUR;
    const final = path.join(dir, "final.mp4");
    await run(bin, [
      "-y", "-i", raw, "-f", "lavfi", "-t", String(total), "-i", "sine=f=52",
      "-filter_complex", "[1:a]tremolo=f=2.1:d=0.85,lowpass=f=120,volume=0.06,aformat=sample_rates=48000:channel_layouts=stereo[b];[0:a][b]amix=inputs=2:duration=first:normalize=0[a]",
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", final,
    ], { cwd: dir });

    const buffer = await readFile(final);
    return {
      buffer,
      manifest: {
        format: `${W}x${H}`,
        size,
        durationSec: Math.round(total * 10) / 10,
        beats: BEATS.map((b) => b.key),
        photosUsed: Math.min(photos.length, BEATS.length),
        voProvider,
        voPending,
      },
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
