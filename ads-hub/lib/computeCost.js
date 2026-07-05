/**
 * lib/computeCost.js — render-compute estimates + the spend ledger (engine-audit P0-1).
 *
 * "PROPOSES — NEVER SPENDS" was true for ad budget but false for render compute: a
 * click fired Veo instantly, billing the company Google key with no number anywhere.
 * This module is the number. Estimates are deliberately ROUGH (credits, not dollars)
 * — they exist so the operator sees a cost BEFORE confirming and a running meter
 * after, not to be an invoice. Tune via COMPUTE_COST_JSON without a deploy.
 */

// ~credits per unit. veo = premium engine (the silent-burn one from the audit).
const DEFAULTS = {
  veo: 40, // per clip (Veo 3.1, ~8s 720p)
  kling: 6,
  "kling-turbo": 3,
  higgsfield: 8, // still render + i2v motion
  arcads: 25, // per UGC script
  image: 2, // pro Nano still
  copy: 1, // per copy batch (Claude tokens)
  voice: 1,
  music: 2,
};

export function costTable() {
  try { return { ...DEFAULTS, ...JSON.parse(process.env.COMPUTE_COST_JSON || "{}") }; }
  catch { return { ...DEFAULTS }; }
}

/** Estimate credits for one generate call. kind = engine key or "image"/"copy"/"voice"/"music". */
export function estimateCredits(kind, n = 1) {
  const t = costTable();
  return Math.round((t[kind] ?? t.image) * Math.max(1, n) * 10) / 10;
}

/** Estimate a whole director plan (shots + optional voice/music). Mirrors the client's mapping. */
export function estimatePlan(plan) {
  if (!plan?.shots?.length) return 0;
  let total = 0;
  for (const s of plan.shots) {
    if (s.kind === "image") total += estimateCredits("image");
    else if (s.kind === "ugc") total += estimateCredits("arcads");
    else if (s.kind === "presenter") total += estimateCredits("veo");
    else {
      const e = s.engine === "veo-broll" ? "veo" : s.engine;
      total += estimateCredits(["veo", "kling", "kling-turbo", "higgsfield"].includes(e) ? e : "kling");
    }
  }
  if (plan.voice?.include) total += estimateCredits("voice");
  if (plan.music?.include) total += estimateCredits("music");
  return Math.round(total * 10) / 10;
}
