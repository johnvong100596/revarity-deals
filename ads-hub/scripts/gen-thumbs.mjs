// Generate STR-themed thumbnails for the format tiles + setting cards via the Gemini image API
// (GEMINI_API_KEY from .env.local — no Anthropic needed). Resumable (skips existing). Run from ads-hub:
//   node scripts/gen-thumbs.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADS = path.resolve(__dirname, "..");
function readKey() {
  for (const f of [path.join(ADS, ".env.local"), path.resolve(ADS, "..", ".env.local")]) {
    try { const m = fs.readFileSync(f, "utf8").match(/^GEMINI_API_KEY=(.+)$/m); if (m) return m[1].trim().replace(/^["']|["']$/g, ""); } catch {}
  }
  return process.env.GEMINI_API_KEY || "";
}
const KEY = readKey();
if (!KEY) { console.error("No GEMINI_API_KEY"); process.exit(1); }
const MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-image-preview";
const SUFFIX = "Ultra-photorealistic, premium luxury short-term-rental / Airbnb aesthetic, warm editorial color grade, soft natural light, vertical 4:5 portrait composition. Absolutely no on-screen text, captions, logos, or watermark. No cartoon / 3D-render / AI-looking artifacts.";

const FORMATS = [
  ["cinematic-tv-spot", "A cinematic broadcast-grade film still of a stunning luxury short-term rental at golden hour, sweeping commercial look."],
  ["ugc-host", "A confident, natural female creator holding a phone selfie-style in a beautifully furnished modern Airbnb living room, casual UGC look."],
  ["hyper-motion", "A dynamic motion-blurred sweep through a stunning modern furnished apartment, energetic high-end real-estate motion still."],
  ["property-tour", "A wide cinematic interior of a luxury furnished short-term rental with floor-to-ceiling windows and a city view, gimbal walk-through look."],
  ["before-after", "A split before-and-after of a short-term rental: a bare empty room on the left, the same room fully designed, furnished and styled on the right."],
  ["tutorial", "A friendly host explaining something at a kitchen island in a bright modern Airbnb, warm how-it-works tutorial vibe."],
  ["world-tour", "A luxury rental balcony overlooking an iconic glowing city skyline at golden hour, aspirational travel-journey aesthetic."],
  ["lifestyle-broll", "An aspirational lifestyle moment in a luxury short-term rental: a coffee on a table by floor-to-ceiling windows at golden hour, soft light."],
];
const SETTINGS = [
  ["living-room", "A beautifully furnished modern luxury living room in a short-term rental, warm natural light."],
  ["kitchen", "A bright, sleek modern kitchen in a luxury short-term rental."],
  ["bedroom", "A serene luxury bedroom in a short-term rental with a city or coastal view through large windows."],
  ["balcony", "A private balcony or terrace of a luxury rental at golden hour, skyline beyond."],
  ["rooftop", "A rooftop pool and lounge of a luxury building overlooking a city skyline at dusk."],
  ["windows", "A luxury rental interior framed by floor-to-ceiling windows with warm golden-hour light pouring in."],
  ["lobby", "An upscale modern building lobby / entrance, premium and welcoming."],
  ["street", "A real upscale urban street scene, handheld walking perspective, city life."],
];

async function genImage(prompt, file) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt} ${SUFFIX}` }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
  const d = await res.json();
  const img = (d?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!img) throw new Error("no image in response");
  fs.writeFileSync(file, Buffer.from(img.inlineData.data, "base64"));
}

(async () => {
  const sets = [["public/formats", FORMATS], ["public/settings", SETTINGS]];
  let ok = 0, fail = 0;
  for (const [dir, items] of sets) {
    const d = path.join(ADS, dir); fs.mkdirSync(d, { recursive: true });
    for (const [key, prompt] of items) {
      const file = path.join(d, `${key}.png`);
      if (fs.existsSync(file) && fs.statSync(file).size > 5000) { console.log(`= ${dir}/${key}: exists, skip`); ok++; continue; }
      try { await genImage(prompt, file); console.log(`ok ${dir}/${key} (${(fs.statSync(file).size / 1e3).toFixed(0)}KB)`); ok++; }
      catch (e) { console.log(`x ${dir}/${key}: ${String(e.message || e).slice(0, 120)}`); fail++; }
    }
  }
  console.log(`DONE — ${ok} ok, ${fail} failed`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
