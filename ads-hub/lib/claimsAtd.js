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

/* Specific investment-return claims — NEVER allowed in ATD creative (the app shows these; ads don't).
   Catches digit AND spelled-out forms, k/m amounts, and multiplier verbs. A "return metric" is any of:
   roi / cap rate / return / yield / cash-on-cash / coc / irr / profit / income / cash flow / appreciation. */
const NUMWORD = "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|double|triple|quadruple)";
const RETURN_WORD = "(?:roi|cap\\s*rate|returns?|yield|cash[-\\s]?on[-\\s]?cash|coc|irr|profit|passive\\s+income|income|cash\\s*flow|cashflow|equity|appreciation)";
const RETURN_NUMBERS = [
  // percentage (digit or word) adjacent to a return metric, either order
  new RegExp(`\\b(\\d+(?:\\.\\d+)?|${NUMWORD})\\s*(?:%|percent)\\s*(?:${RETURN_WORD})`, "i"),
  new RegExp(`\\b${RETURN_WORD}\\s*(?:of|:|=|is|around|about|up\\s+to)?\\s*(\\d+(?:\\.\\d+)?|${NUMWORD})\\s*(?:%|percent)`, "i"),
  // "cap rate of fifteen" / "returns of twelve" — metric + number word/digit with no % at all
  new RegExp(`\\b${RETURN_WORD}\\s*(?:of|:|=|is|around|about|up\\s+to)\\s*(\\d+(?:\\.\\d+)?|${NUMWORD})\\b`, "i"),
  // multipliers: "2.5x return", "double/triple your money/investment/capital/returns"
  /\b\d+(\.\d+)?\s*x\s*(return|roi|your\s+money|cash|investment|capital)\b/i,
  /\b(double|triple|quadruple|2x|3x|4x|5x|10x)\s+(your\s+)?(money|capital|investment|returns?|cash|income|portfolio)\b/i,
  // dollar amounts tied to a return metric, either order — incl. $2k, $40k, $1,200
  new RegExp(`\\$\\s?\\d[\\d,]*\\+?\\s*[km]?\\b[^.]{0,20}?\\b(?:${RETURN_WORD})`, "i"),
  new RegExp(`\\b(?:${RETURN_WORD})\\b[^.]{0,20}?\\$\\s?\\d[\\d,]*\\+?\\s*[km]?\\b`, "i"),
  // "$3k monthly income", "2k per month profit", "$2,000 each month" (amount + timeframe [+ return word])
  /\$?\s?\d[\d,]*\+?\s*[km]?\s*(a|per|\/|each)\s*(month|mo|year|yr|week)\b/i,
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

/* Off-site response CTAs — a Revarity/DM mechanic; BLOCKED for ATD (its CTA is the SITE, always).
   Covers DM, message, text, email, and comment/reply-with-a-keyword routing. */
const DM_CTA = [
  /\bDM\b/i, /\bdirect\s*message\b/i, /\bmessage\s+(us|me)\b/i, /\bsend\s+(us\s+)?a\s+dm\b/i,
  /\btext\s+(us|me|["“]?\w+["”]?)\b/i, /\bemail\s+(us|me|["“]?[\w@.]+["”]?)\b/i,
  /\bcomment\s+["“]?\w+["”]?/i, /\breply\s+(to\s+this|with|below|in\s+the\s+comments)\b/i,
  /\bsend\s+["“]?\w+["”]?\s+(to|via)\b/i,
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
