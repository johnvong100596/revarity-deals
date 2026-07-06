/**
 * lib/claimsAtd.js — the claims regime for AnalyzeTheDeal (ATD) signup ads.
 *
 * SEPARATE from lib/claims.js (Revarity money-arc / financing) on purpose — the two brands never
 * share a regime, and this file is picked by brand via lib/brands.js. Same assertClean() shape as
 * the Revarity lock: a violation THROWS (CLAIMS_LOCK) and the caller must fail the build.
 *
 * ATD posture (Cena, 2026-07-05):
 *   • CTA is ALWAYS direct-to-site ("analyzethedeal.com" / "sign up") — NEVER a DM keyword.
 *   • BLOCKED in creative, always: income promises ("make $X/month"), guaranteed returns, ANY
 *     specific ROI / profit / cap-rate / cash-flow / multiple number (the calculator shows numbers
 *     IN-APP; ads never quote them), and ALL APR / credit language.
 *   • ALLOWED: what the product DOES, and any fact confirmed IN WRITING (price, trial, guarantee
 *     posture). Everything unconfirmed is BLOCKED — the confirmed facts unlock via env flags only
 *     when Cena supplies them (mirrors Revarity's CLAIMS_APR_UNLOCKED discipline).
 */

export const BRAND = "atd";
export const SITE = "analyzethedeal.com";
// The only CTA shape ATD creative may use — direct to the site / sign up. No DM keyword, ever.
export const CTA_LINE = `Analyze your next deal free at ${SITE}`;
export const CTA_ALTS = [`Sign up at ${SITE}`, `Run the numbers at ${SITE}`, `Get your verdict at ${SITE}`];
// ATD ads carry no financing disclaimer (that's a Revarity concept); honest product framing only.
export const DISCLAIMER = "";

/* ── Confirmed-facts gate: unconfirmed price/trial/guarantee claims are BLOCKED until Cena
      flips the matching env flag (backed by written confirmation). "Treat everything
      unconfirmed as blocked." ── */
export function priceConfirmed() { return String(process.env.ATD_PRICE_CONFIRMED || "") === "1"; }
export function trialConfirmed() { return String(process.env.ATD_TRIAL_CONFIRMED || "") === "1"; }
export function guaranteeConfirmed() { return String(process.env.ATD_GUARANTEE_CONFIRMED || "") === "1"; }

/* Specific investment-return numbers — NEVER allowed in ATD creative (the app shows these, ads don't).
   Catches "12% ROI", "8% cap rate", "$40k profit", "2.5x return", "cash-on-cash 14%", "$1,200/mo cash flow". */
const RETURN_NUMBERS = [
  /\b\d+(\.\d+)?\s*%\s*(roi|cap\s*rate|return|yield|cash[-\s]?on[-\s]?cash|coc|irr|appreciation)\b/i,
  /\b(roi|cap\s*rate|return|yield|cash[-\s]?on[-\s]?cash|coc|irr)\s*(of|:|=|\bis\b)?\s*\d+(\.\d+)?\s*%/i,
  /\b\d+(\.\d+)?\s*x\s*(return|roi|your\s+money|cash)\b/i,
  /\$\s?\d[\d,]*\+?\s*(k|m)?\s*(in\s+)?(profit|return|equity|cash\s*flow|cashflow|passive\s+income)\b/i,
  /\b(profit|return|cash\s*flow|cashflow|equity)\s*(of|:|=)?\s*\$\s?\d[\d,]*/i,
  /\b\d[\d,]*\+?\s*(a|per|\/)\s*(month|mo|year|yr)\s*(in\s+)?(profit|cash\s*flow|cashflow|passive\s+income|returns?)\b/i,
];

/* Income promises + guarantees — banned always (shared spirit with Revarity, ATD-tuned). */
const BANNED_ALWAYS = [
  /\bmake\s+\$?\d[\d,]*\+?\s*(a|per|\/)\s*(day|week|month|year|mo|yr)\b/i,
  /\bmake\s+(money|bank|a\s+fortune)\b/i,
  /\bguarantee(d|s)?\b/i,
  /\bguaranteed\s+(returns?|profit|income|approval|deal)/i,
  /\brisk[-\s]?free\b/i,
  /\bcan'?t\s+lose\b/i,
  /\bget\s+rich\b/i,
  /\bpassive\s+income\b/i,               // implies a return promise for a research tool
  /\bwe'?ll\s+(find|get)\s+you\s+(a\s+)?(deal|profit)/i,
  // fake urgency
  /\bonly\s+\d+\s+(spots?|seats?|left|remaining)\b/i,
  /\b(limited|last)\s+(spots?|seats?|time|chance)\b/i,
  /\bact\s+now\b/i, /\bhurry\b/i,
];

/* APR / credit language — banned in ATD creative outright (no leadership-unlock path here; ATD is
   a research tool, not a financing product). */
const APR_CREDIT = [
  /\b0\s*%/i, /\bAPR\b/i, /\bannual percentage rate\b/i, /\binterest[-\s]?free\b/i,
  /\b(no|zero)\s+interest\b/i, /\bcredit\s*(check|score|pull|inquiry|report)\b/i,
  /\b(soft|hard)\s*(pull|check|inquiry)\b/i, /\bfinanc(e|ing)\b/i,
];

/* DM-keyword CTAs — a Revarity mechanic; BLOCKED for ATD (its CTA is the site). */
const DM_CTA = [
  /\bDM\b/i, /\bdirect\s*message\b/i, /\bmessage\s+(us|me)\b/i,
  /\bcomment\s+["“]?\w+["”]?\s+below\b/i, /\bsend\s+(us\s+)?a\s+dm\b/i,
];

/* Unconfirmed factual claims — blocked until the matching env flag confirms them in writing. */
function unconfirmedFacts(t) {
  const hits = [];
  if (!priceConfirmed() && (/\$\s?\d/.test(t) || /\b(per\s*month|\/mo|monthly|pricing|costs?\s+\$|only\s+\$)\b/i.test(t) || /\bfree\s+forever\b/i.test(t)))
    hits.push({ kind: "atd_price_unconfirmed", pattern: "price/cost claim before ATD_PRICE_CONFIRMED" });
  if (!trialConfirmed() && (/\btrial\b/i.test(t) || /\btry\s+(it\s+)?free\b/i.test(t) || /\bfree\s+for\s+\d+\s+days?\b/i.test(t)))
    hits.push({ kind: "atd_trial_unconfirmed", pattern: "trial claim before ATD_TRIAL_CONFIRMED" });
  if (!guaranteeConfirmed() && /\bmoney[-\s]?back\b|\brefund\b|\bcancel\s+any\s*time\b/i.test(t))
    hits.push({ kind: "atd_guarantee_unconfirmed", pattern: "guarantee/refund claim before ATD_GUARANTEE_CONFIRMED" });
  return hits;
}

/** Return an array of violations in `text` (empty = clean). Same signature as lib/claims.js. */
export function claimViolations(text) {
  const t = String(text || "");
  const hits = [];
  for (const re of RETURN_NUMBERS) if (re.test(t)) hits.push({ kind: "atd_return_number", pattern: re.source });
  for (const re of BANNED_ALWAYS) if (re.test(t)) hits.push({ kind: "banned", pattern: re.source });
  for (const re of APR_CREDIT) if (re.test(t)) hits.push({ kind: "apr_credit", pattern: re.source });
  for (const re of DM_CTA) if (re.test(t)) hits.push({ kind: "atd_dm_cta", pattern: re.source });
  hits.push(...unconfirmedFacts(t));
  return hits;
}

/** Enforce across every text surface of a draft. Throws CLAIMS_LOCK → caller fails the build. */
export function assertClean(draft = {}) {
  const surfaces = [
    draft.hook, draft.problem, draft.weDoItAll, draft.turn, draft.cta,
    draft.headline, draft.body, draft.postCaption, draft.endCard, draft.script,
    ...(Array.isArray(draft.captions) ? draft.captions : []),
  ].filter(Boolean).join("\n");
  const hits = claimViolations(surfaces);
  if (hits.length) {
    const err = new Error(
      `CLAIMS_LOCK (ATD): draft rejected — ${hits.length} violation(s): ` +
        hits.map((h) => `${h.kind}[${h.pattern}]`).join("; ")
    );
    err.code = "CLAIMS_LOCK";
    err.violations = hits;
    throw err;
  }
  return true;
}

/** End card for ATD = the site CTA, no financing disclaimer. */
export function endCard(lines = []) {
  return { lines: Array.isArray(lines) ? lines : [lines], cta: CTA_LINE, site: SITE, disclaimer: DISCLAIMER };
}
