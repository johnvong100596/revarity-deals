#!/usr/bin/env node
/**
 * Revarity Creative Engine — swipe-file miner ("capture which ads work").
 * Reads swipe-inbox.json (winning-ad references), uses the model to extract GENERALIZED
 * hook/angle/format PATTERNS (learn the framework — never copy the creative), and writes
 * swipe-patterns.json. The copy generator reads that file and draws on proven patterns,
 * still producing original, brand-locked, pricing-guarded copy.
 *
 *   node creative-engine/swipe.mjs
 *
 * Honest scope: the official Meta Ad Library API only covers political/social + EU/UK ads,
 * so US/CA STR competitor ads are added manually to swipe-inbox.json (or via a paid tool,
 * decision D-11). This miner generalizes whatever references it's given. Publishes nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INBOX = path.join(__dirname, "swipe-inbox.json");
const OUT = path.join(__dirname, "swipe-patterns.json");

(function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

const routing = JSON.parse(fs.readFileSync(path.join(ROOT, "creative-engine/model-routing.json"), "utf8"));
const want = routing.tasks.creative_strategy?.model || "claude-opus-4-7";
const MODEL = want.startsWith("claude") && !process.env.ANTHROPIC_API_KEY ? "gemini-2.5-flash" : want;
const PROVIDER = MODEL.startsWith("claude") ? "anthropic" : "gemini";

if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) { console.error("No model key (GEMINI_API_KEY or ANTHROPIC_API_KEY). Aborting."); process.exit(2); }
if (!fs.existsSync(INBOX)) { console.error("swipe-inbox.json missing."); process.exit(2); }

const inbox = JSON.parse(fs.readFileSync(INBOX, "utf8"));
const refs = inbox.refs || [];

const prompt = [
  "You are a direct-response creative strategist for Revarity (done-for-you short-term-rental / Airbnb arbitrage for people with real capital).",
  "Below are references to ads that work in this space. Extract the GENERALIZED, reusable PATTERNS — hook structures, angles, formats, copy frameworks — so our generator can produce ORIGINAL creative in the same spirit. Do NOT reproduce any specific ad's wording. Learn the framework, not the words.",
  "",
  "Honor Revarity's voice: direct, no hype adjectives, state the model honestly, projected numbers always ranged + labeled 'estimate', no fake scarcity, no pricing claims (D-01).",
  "",
  "REFERENCES:",
  JSON.stringify(refs, null, 2),
  "",
  'Return ONLY JSON: {"hooks":["reusable hook templates with [placeholders]"],"angles":["angle names + 1-line why"],"formats":["format + when to use"],"copy_frameworks":["structure templates e.g. myth→reframe→proof→CTA"],"do":["..."],"dont":["..."]}',
].join("\n");

async function callModel() {
  if (PROVIDER === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content: prompt + "\n\nReturn ONLY the JSON object." }, { role: "assistant", content: "{" }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    return "{" + (d?.content?.map((b) => b.text || "").join("") || "");
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  return d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "{}";
}

const txt = await callModel();
let patterns;
try { patterns = JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); patterns = m ? JSON.parse(m[0]) : null; }
if (!patterns || typeof patterns !== "object") { console.error("could not parse patterns from model output."); process.exit(1); }
// normalize: every pattern bucket must be an array
for (const k of ["hooks", "angles", "formats", "copy_frameworks", "do", "dont"]) {
  if (!Array.isArray(patterns[k])) patterns[k] = patterns[k] ? [patterns[k]] : [];
}

const payload = { generatedAt: new Date().toISOString(), model: MODEL, sourceCount: refs.length, patterns };
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(`swipe patterns → creative-engine/swipe-patterns.json (${refs.length} refs → ${Object.values(patterns).flat().length} pattern items, via ${MODEL})`);
console.log("The copy generator will draw on these on the next run. Learn the framework, not the words.");
