import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";

/**
 * Settings overrides (editable at runtime; the vendored config/*.json is the read-only base).
 * Stores only what an operator can change from the Settings page — monthly budget + KPI targets.
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

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }

export async function readSettings() {
  if (DRIVER === "cloud") {
    try { const { head } = await blobApi(); const b = await head(KEY); if (!b?.url) return {}; const r = await fetch(b.url, { cache: "no-store" }); return r.ok ? await r.json() : {}; }
    catch { return {}; }
  }
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}

export async function writeSettings(input) {
  const clean = {};
  if (input.budgetMonthly != null && Number.isFinite(+input.budgetMonthly)) clean.budgetMonthly = Math.max(0, Math.round(+input.budgetMonthly));
  if (input.kpi && typeof input.kpi === "object") {
    clean.kpi = {};
    for (const k of KPI_KEYS) if (input.kpi[k] != null && Number.isFinite(+input.kpi[k])) clean.kpi[k] = Math.max(0, +input.kpi[k]);
  }
  clean.updatedAt = new Date().toISOString();
  if (DRIVER === "cloud") { const { put } = await blobApi(); await put(KEY, JSON.stringify(clean), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }); }
  else { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(clean, null, 2)); }
  return clean;
}
