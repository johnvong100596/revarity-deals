/**
 * lib/notify.js — Slack notifications for the nightly render batch (and any operator-facing
 * heads-up). Fire-and-forget, fail-open: a Slack hiccup must never fail a render batch. Honest
 * no-op when the webhook is unset (SLACK_WEBHOOK_URL comes from Vercel / GH secrets — never committed).
 *
 * Two channels (D-20):
 *   SLACK_WEBHOOK_URL           — the morning digest ("N new drafts ready for review" + ids + hub link)
 *   SLACK_WEBHOOK_URL_FAILURES  — OPTIONAL separate URL for failures / claims-lock blocks; falls back
 *                                 to SLACK_WEBHOOK_URL when unset, so failures always surface somewhere.
 */
const WEBHOOK = () => process.env.SLACK_WEBHOOK_URL || "";
const FAIL_WEBHOOK = () => process.env.SLACK_WEBHOOK_URL_FAILURES || WEBHOOK();
const HUB_REVIEW_URL = process.env.HUB_REVIEW_URL || "https://ads.revarity.com/review";

export function notifyConfigured() {
  return !!WEBHOOK();
}

/** Post plain text to a specific Slack webhook. Returns true if sent, false if unconfigured/failed. */
async function post(url, text) {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text || "").slice(0, 3500) }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[notify] Slack post failed:", e?.message || e);
    return false;
  }
}

/** Post to the primary (digest) webhook. */
export async function notifySlack(text) { return post(WEBHOOK(), text); }

/** Post to the failures webhook (falls back to primary). */
export async function notifyFailure(text) { return post(FAIL_WEBHOOK(), text); }

/**
 * Morning digest after a nightly batch + an immediate failure alert.
 *   • Digest (primary webhook): "N new drafts ready for review" + the draft ids + a hub link.
 *   • Failure alert (failures webhook): render errors AND claims-lock blocks, each with its reason.
 * A batch with failures sends BOTH: the digest of what landed, and the alert of what didn't.
 */
export async function notifyBatch({ dryRun, rendered = [], skipped = [], errors = [] }) {
  const tag = dryRun ? "[DRY-RUN] " : "";
  const results = {};

  // ── (a) morning digest: what's ready for review ──
  if (rendered.length) {
    const ids = rendered.map((r) => r.id || r.unit).filter(Boolean);
    const digest = [
      `${tag}🎬 Revarity — ${rendered.length} new draft${rendered.length === 1 ? "" : "s"} ready for review`,
      ...rendered.map((r) => `• ${r.unit || r.id}${r.voProvider ? ` · VO:${r.voProvider}` : ""}${r.voPending ? " · ⚠️ VO pending" : ""}${Array.isArray(r.formats) ? ` · ${r.formats.join(" + ")}` : ""}`),
      ids.length ? `ids: ${ids.join(", ")}` : "",
      `Review + approve → ${HUB_REVIEW_URL}`,
    ].filter(Boolean).join("\n");
    results.digest = await notifySlack(digest);
  }

  // ── (b) alert: failures AND anything that BLOCKED drafts from being produced ──
  // A broken or empty nightly is not a quiet event: a preflight gap (bad Drive key,
  // missing fonts/ffmpeg) or an empty photo library means zero drafts landed, and
  // that must be VISIBLE on the failures channel with the reason — not a soft
  // "no drafts" note that reads like a normal quiet night (D-20).
  const claimsBlocks = errors.filter((e) => /CLAIMS_LOCK/i.test(e.error || String(e)));
  const blocked = !rendered.length && (errors.length || skipped.length);
  if (errors.length || blocked) {
    const alert = [
      `${tag}🚨 Revarity render — ${rendered.length ? `${rendered.length} drafted, ` : ""}${errors.length ? `${errors.length} failure${errors.length === 1 ? "" : "s"}` : "no drafts produced"}${claimsBlocks.length ? ` (${claimsBlocks.length} claims-lock)` : ""}`,
      ...errors.map((e) => `• ${/CLAIMS_LOCK/i.test(e.error || String(e)) ? "⛔ claims-lock" : "❌ render"}${e.unit ? ` [${e.unit}]` : ""}: ${(e.error || String(e)).slice(0, 300)}`),
      ...skipped.map((s) => `• ⚠️ skipped: ${(s.reason || String(s)).slice(0, 300)}`),
      `Hub → ${HUB_REVIEW_URL}`,
    ].join("\n");
    results.failure = await notifyFailure(alert);
  } else if (!rendered.length && !dryRun) {
    // truly nothing to do and nothing wrong — a quiet heartbeat so silence never means "broken"
    results.digest = await notifySlack(`🎬 Revarity nightly — no new drafts this run.`);
  }

  return results;
}
