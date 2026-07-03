/**
 * lib/notify.js — Slack notifications for the nightly render batch (and any
 * operator-facing heads-up). One webhook, fire-and-forget, fail-open: a Slack
 * hiccup must never fail a render batch. Honest no-op when the webhook is unset
 * (SLACK_WEBHOOK_URL comes from our side / Vercel — never committed).
 */
const WEBHOOK = () => process.env.SLACK_WEBHOOK_URL || "";

export function notifyConfigured() {
  return !!WEBHOOK();
}

/** Post plain text to Slack. Returns true if sent, false if unconfigured/failed. */
export async function notifySlack(text) {
  const url = WEBHOOK();
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

/** Format + send a render-batch summary. */
export async function notifyBatch({ dryRun, rendered = [], skipped = [], errors = [] }) {
  const tag = dryRun ? "[DRY-RUN] " : "";
  const lines = [
    `${tag}🎬 Revarity render batch — ${rendered.length} rendered, ${skipped.length} skipped, ${errors.length} errors`,
    ...rendered.map((r) => `• ✅ ${r.unit || r.id}${r.voProvider ? ` · VO:${r.voProvider}` : ""}${r.voPending ? " · ⚠️ VO pending" : ""} → Review`),
    ...skipped.map((s) => `• ⏭️ ${s.unit || s.reason}`),
    ...errors.map((e) => `• ❌ ${e.unit || ""} ${e.error || e}`.trim()),
  ];
  return notifySlack(lines.join("\n"));
}
