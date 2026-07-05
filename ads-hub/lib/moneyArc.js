/**
 * lib/moneyArc.js — the LOCKED script formula for real-photo drafts.
 *
 *   hook (AI, varies within rails) → problem ("the $30k setup") → "we do all of it"
 *   → CTA (fixed): "Zero down for qualified properties. DM \"SETUP\"." → end card + disclaimer
 *
 * Only the hook is generated; everything else is fixed. Every assembled draft is run through the
 * claims lock (lib/claims) and FAILS the build on any violation. AI hooks are additionally filtered
 * so a stray claim/urgency line can never reach assembly.
 */
// Env-direct (NOT imported from connectors.js) so this module stays portable — it runs in the
// GitHub Actions render runner, which can't pull in the Next-coupled connectors chain (JSON imports etc).
const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY || "";
const COPY_MODEL = process.env.COPY_MODEL || "claude-opus-4-8";
import { CTA_LINE, DISCLAIMER, DM_KEYWORD, assertClean, claimViolations, endCard } from "./claims.js";

// Fixed spine (never AI-generated — no claim drift possible).
const PROBLEM = "It's not the property — it's the thirty-thousand-dollar setup.";
const WE_DO_IT_ALL = "Design. Furniture. Photography. Launch. We do all of it.";

// Burned-caption beats (safe-zone lines; word-cuts for the montage carried separately by the renderer).
const CAPTIONS = ["what actually stops most airbnbs", "it's the $30k setup", "we do all of it", "$0 down for qualified properties*"];

/** Assemble a full, locked draft from one hook. Throws CLAIMS_LOCK if anything violates. */
export function buildScript({ hook, unit = "" }) {
  const clean = String(hook || "").trim();
  if (!clean) throw new Error("moneyArc.buildScript: hook required");
  const draft = {
    formula: "money-arc.v1",
    unit,
    hook: clean,
    problem: PROBLEM,
    weDoItAll: WE_DO_IT_ALL,
    cta: CTA_LINE,
    captions: [clean.toLowerCase(), ...CAPTIONS],
    endCard: endCard(['REVARITY', "Every detail matters.", DM_KEYWORD]),
    // post caption: lowercase, casual, one line, DM keyword only (no claim in the organic caption body)
    postCaption: `the real wall to your first airbnb isn't the property. dm '${DM_KEYWORD}'.`,
    disclaimer: DISCLAIMER,
    voLines: [clean, PROBLEM, WE_DO_IT_ALL, CTA_LINE], // what Zoe reads, in order
  };
  assertClean(draft); // hard gate — throws → caller must fail the build, never queue
  return draft;
}

/**
 * Generate N candidate hooks for the money-arc (curiosity, no pitch, ≤12 words, NO claim/urgency).
 * Returns only hooks that pass the claims lock. Never emits a financial claim — the CTA carries the
 * single allowed claim, not the hook.
 */
export async function genHooks({ unitContext = "", n = 3 } = {}) {
  if (!ANTHROPIC_KEY()) throw new Error("ANTHROPIC_API_KEY not set — required for hook generation.");
  const prompt = [
    "You write the OPENING LINE (hook) for a short-form ad for Revarity — a done-for-you Airbnb setup service.",
    "The ad's arc is fixed: hook → 'the $30,000 setup is the real barrier' → 'we do all of it' → offer.",
    "Write ONLY the hook: a curiosity opener that makes a property owner stop scrolling. Rules, hard:",
    "- ≤ 12 words. Conversational, plain, no hype adjectives, no emoji.",
    "- NO financial claim of any kind (no '$0 down', no pricing, no 'APR', no 'free', no numbers-as-promise).",
    "- NO urgency, NO scarcity, NO guarantee, NO income promise.",
    "- Do not name a price. Do not mention financing. Just the hook that sets up 'the setup cost is the wall'.",
    unitContext ? `Context about the unit in the photos (for flavor only, don't over-describe): ${unitContext}` : "",
    `Return ONLY JSON: {"hooks":["...","..."]} with ${n} distinct options.`,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: COPY_MODEL, max_tokens: 500, messages: [{ role: "user", content: prompt + "\n\nReturn ONLY the JSON object." }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const txt = d?.content?.map((b) => b.text || "").join("") || "";
  let parsed;
  try { parsed = JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { hooks: [] }; }
  const raw = Array.isArray(parsed.hooks) ? parsed.hooks : [];
  // defense-in-depth: drop any hook that trips the claims lock or is too long
  return raw
    .map((h) => String(h || "").trim())
    .filter((h) => h && h.split(/\s+/).length <= 12 && claimViolations(h).length === 0);
}
