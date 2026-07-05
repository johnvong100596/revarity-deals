// Read-only config the hub surfaces (KPI targets, budget, angles, formats).
// Imported statically from VENDORED copies in ads-hub/config so it bundles for serverless
// (the source files live outside ads-hub and aren't deployed). Refresh with
// `node scripts/sync-config.mjs` whenever ad-angles.json / brand.json change.
import angles from "../config/ad-angles.json";
import brand from "../config/brand.json";
import { readSettings } from "./settings.js";
import { anglesEnabled } from "./connectors.js";

export function getConfig() {
  const formatsFull = Object.entries(brand.creative_specs).map(([name, v]) => ({ name, w: v.w, h: v.h, use: v.use }));
  return {
    budgetMonthly: angles.campaign_budget_monthly_usd,
    kpi: angles.kpi_targets,
    angles: anglesEnabled() ? angles.angles.map((a) => ({
      id: a.id, type: a.type, audience: a.audience, lead_magnet: a.lead_magnet || "", variants: (a.variants || []).length,
    })) : [],
    formats: formatsFull.map((f) => ({ name: f.name, dims: `${f.w}x${f.h}`, use: f.use })),
    formatsFull,
  };
}

/** getConfig() merged with the editable Settings overrides (budget + KPI targets + angle library). Async.
 *  `angles` is the summary shape (variants as a count) for tables; `anglesFull` is the full objects for
 *  the Settings editor + the generation path (connectors.getAngle reads the same override). */
export async function loadConfig() {
  const base = getConfig();
  const ov = await readSettings();
  // An EMPTY saved override is a deliberate "cleared working set" and must be respected —
  // falling back to the base file here made "Remove all + Save" silently un-remove everything
  // (the 2026-07-05 "Remove doesn't work" bug). Only an ABSENT override means "use the base".
  const full = Array.isArray(ov.angles) ? ov.angles : angles.angles;
  const fullFormats = Array.isArray(ov.formats) && ov.formats.length ? ov.formats : base.formatsFull;
  return {
    ...base,
    budgetMonthly: ov.budgetMonthly ?? base.budgetMonthly,
    kpi: { ...base.kpi, ...(ov.kpi || {}) },
    // Angles parked (studio-freedom): pages get an empty list unless ANGLES_ENABLED=1.
    // anglesFull stays intact so the Settings editor can still view/curate the parked library.
    angles: anglesEnabled() ? full.map((a) => ({ id: a.id, type: a.type, audience: a.audience, lead_magnet: a.lead_magnet || "", variants: (a.variants || []).length })) : [],
    anglesEnabled: anglesEnabled(),
    anglesFull: full,
    anglesCustomized: Array.isArray(ov.angles), // a cleared (empty) set counts as customized
    formats: fullFormats.map((f) => ({ name: f.name, dims: `${f.w}x${f.h}`, use: f.use })),
    formatsFull: fullFormats,
    formatsCustomized: Array.isArray(ov.formats) && ov.formats.length > 0,
    settingsUpdatedAt: ov.updatedAt || null,
  };
}
