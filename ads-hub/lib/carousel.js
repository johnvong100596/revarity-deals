/**
 * lib/carousel.js — the 5-slide carousel PNG export (OPERATOR-PLAYBOOK step 4:
 * "Carousel PNG set (5 slides) — IG carousel + TikTok photo mode").
 *
 * Slide arc mirrors the shipped U3/U4 carousels, sourced ONLY from the locked
 * money-arc script (already claims-checked by moneyArc.buildScript — no free text
 * enters here, so nothing can drift past the claims lock):
 *   S1 hook (real photo bg) → S2 problem (photo) → S3 "we do all of it" (photo)
 *   → S4 offer + disclaimer (black/gold card) → S5 DM "SETUP" (black/gold card)
 *
 * Photo slides: white bold text + drop shadow, no box (U3 style). Card slides:
 * black bg, gold wordmark/accents (U4 style). Same ffmpeg/fonts runtime as
 * lib/render.js — one -frames:v 1 PNG per slide.
 */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { SIZES } from "./render.js";

const GOLD = process.env.RENDER_GOLD || "d9a859"; // brand.json v2.0 gold (D-14)
const SHADOW = "shadowcolor=black@0.65:shadowx=3:shadowy=3";

const ffmpegBin = () => process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const ffPath = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:");

function fonts() {
  const bold = process.env.FONT_BOLD_PATH;
  const reg = process.env.FONT_REG_PATH || bold;
  const display = process.env.FONT_DISPLAY_PATH || bold;
  if (!bold) throw new Error("fonts_not_configured: set FONT_BOLD_PATH (+ optional FONT_REG_PATH/FONT_DISPLAY_PATH) to .ttf files for carousel slides.");
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

// drawtext has no auto-wrap — break on word boundaries so long hooks stay inside
// the 1080 frame at display sizes. maxChars tuned per fontsize below.
function wrap(text, maxChars) {
  const words = String(text || "").trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

async function capFile(dir, name, text) {
  const f = path.join(dir, `${name}.txt`);
  await writeFile(f, String(text || "").replace(/\r/g, ""), "utf8");
  return f;
}

/**
 * Render the 5-slide set for one placement.
 *   photos: [{ name, buffer }] real Drive photos (>=1; cycled across the 3 photo slides)
 *   script: moneyArc draft (captions[], cta, disclaimer) — the ONLY text source
 *   size:   "feed" (1080x1350, IG carousel) | "reels" (1080x1920, TikTok photo mode)
 * Returns [{ name, buffer }] of 5 PNGs, slide order S1..S5.
 */
export async function renderCarouselSet({ photos = [], script, size = "feed" }) {
  if (!script) throw new Error("carousel: script required");
  if (!photos.length) throw new Error("carousel: at least one real photo required (Drive bridge)");
  const dims = SIZES[size];
  if (!dims) throw new Error(`carousel: unknown size "${size}"`);
  const { w: W, h: H } = dims;
  const FIT = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
  const bin = ffmpegBin();
  const F = fonts();
  const dir = await mkdtemp(path.join(os.tmpdir(), "rev-carousel-"));

  // Locked copy per slide (captions = [hook, problem-hook, $30k, we-do-it-all, offer*]).
  const caps = script.captions || [];
  const slides = [
    { kind: "photo", main: caps[0] || script.hook || "" },
    { kind: "photo", main: caps[1] || "", sub: caps[2] || "" },
    { kind: "photo", main: caps[3] || "", sub: "design · furniture · photography · launch" },
    { kind: "card", main: caps[4] || "", sub: script.disclaimer || "" },
    { kind: "card", main: `DM “${(script.cta || "").match(/"([A-Z]+)"/)?.[1] || "SETUP"}”`, sub: "Every detail matters." },
  ];

  try {
    const out = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const png = path.join(dir, `s${i + 1}.png`);
      const mainf = await capFile(dir, `main${i}`, wrap(s.main, 18));
      const subf = s.sub ? await capFile(dir, `sub${i}`, wrap(s.sub, s.kind === "card" ? 44 : 30)) : null;
      const midY = Math.round(H * 0.42);
      let vf;
      if (s.kind === "photo") {
        const photo = photos[i % photos.length];
        const img = path.join(dir, `bg${i}${path.extname(photo.name || "") || ".jpg"}`);
        await writeFile(img, photo.buffer);
        // U3 style: white bold + drop shadow, no box; soft darken so text reads on bright rooms.
        vf = [
          `${FIT},eq=brightness=-0.06`,
          `drawtext=textfile='${ffPath(mainf)}':fontfile='${ffPath(F.bold)}':fontcolor=white:fontsize=72:line_spacing=16:${SHADOW}:x=(w-text_w)/2:y=${midY}-text_h/2`,
          subf ? `drawtext=textfile='${ffPath(subf)}':fontfile='${ffPath(F.reg)}':fontcolor=white@0.92:fontsize=42:line_spacing=12:${SHADOW}:x=(w-text_w)/2:y=${midY}+text_h/2+140` : null,
        ].filter(Boolean).join(",");
        await run(bin, ["-y", "-i", img, "-vf", vf, "-frames:v", "1", png], { cwd: dir });
      } else {
        // U4 style: black card, gold wordmark + gold/white statements, disclaimer small print.
        const isOffer = i === 3;
        vf = [
          `drawtext=text='Revarity':fontfile='${ffPath(F.display)}':fontcolor=0x${GOLD}:fontsize=64:x=(w-text_w)/2:y=${Math.round(H * 0.16)}`,
          `drawtext=textfile='${ffPath(mainf)}':fontfile='${ffPath(F.bold)}':fontcolor=${isOffer ? "white" : `0x${GOLD}`}:fontsize=${isOffer ? 64 : 88}:line_spacing=16:x=(w-text_w)/2:y=${midY}-text_h/2`,
          subf ? `drawtext=textfile='${ffPath(subf)}':fontfile='${ffPath(F.reg)}':fontcolor=white@${isOffer ? "0.65" : "0.9"}:fontsize=${isOffer ? 26 : 40}:line_spacing=8:x=(w-text_w)/2:y=${Math.round(H * (isOffer ? 0.74 : 0.62))}` : null,
        ].filter(Boolean).join(",");
        await run(bin, ["-y", "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:d=1`, "-vf", vf, "-frames:v", "1", png], { cwd: dir });
      }
      out.push({ name: `s${i + 1}`, buffer: await readFile(png) });
    }
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
