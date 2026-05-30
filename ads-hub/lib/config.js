// Read-only config the hub surfaces (KPI targets, budget, angles, formats).
// Imported statically from VENDORED copies in ads-hub/config so it bundles for serverless
// (the source files live outside ads-hub and aren't deployed). Refresh with
// `node scripts/sync-config.mjs` whenever ad-angles.json / brand.json change.
import angles from "../config/ad-angles.json";
import brand from "../config/brand.json";
import { readSettings } from "./settings.js";

export function getConfig() {
  return {
    budgetMonthly: angles.campaign_budget_monthly_usd,
    kpi: angles.kpi_targets,
    angles: angles.angles.map((a) => ({
      id: a.id, type: a.type, audience: a.audience, lead_magnet: a.lead_magnet || "", variants: (a.variants || []).length,
    })),
    formats: Object.entries(brand.creative_specs).map(([name, v]) => ({ name, dims: `${v.w}x${v.h}`, use: v.use })),
  };
}

/** getConfig() merged with the editable Settings overrides (budget + KPI targets). Async. */
export async function loadConfig() {
  const base = getConfig();
  const ov = await readSettings();
  return {
    ...base,
    budgetMonthly: ov.budgetMonthly ?? base.budgetMonthly,
    kpi: { ...base.kpi, ...(ov.kpi || {}) },
    settingsUpdatedAt: ov.updatedAt || null,
  };
}
