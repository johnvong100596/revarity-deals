#!/usr/bin/env node
/**
 * Revarity Creative Engine — cinematic hero: still → motion (Higgsfield image→video).
 * --------------------------------------------------------------------------------
 * Turns the 8 cinematic stills (output/cinematic/NN.png, made by cinematic.mjs) into short
 * looping motion clips (output/cinematic/NN.mp4) by driving the Higgsfield CLI (`hf`), which
 * handles the upload, auth/token-refresh, job creation and polling for us.
 *
 * This step does NOT publish anything (D-04). It only produces local mp4s the studio-lab hero
 * (studio-lab.mjs) consumes. It SPENDS Higgsfield credits — run `--cost` first to estimate.
 *
 * Usage:
 *   node creative-engine/video.mjs --cost                 # estimate credits for all scenes, generate nothing
 *   node creative-engine/video.mjs                        # generate any MISSING clips on $HF_MODEL
 *   node creative-engine/video.mjs --only 01-bedroom-city # just one scene
 *   node creative-engine/video.mjs --model seedance1_5 --suffix .seedance  # bake-off variant (NN.seedance.mp4)
 *   node creative-engine/video.mjs --force                # regenerate even if the mp4 already exists
 *
 * Env (flags win): HF_MODEL, HF_DURATION, HF_ASPECT, HF_RESOLUTION, HF_MODE, HF_CONCURRENCY, HF_BIN
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CIN = path.join(__dirname, "output", "cinematic");

// ── resolve the hf binary (env → npm-global vendor → PATH) ───────────────────────
function resolveHf() {
  if (process.env.HF_BIN && fs.existsSync(process.env.HF_BIN)) return process.env.HF_BIN;
  const vend = process.platform === "win32" ? "hf.exe" : "hf";
  const guess = path.join(process.env.APPDATA || "", "npm", "node_modules", "@higgsfield", "cli", "vendor", vend);
  if (fs.existsSync(guess)) return guess;
  return process.platform === "win32" ? "higgsfield.cmd" : "higgsfield"; // fall back to PATH
}
const HF = resolveHf();

// ── camera-motion prompt per scene (subtle, slow, premium, loop-friendly) ────────
const TAIL = "Subtle, slow, premium cinematic motion. No people, no text, no logos.";
const SCENES = [
  ["01-bedroom-city", `Slow cinematic push-in toward the floor-to-ceiling window and the glittering city skyline beyond; gentle parallax, drifting clouds, faint light shimmer on the glass. ${TAIL}`],
  ["02-over-city",    `Smooth aerial glide forward over the glowing city skyline at dusk; clouds drift, distant lights twinkle, a slow gentle bank. ${TAIL}`],
  ["03-sky",          `Soaring gently upward through sunlit clouds, slow forward flight, soft volumetric light rays, a drifting lens flare. ${TAIL}`],
  ["04-tulum-aerial", `Slow aerial descent toward the turquoise Tulum coastline; waves roll in, palms sway, sunlight shimmers across the water. ${TAIL}`],
  ["05-villa-door",   `Slow dolly toward the open beachfront villa entrance; palm shadows sway, a soft breeze moves the foliage, golden-hour light shifts. ${TAIL}`],
  ["06-ski-resort",   `Gentle push-in through softly falling snow toward the warm-lit alpine chalets; snowflakes drift, window lights glow. ${TAIL}`],
  ["07-cottage-fire", `Slow drift toward the glowing fireplace; flames flicker and dance, warm light breathes across the timber interior. ${TAIL}`],
  ["08-highrise-night",`Slow parallax pan across floor-to-ceiling windows over a sea of city lights at night; distant lights twinkle, faint reflections drift. ${TAIL}`],
];

// ── args / env ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const COST = has("--cost");
const FORCE = has("--force");
const ONLY = val("--only", null);
const MODEL = val("--model", process.env.HF_MODEL || "cinematic_studio_video_v2");
const SUFFIX = val("--suffix", "");                                  // ".seedance" → NN.seedance.mp4
const DURATION = val("--duration", process.env.HF_DURATION || "5");
const ASPECT = val("--aspect", process.env.HF_ASPECT || "16:9");
const RES = val("--resolution", process.env.HF_RESOLUTION || "");
const MODE = val("--mode", process.env.HF_MODE || "std");
const TIMEOUT = val("--timeout", "20m");
const CONC = Math.max(1, Number(val("--concurrency", process.env.HF_CONCURRENCY || "3")));

// model-specific param assembly (the CLI maps --image to each model's image input)
function paramsFor(model) {
  const p = ["--aspect_ratio", ASPECT, "--duration", String(DURATION)];
  if (RES && /seedance|wan/i.test(model)) p.push("--resolution", RES);  // only these accept resolution
  if (/kling/i.test(model)) p.push("--sound", "false");                 // muted hero — kling defaults sound on
  if (/cinematic_studio_video_v2/.test(model)) p.push("--mode", MODE);  // pro|std
  return p;
}

// ── hf runner (async spawn so clips render concurrently) ─────────────────────────
function hf(args) {
  return new Promise((resolve, reject) => {
    const ch = spawn(HF, args, { windowsHide: true });
    let out = "", err = "";
    ch.stdout.on("data", (d) => (out += d));
    ch.stderr.on("data", (d) => (err += d));
    ch.on("error", reject);
    ch.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`hf exit ${code}: ${err.trim().slice(-400)}`))));
  });
}
function parseJson(out) {
  const i = out.search(/[[{]/);                 // tolerate any progress text before the JSON
  if (i < 0) throw new Error("no JSON in hf output: " + out.slice(0, 200));
  return JSON.parse(out.slice(i));
}
// recursively find the first video URL anywhere in the result JSON
function findMediaUrl(v) {
  if (typeof v === "string") return /^https?:\/\/\S+\.(mp4|mov|webm)(\?\S*)?$/i.test(v) ? v : null;
  if (Array.isArray(v)) { for (const x of v) { const u = findMediaUrl(x); if (u) return u; } return null; }
  if (v && typeof v === "object") { for (const k of Object.keys(v)) { const u = findMediaUrl(v[k]); if (u) return u; } return null; }
  return null;
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// ── cost mode ─────────────────────────────────────────────────────────────────────
async function costAll(list) {
  let total = 0;
  for (const [n, p] of list) {
    const png = path.join(CIN, `${n}.png`);
    if (!fs.existsSync(png)) { console.log(`  - ${n}: (no still)`); continue; }
    try {
      const j = parseJson(await hf(["generate", "cost", MODEL, "--prompt", p, "--image", png, ...paramsFor(MODEL), "--json"]));
      const c = j.credits_exact ?? j.credits ?? 0;
      total += Number(c);
      console.log(`  ${n}: ${c} credits`);
    } catch (e) { console.log(`  ${n}: cost failed — ${e.message}`); }
  }
  console.log(`\nTOTAL ~${total} credits for ${list.length} scene(s) on ${MODEL} (${ASPECT}, ${DURATION}s${RES ? `, ${RES}` : ""}).`);
}

// ── generate mode (bounded concurrency) ─────────────────────────────────────────────
async function generate(list) {
  const jobs = [];
  for (const [n, p] of list) {
    const png = path.join(CIN, `${n}.png`);
    const mp4 = path.join(CIN, `${n}${SUFFIX}.mp4`);
    if (!fs.existsSync(png)) { console.log(`  ✗ ${n}: no still — skip`); continue; }
    if (fs.existsSync(mp4) && !FORCE) { console.log(`  • ${n}: ${path.basename(mp4)} exists — skip`); continue; }
    jobs.push({ n, p, png, mp4 });
  }
  console.log(`video: model=${MODEL} | ${jobs.length} clip(s) | conc=${CONC} | ${ASPECT} ${DURATION}s${RES ? " " + RES : ""}`);
  if (!jobs.length) return;
  let ok = 0, err = 0, idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const job = jobs[idx++];
      try {
        const out = await hf(["generate", "create", MODEL, "--prompt", job.p, "--image", job.png,
          ...paramsFor(MODEL), "--wait", "--wait-timeout", TIMEOUT, "--json"]);
        const url = findMediaUrl(parseJson(out));
        if (!url) throw new Error("no media url in result: " + out.slice(0, 240));
        const bytes = await download(url, job.mp4);
        console.log(`  ✓ ${job.n} → ${path.basename(job.mp4)} (${(bytes / 1e6).toFixed(1)}MB)`);
        ok++;
      } catch (e) { console.error(`  ✗ ${job.n}: ${e.message}`); err++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, worker));
  console.log(`done: ${ok} rendered, ${err} failed. → output/cinematic/*.mp4`);
  console.log("Next: node creative-engine/studio-lab.mjs  (hero picks up the clips). Engine does not publish. (D-04)");
}

// ── main ────────────────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(CIN)) { console.error("no output/cinematic — run cinematic.mjs first."); process.exit(2); }
  const list = SCENES.filter(([n]) => !ONLY || n === ONLY);
  if (!list.length) { console.error(`--only ${ONLY}: no such scene. Valid: ${SCENES.map(([n]) => n).join(", ")}`); process.exit(2); }
  console.log(`hf: ${HF}`);
  if (COST) await costAll(list); else await generate(list);
})();
