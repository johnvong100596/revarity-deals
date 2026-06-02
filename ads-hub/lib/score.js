import { ANTHROPIC_KEY, getAngle, specDims, COPY_MODEL } from "./connectors.js";

/**
 * Predictive "Creative Score" — reuses the SAME Anthropic brain as copy generation (no new vendor or
 * key; mirrors genCopy in connectors.js). Judges one generated ad against Revarity's REAL ICP — serious
 * STR investors with capital, not bargain consumers — on four axes.
 *
 * These are MODEL ESTIMATES, never guarantees. They are consistent with the brand's no-guarantee posture
 * and are meant to be CALIBRATED against real Meta insights (reach/saves/clicks) once posts go live.
 *
 * Non-blocking by design: returns null on any failure (missing key, API error, bad JSON) so a creative
 * STILL reaches the Review queue. Scoring is an enhancement, not a gate — unlike publishing it fails OPEN.
 * (D-04: scoring never publishes or spends; D-03 unaffected — it only reads copy/brief, never generates.)
 *
 *   SCORE_MODEL  Anthropic model for scoring (default: COPY_MODEL = claude-opus-4-8)
 */
const SCORE_MODEL = process.env.SCORE_MODEL || COPY_MODEL;

const RUBRIC = [
  "You are a senior performance-marketing strategist scoring ONE short-term-rental (Airbnb) ad creative for Revarity.",
  "Audience (ICP): serious investors with real capital evaluating a done-for-you STR business — NOT bargain consumers. They are skeptical of hype and guru/course pitches; they respond to clarity, credibility, and honestly-framed asymmetric upside.",
  "Brand voice is direct, premium, and honest — NO hype, no fake scarcity, no guaranteed-return claims. Do NOT reward hype: PENALIZE vague superlatives, fake urgency, and anything that reads like a guru/course pitch.",
  "Score each axis 0-100 with a terse one-line reason (<= 14 words). Be calibrated and skeptical: 50 = an average paid-social ad, 80+ = genuinely exceptional, < 30 = weak. Do NOT cluster everything at ~70; spread the scores to reflect real differences.",
  "Axes (note the direction of each):",
  "- hook: strength of the first impression / headline — scroll-stop power for THIS skeptical ICP. HIGHER = stronger.",
  "- virality: shareability and scroll-stopping potential of the concept itself. HIGHER = more viral.",
  "- response: predicted response rate — likelihood the ICP clicks, DMs, or opts in. HIGHER = more response.",
  "- retentionRisk: the RISK a viewer drops off before the value lands (weak/slow/confusing payoff, buried hook). HIGHER = WORSE. This axis is INVERTED relative to the others — a great ad has LOW retentionRisk.",
].join("\n");

const clampScore = (n, dflt = 50) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : dflt;
};
const axisOf = (p, key) => {
  const o = (p && p[key]) || {};
  return { score: clampScore(o.score), why: String(o.why || "").slice(0, 120) };
};

/**
 * Score a creative. Pass whatever is known: { headline, body, cta, angleId, spec, brief, hasVideo }.
 * Returns { hook, virality, response, retentionRisk, overall, model, scored_at } or null on failure.
 */
export async function scoreCreative(c = {}) {
  if (!ANTHROPIC_KEY()) return null;
  if (!c.headline && !c.body && !c.brief) return null; // nothing meaningful to judge

  const angle = c.angleId ? getAngle(c.angleId) : null;
  const fmt = c.spec ? specDims(c.spec) : null;
  const creative = [
    angle ? `Angle: ${angle.id} — audience ${angle.audience}.` : "",
    fmt
      ? `Format: ${fmt.label} (${fmt.aspect}${c.hasVideo ? ", video b-roll + voiceover" : ", static image"}).`
      : c.hasVideo ? "Format: short video b-roll + voiceover." : "Format: static image ad.",
    c.headline ? `Headline: ${c.headline}` : "",
    c.body ? `Body: ${c.body}` : "",
    c.cta ? `CTA: ${c.cta}` : "",
    c.brief ? `Operator brief / intent: ${c.brief}` : "",
  ].filter(Boolean).join("\n");

  const prompt =
    `${RUBRIC}\n\nCREATIVE TO SCORE:\n${creative}\n\n` +
    `Return ONLY JSON: {"hook":{"score":0-100,"why":"..."},"virality":{"score":0-100,"why":"..."},"response":{"score":0-100,"why":"..."},"retentionRisk":{"score":0-100,"why":"..."}}\n` +
    `Return ONLY the JSON object — no prose, no markdown fences.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: SCORE_MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const txt = d?.content?.map((b) => b.text || "").join("") || "";
    let p;
    try { p = JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); try { p = m ? JSON.parse(m[0]) : null; } catch { p = null; } }
    if (!p) return null;

    const hook = axisOf(p, "hook");
    const virality = axisOf(p, "virality");
    const response = axisOf(p, "response");
    const retentionRisk = axisOf(p, "retentionRisk");
    // Composite: average the three "higher-is-better" axes with retention (inverted), nudging hook +
    // response (the strongest predictors of paid-social performance) a touch higher in the weighting.
    const overall = Math.round(
      (hook.score * 1.2 + response.score * 1.2 + virality.score + (100 - retentionRisk.score)) / 4.4
    );
    return { hook, virality, response, retentionRisk, overall, model: SCORE_MODEL, scored_at: Date.now() };
  } catch {
    return null;
  }
}
