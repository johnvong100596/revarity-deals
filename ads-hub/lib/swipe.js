import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";
import { ANTHROPIC_KEY } from "./connectors.js";
import angles from "../config/ad-angles.json";

/**
 * "Mine winners" — swipe state + miner (serverless port of creative-engine/swipe.mjs).
 * Operators paste winning competitor ads (refs); the miner extracts GENERALIZED hook/angle/format
 * PATTERNS (learn the framework, never copy the words). Patterns feed the Create page as inspiration.
 *   STORE_DRIVER=fs    → creative-engine/output/_swipe.json
 *   STORE_DRIVER=cloud → Vercel Blob state/swipe.json
 * Publishes nothing (D-04).
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const SWIPE_KEY = "state/swipe.json";
const SWIPE_FILE = path.join(OUTPUT_DIR, "_swipe.json");
const EMPTY = { refs: [], patterns: null, updatedAt: null };

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }

export async function readSwipe() {
  if (DRIVER === "cloud") {
    try { const { head } = await blobApi(); const b = await head(SWIPE_KEY); if (!b?.url) return { ...EMPTY }; const r = await fetch(b.url, { cache: "no-store" }); return r.ok ? await r.json() : { ...EMPTY }; }
    catch { return { ...EMPTY }; }
  }
  try { return JSON.parse(fs.readFileSync(SWIPE_FILE, "utf8")); } catch { return { ...EMPTY }; }
}

export async function writeSwipe(state) {
  state.updatedAt = new Date().toISOString();
  if (DRIVER === "cloud") { const { put } = await blobApi(); await put(SWIPE_KEY, JSON.stringify(state), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }); }
  else { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); fs.writeFileSync(SWIPE_FILE, JSON.stringify(state, null, 2)); }
  return state;
}

const ICP = `Revarity — done-for-you short-term-rental / Airbnb arbitrage for people with real capital. Audiences: ${[...new Set(angles.angles.map((a) => a.audience))].join("; ")}. Geo: ${(angles.targeting?.geo || []).join("/")}.`;

/** Mine generalized patterns from the stored refs. Returns {hooks,angles,formats,copy_frameworks,do,dont}. */
export async function minePatterns(refs) {
  if (!ANTHROPIC_KEY()) throw new Error("ANTHROPIC_API_KEY not set — required to mine patterns.");
  if (!refs.length) throw new Error("No references yet — paste at least one winning ad first.");
  const prompt = [
    "You are a direct-response creative strategist. Below are references to ads that work in this space.",
    `Client: ${ICP}`,
    "Extract the GENERALIZED, reusable PATTERNS — hook structures, angles, formats, copy frameworks — so our generator can produce ORIGINAL creative in the same spirit. Never reproduce any specific ad's wording. Learn the framework, not the words.",
    "Honor the voice: direct, no hype adjectives, honest model, ranged + 'estimate'-labelled numbers, no fake scarcity. Pricing may state $375/mo flat, fully-managed, no revenue share — and no setup fees or % revenue share.",
    "",
    "REFERENCES:",
    JSON.stringify(refs, null, 2),
    "",
    'Return ONLY JSON: {"hooks":["reusable hook templates with [placeholders]"],"angles":["angle + 1-line why"],"formats":["format + when to use"],"copy_frameworks":["e.g. myth→reframe→proof→CTA"],"do":[".."],"dont":[".."]}',
    "Return ONLY the JSON object — no prose, no markdown fences.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.COPY_MODEL || "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const txt = d?.content?.map((b) => b.text || "").join("") || "";
  let p; try { p = JSON.parse(txt); } catch { try { const m = txt.match(/\{[\s\S]*\}/); p = m ? JSON.parse(m[0]) : null; } catch { p = null; } }
  if (!p) throw new Error("Could not parse mined patterns.");
  for (const k of ["hooks", "angles", "formats", "copy_frameworks", "do", "dont"]) if (!Array.isArray(p[k])) p[k] = p[k] ? [p[k]] : [];
  return p;
}
