/**
 * lib/claims.js — THE single claims regime for ads.revarity.com creative (money-arc / financing).
 *
 * This REPLACES the old offer-model guard (free entry / $375-mo / at-cost / no-guarantee). There is
 * exactly ONE regime — never run two in parallel (that's how a stale rule leaks into a live ad).
 *
 * Rules (hard-enforced — a violation FAILS the build, it is not advisory):
 *   • The ONLY financial claim the generator may emit is VERIFIED_CLAIM ("$0 down for qualified properties").
 *   • Every end card auto-burns DISCLAIMER.
 *   • "0%", "APR", interest/credit-check language is LOCKED — any draft containing it fails to build,
 *     UNTIL leadership flips the flag (CLAIMS_APR_UNLOCKED=1) backed by Malcolm's written terms.
 *   • Fake urgency, guarantees, and income promises are banned always (the flag never lifts these).
 */

export const VERIFIED_CLAIM = "$0 down for qualified properties";
export const DISCLAIMER =
  "Most setups qualify for $0 down; larger builds may require a partial down payment. Financing subject to approval.";
export const DM_KEYWORD = "SETUP";
export const CTA_LINE = 'Zero down for qualified properties. DM "SETUP".';

/**
 * The APR/credit lock lifts ONLY when leadership sets this flag (backed by written terms). Until then,
 * any "0% APR" / soft-credit-check language fails the build. Env flag = deploy-gated, not editable in-UI.
 */
export function aprUnlocked() {
  return String(process.env.CLAIMS_APR_UNLOCKED || "") === "1";
}

/* APR / credit-check patterns — LOCKED unless aprUnlocked(). */
const APR_CREDIT = [
  /\b0\s*%/i,
  /\bAPR\b/i,
  /\bannual percentage rate\b/i,
  /\binterest[-\s]?free\b/i,
  /\b(no|zero)\s+interest\b/i,
  /\bcredit\s*(check|score|pull|inquiry|report)\b/i,
  /\b(soft|hard)\s*(pull|check|inquiry)\b/i,
  /\bwon'?t\s+(affect|impact|hurt)\s+your\s+credit\b/i,
  /\bno\s+impact\s+(to|on)\s+(your\s+)?credit\b/i,
  /\bcheck(ing)?\s+your\s+rate\b/i,
  /\bpre[-\s]?qualif/i,
];

/* Banned ALWAYS — the flag never lifts these. Fake urgency, guarantees, income promises. */
const BANNED_ALWAYS = [
  /\bonly\s+\d+\s+(spots?|seats?|left|remaining)\b/i,
  /\b(limited|last)\s+(spots?|seats?|time|chance)\b/i,
  /\bact\s+now\b/i,
  /\bhurry\b/i,
  /\bexpires?\s+(today|tonight|soon|in\s+\d)/i,
  /\bguarantee(d|s)?\b/i,
  /\brisk[-\s]?free\b/i,
  /\bcan'?t\s+lose\b/i,
  /\bguaranteed\s+(approval|return|income|occupancy)/i,
  /\bmake\s+\$?\d[\d,]*\+?\s*(a|per|\/)\s*(day|week|month|year|mo|yr)\b/i,
  /\b\$?\d[\d,]*\+?\s*(a|per|\/)\s*(month|mo)\s+(guaranteed|profit|income|cash\s*flow)\b/i,
];

/** Return an array of violations found in `text` (empty = clean). */
export function claimViolations(text) {
  const t = String(text || "");
  const hits = [];
  if (!aprUnlocked()) {
    for (const re of APR_CREDIT) if (re.test(t)) hits.push({ kind: "apr_credit_locked", pattern: re.source });
  }
  for (const re of BANNED_ALWAYS) if (re.test(t)) hits.push({ kind: "banned", pattern: re.source });
  return hits;
}

/**
 * Enforce the regime across EVERY text surface of a draft (VO script + captions + end card + post caption).
 * Throws a CLAIMS_LOCK error → the caller must FAIL the build (never queue a violating draft).
 * `draft` may carry: hook, problem, weDoItAll, cta, endCard, postCaption, captions[] (any subset).
 */
export function assertClean(draft = {}) {
  const surfaces = [
    draft.hook, draft.problem, draft.weDoItAll, draft.turn, draft.cta,
    draft.headline, draft.body, draft.postCaption, draft.endCard,
    ...(Array.isArray(draft.captions) ? draft.captions : []),
  ].filter(Boolean).join("\n");
  const hits = claimViolations(surfaces);
  if (hits.length) {
    const err = new Error(
      `CLAIMS_LOCK: draft rejected — ${hits.length} violation(s): ` +
        hits.map((h) => `${h.kind}[${h.pattern}]`).join("; ")
    );
    err.code = "CLAIMS_LOCK";
    err.violations = hits;
    throw err;
  }
  return true;
}

/** Standard end-card payload — disclaimer is ALWAYS present (cannot be omitted by a caller). */
export function endCard(lines = []) {
  return { lines: Array.isArray(lines) ? lines : [lines], dm: `DM "${DM_KEYWORD}"`, disclaimer: DISCLAIMER };
}
