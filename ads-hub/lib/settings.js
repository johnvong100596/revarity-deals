import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";

/**
 * Settings overrides (editable at runtime; the vendored config/*.json is the read-only base).
 * Stores what an operator can change from the Settings page — monthly budget, KPI targets, and the
 * angle library (add / edit / remove on top of ad-angles.json).
 *   STORE_DRIVER=fs    → creative-engine/output/_settings.json
 *   STORE_DRIVER=cloud → Vercel Blob state/settings.json
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const KEY = "state/settings.json";
const FILE = path.join(OUTPUT_DIR, "_settings.json");

const KPI_KEYS = [
  "cpc_usd_max", "cpl_usd_max", "calls_booked_monthly_min", "cost_per_call_usd_max",
  "cpa_usd_max", "kill_creative_cpl_usd_over", "kill_creative_after_impressions", "scale_creative_cpl_usd_under",
];

const STR = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);

// The angle library feeds copy/image/video generation, so sanitize hard: cap counts + lengths, force a
// safe id shape, and drop anything without an id. Variants (approved ad copy) are preserved verbatim but
// length-capped — the Settings UI never edits variant copy (guardrail D: no copy changes without sign-off).
export function sanitizeAngles(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map((a) => {
    const id = STR(a?.id, 48).trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!id) return null;
    const type = ["lead_magnet", "direct_offer", "awareness", "custom"].includes(a?.type) ? a.type : "custom";
    const variants = Array.isArray(a?.variants) ? a.variants.slice(0, 8).map((v) => ({
      id: STR(v?.id, 4) || "A", hook: STR(v?.hook, 40), headline: STR(v?.headline, 240), cta: STR(v?.cta, 80),
      ...(v?.pricing_flag ? { pricing_flag: STR(v.pricing_flag, 40) } : {}),
    })) : [];
    return {
      id, type,
      audience: STR(a?.audience, 300),
      lead_magnet: STR(a?.lead_magnet, 300),
      delivery: STR(a?.delivery, 300),
      visual_direction: STR(a?.visual_direction, 500),
      variants,
    };
  }).filter(Boolean);
}

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }

export async function readSettings() {
  if (DRIVER === "cloud") {
    try { const { head } = await blobApi(); const b = await head(KEY); if (!b?.url) return {}; const r = await fetch(b.url, { cache: "no-store" }); return r.ok ? await r.json() : {}; }
    catch { return {}; }
  }
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}

export async function writeSettings(input) {
  // Merge onto what's already saved so a partial save (e.g. angles-only) never wipes budget/KPI, and vice versa.
  const prev = await readSettings();
  const clean = { ...prev };
  if (input.budgetMonthly != null && Number.isFinite(+input.budgetMonthly)) clean.budgetMonthly = Math.max(0, Math.round(+input.budgetMonthly));
  if (input.kpi && typeof input.kpi === "object") {
    clean.kpi = { ...(prev.kpi || {}) };
    for (const k of KPI_KEYS) if (input.kpi[k] != null && Number.isFinite(+input.kpi[k])) clean.kpi[k] = Math.max(0, +input.kpi[k]);
  }
  // An empty array clears the override (falls back to the read-only base angles in config.js).
  if (Array.isArray(input.angles)) clean.angles = sanitizeAngles(input.angles);
  clean.updatedAt = new Date().toISOString();
  if (DRIVER === "cloud") { const { put } = await blobApi(); await put(KEY, JSON.stringify(clean), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }); }
  else { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(clean, null, 2)); }
  return clean;
}
