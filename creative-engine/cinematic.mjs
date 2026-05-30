#!/usr/bin/env node
/**
 * Generate the cinematic "property journey" scene stills for the studio hero (Gemini / Nano Banana).
 * The loop: bedroom window → over the city → sky → Tulum beach → villa door → ski resort →
 * cottage fireplace → high-rise → back to the city. Photoreal, cinematic, NO people, NO text.
 *   node creative-engine/cinematic.mjs   →   output/cinematic/01..NN.png
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output", "cinematic");
fs.mkdirSync(OUT, { recursive: true });

(function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const i = line.indexOf("="); if (i < 0) continue;
    const k = line.slice(0, i).trim(); if (k && !process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
})();
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY missing"); process.exit(2); }
const MODEL = "gemini-3.1-flash-image-preview";

const STYLE = "Photoreal cinematic still, wide anamorphic feel, rich color grade, volumetric light, shallow depth of field, premium travel-film look. NO people, NO text, NO logos.";
const SCENES = [
  ["01-bedroom-city", `Inside a luxe high-rise bedroom at blue hour, looking through a floor-to-ceiling window onto a glittering city skyline. ${STYLE}`],
  ["02-over-city", `Aerial drone shot soaring over a glowing modern city skyline at dusk, clouds catching warm light. ${STYLE}`],
  ["03-sky", `Soaring up into a vast dramatic sky, sunlit clouds, sense of flight and freedom, lens flare. ${STYLE}`],
  ["04-tulum-aerial", `Top-down aerial descending toward Tulum beach — turquoise Caribbean water, white sand, lush green jungle, golden hour. ${STYLE}`],
  ["05-villa-door", `A beautiful beachfront villa entrance on white sand, modern tropical architecture, palm shadows, open door, golden hour, Tulum. ${STYLE}`],
  ["06-ski-resort", `A snowy alpine ski resort village on a mountaintop at dusk, warm-lit chalets, soft falling snow, cinematic. ${STYLE}`],
  ["07-cottage-fire", `Cozy cottage interior with a glowing fireplace, warm timber, soft throws, inviting evening light. ${STYLE}`],
  ["08-highrise-night", `Luxury high-rise apartment interior at night, floor-to-ceiling windows over a sea of city lights, moody and warm. ${STYLE}`],
];

async function render(prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  const img = (d?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!img) throw new Error("no image");
  return Buffer.from(img.inlineData.data, "base64");
}

let ok = 0;
for (const [name, prompt] of SCENES) {
  try { fs.writeFileSync(path.join(OUT, `${name}.png`), await render(prompt)); console.log(`  ✓ ${name}`); ok++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); }
}
console.log(`\n${ok}/${SCENES.length} cinematic scenes → output/cinematic/`);
