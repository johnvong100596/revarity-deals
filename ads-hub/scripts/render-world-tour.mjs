// Reusable hero render: 7 Veo 3.1 segments @1080p (→720p fallback) 16:9, stitched with smooth crossfades
// into a ~18s loop at public/hero/world-tour.mp4. RESUMABLE (skips segments already in the temp dir) and
// rate-limit aware: renders in batches of 2 with 429 backoff (Veo allows ~3 concurrent ops). Reads
// GEMINI_API_KEY from .env.local (never printed). Run from ads-hub:  node scripts/render-world-tour.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADS = path.resolve(__dirname, "..");
const TMP = path.resolve(ADS, "..", ".worldtour-tmp");
const OUT = path.resolve(ADS, "public", "hero", "world-tour.mp4");

function readKey() {
  for (const f of [path.join(ADS, ".env.local"), path.resolve(ADS, "..", ".env.local")]) {
    try { const m = fs.readFileSync(f, "utf8").match(/^GEMINI_API_KEY=(.+)$/m); if (m) return m[1].trim().replace(/^["']|["']$/g, ""); } catch {}
  }
  return process.env.GEMINI_API_KEY || "";
}
const KEY = readKey();
if (!KEY) { console.error("No GEMINI_API_KEY found in .env.local"); process.exit(1); }

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.VEO_MODEL || "veo-3.1-generate-preview";
const CONC = 2; // safe under Veo's ~3-concurrent limit
const hdr = () => ({ "x-goog-api-key": KEY, "Content-Type": "application/json" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fileFor = (name) => path.join(TMP, `${name}.mp4`);
const have = (name) => { try { return fs.statSync(fileFor(name)).size > 1000; } catch { return false; } };

const MASTER = "Ultra-photorealistic cinematic real-estate commercial b-roll, 16:9 landscape, shot on a high-end cinema camera (ARRI Alexa / RED, prime lens), broadcast/film grade, indistinguishable from real footage — no CGI, 3D render, cartoon, or AI-looking artifacts. Luxury short-term-rental aesthetic, revealed through the floor-to-ceiling window or balcony of a beautifully furnished rental — interior foreground, iconic view beyond. Warm golden-hour editorial color grade, soft natural light, shallow depth of field, fine real-world texture. Buttery-smooth, fluid, perfectly stabilized slow camera motion (gimbal / steadicam / dolly), natural motion blur, absolutely no stutter, judder, strobing, warping, or frame-skipping. No on-screen text, captions, logos, or watermark. No people speaking to camera.";
const SEGS = [
  ["dubai", "Dubai penthouse at golden hour: marble and warm wood interior, an infinity-edge balcony pool in the foreground, floor-to-ceiling glass framing the Burj Khalifa and the amber desert skyline. Slow dolly forward toward the window."],
  ["miami", "Miami South Beach Art-Deco condo: sheer white curtains billowing in the ocean breeze, a balcony over the turquoise Atlantic, palms and pastel buildings in late-afternoon sun. Smooth glide toward the open balcony."],
  ["singapore", "Singapore sky-apartment with a private infinity pool; Marina Bay Sands and the glowing Supertrees of Gardens by the Bay beyond at blue-gold dusk. Slow crane up over the pool toward the skyline."],
  ["fuji", "Minimalist Japanese ryokan with tatami and warm wood, an open shoji to a private onsen; snow-capped Mount Fuji beyond, cherry blossoms drifting in soft dawn light. Slow push toward the view."],
  ["danang", "Chic riverside apartment balcony in Da Nang at night over the Han River; the golden Dragon Bridge breathing fire, warm city lights rippling on the water. Smooth track following the fire-breath along the bridge."],
  ["toronto", "Refined downtown Toronto condo with a skyline view at dusk; the CN Tower and city lights flickering on, Lake Ontario beyond, cool dusk blues warmed by interior lamplight. Slow lateral dolly across the glass."],
  ["banff", "Luxury timber-and-glass mountain chalet in Banff, fireplace crackling inside; the mirror-still turquoise of Moraine Lake, snow-dusted peaks and pines reflected, crisp golden morning. Slow push out toward the lake."],
];

async function startSeg(prompt) {
  let lastErr = "";
  for (const resolution of ["1080p", "720p"]) {
    try {
      const res = await fetch(`${BASE}/models/${MODEL}:predictLongRunning`, { method: "POST", headers: hdr(), body: JSON.stringify({ instances: [{ prompt }], parameters: { aspectRatio: "16:9", resolution } }) });
      if (res.ok) { const j = await res.json(); if (j.name) return { op: j.name, resolution }; lastErr = "no operation name"; }
      else { const t = await res.text(); lastErr = `${res.status}: ${t.slice(0, 140)}`; if (res.status === 429) { const e = new Error(lastErr); e.quota = true; throw e; } }
    } catch (e) { if (e.quota) throw e; lastErr = String(e.message || e); }
  }
  throw new Error(lastErr || "start failed");
}
async function poll(op) {
  const res = await fetch(`${BASE}/${op}`, { headers: { "x-goog-api-key": KEY } });
  if (!res.ok) return { status: "rendering" };
  const j = await res.json();
  if (!j.done) return { status: "rendering" };
  if (j.error) return { status: "failed", error: j.error.message || "error" };
  const r = j.response || {};
  const rai = r.generateVideoResponse?.raiMediaFilteredReasons;
  if (Array.isArray(rai) && rai.length) return { status: "failed", error: `content filter: ${rai[0]}` };
  const samples = r.generatedVideos || r.generateVideoResponse?.generatedSamples || r.generatedSamples || r.videos || (r.video ? [r] : []);
  const s = Array.isArray(samples) ? samples[0] : null;
  const uri = s?.video?.uri || s?.video?.videoUri || s?.uri || s?.videoUri || r?.video?.uri || null;
  return uri ? { status: "done", uri } : { status: "failed", error: "no uri in response" };
}
async function download(uri, file) {
  const url = uri.includes("?") ? `${uri}&key=${KEY}` : `${uri}?key=${KEY}`;
  const res = await fetch(url, { headers: { "x-goog-api-key": KEY } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
function ff(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = ""; p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-700)))));
  });
}
async function renderOne(name, scene) {
  if (have(name)) { console.log(`  = ${name}: already rendered, skip`); return; }
  const prompt = `${MASTER} SCENE: ${scene}`;
  let op, resolution;
  for (let a = 0; a < 6; a++) {
    try { ({ op, resolution } = await startSeg(prompt)); break; }
    catch (e) { if (e.quota && a < 5) { console.log(`  ... ${name}: quota, backoff 30s`); await sleep(30000); } else throw e; }
  }
  console.log(`  > ${name}: started @${resolution}`);
  const dl = Date.now() + 9 * 60 * 1000;
  while (Date.now() < dl) {
    await sleep(8000);
    const r = await poll(op);
    if (r.status === "done") { await download(r.uri, fileFor(name)); console.log(`  ok ${name}: downloaded (${(fs.statSync(fileFor(name)).size / 1e6).toFixed(1)}MB)`); return; }
    if (r.status === "failed") throw new Error(r.error);
  }
  throw new Error("timeout");
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const todo = SEGS.filter(([name]) => !have(name));
  console.log(`World Tour render — ${SEGS.length - todo.length}/${SEGS.length} already present, rendering ${todo.length} (batches of ${CONC}).`);
  for (let i = 0; i < todo.length; i += CONC) {
    const batch = todo.slice(i, i + CONC);
    await Promise.all(batch.map(([name, scene]) => renderOne(name, scene).catch((e) => console.log(`  x ${name}: ${String(e.message || e).slice(0, 120)}`))));
  }
  const ok = SEGS.map(([name]) => ({ name, file: fileFor(name) })).filter((s) => have(s.name));
  console.log(`Ready to stitch ${ok.length}/${SEGS.length}: ${ok.map((s) => s.name).join(", ")}`);
  if (ok.length < 2) { console.error("Not enough segments to stitch."); process.exit(2); }

  const CLIP = 3, XF = 0.5, n = ok.length;
  const inputs = [];
  ok.forEach((s) => inputs.push("-ss", "2", "-t", String(CLIP), "-i", s.file));
  let fc = "";
  for (let i = 0; i < n; i++) fc += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30,format=yuv420p[v${i}];`;
  let prev = "v0";
  for (let i = 1; i < n; i++) { const out = i === n - 1 ? "vout" : `x${i}`; fc += `[${prev}][v${i}]xfade=transition=fade:duration=${XF}:offset=${((CLIP - XF) * i).toFixed(2)}[${out}];`; prev = out; }
  const args = [...inputs, "-filter_complex", fc.replace(/;$/, ""), "-map", "[vout]", "-an", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", "-y", OUT];
  console.log("Stitching (crossfade)…");
  try { await ff(args); }
  catch (e) {
    console.log("xfade failed, hard-cut concat fallback:", e.message.slice(0, 160));
    const norm = [];
    for (let i = 0; i < n; i++) { const nf = path.join(TMP, `n${i}.mp4`); await ff(["-ss", "2", "-t", String(CLIP), "-i", ok[i].file, "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30,format=yuv420p", "-an", "-c:v", "libx264", "-crf", "20", "-preset", "fast", "-pix_fmt", "yuv420p", "-y", nf]); norm.push(nf); }
    const list = path.join(TMP, "concat.txt"); fs.writeFileSync(list, norm.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
    await ff(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", "-y", OUT]);
  }
  await new Promise((resolve) => { const p = spawn(ffmpegPath, ["-i", OUT], { stdio: ["ignore", "ignore", "pipe"] }); let e = ""; p.stderr.on("data", (d) => (e += d)); p.on("close", () => { const dur = e.match(/Duration: [^,]+/), dim = e.match(/, (\d+x\d+)/); console.log(`OUTPUT ${OUT}\n  ${dur ? dur[0] : ""} ${dim ? dim[1] : ""} size=${(fs.statSync(OUT).size / 1e6).toFixed(2)}MB`); resolve(); }); });
  console.log(`DONE — ${ok.length} segments stitched.`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
