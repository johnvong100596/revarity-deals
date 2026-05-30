import brand from "../config/brand.json";
import angles from "../config/ad-angles.json";

/**
 * Direct-REST generation connectors (serverless-safe, fetch-only — no CLI, no SDK deps).
 *   copy   → Anthropic Messages API   (COPY_MODEL, default claude-sonnet-4-6)
 *   image  → Google Gemini API "Nano Banana"  (IMG_MODEL, default gemini-3.1-flash-image-preview)
 *   video  → Higgsfield (lib/higgsfield.js)
 * Brand-locked + pricing-guarded (D-01: $375/mo flat is OK; setup fee / rev-share are NOT).
 * Nothing here publishes or spends on ads (D-04).
 */
const COPY_MODEL = process.env.COPY_MODEL || "claude-sonnet-4-6";
const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-image-preview";
const IMG_FINAL = process.env.IMG_FINAL_MODEL || "gemini-3-pro-image-preview";

export const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY || "";
export const GEMINI_KEY = () => process.env.GEMINI_API_KEY || "";

export function keyStatus() {
  return {
    copy: !!ANTHROPIC_KEY(),
    image: !!GEMINI_KEY(),
    video: !!((process.env.HF_API_KEY || process.env.HIGGSFIELD_API_KEY_ID) && (process.env.HF_API_SECRET || process.env.HIGGSFIELD_API_KEY_SECRET)),
  };
}

export function getAngle(id) { return angles.angles.find((a) => a.id === id) || null; }
export function specDims(spec) {
  const s = brand.creative_specs[spec];
  return s ? { w: s.w, h: s.h, aspect: s.w === s.h ? "1:1" : s.h > s.w ? "9:16" : "16:9", label: spec, use: s.use } : { w: 1080, h: 1080, aspect: "1:1", label: spec || "meta_feed_square" };
}

const VOICE = [
  "Brand: Revarity — done-for-you short-term-rental / Airbnb arbitrage for people with real capital.",
  "Voice: direct, premium, no hype adjectives, state the model honestly. No emoji. No fake scarcity.",
  "Numbers: any projected income is a RANGE and labelled 'estimate' — never a single inflated number.",
  "Pricing guard (D-01): you MAY state pricing is $375/month flat, fully-managed, no revenue share. Do NOT state any setup fee or % revenue share.",
].join(" ");

function pricingFlag(text) {
  const t = (text || "").toLowerCase();
  if (/\bsetup fee\b|\b\$?\d[\d,]*k?\s*(setup|to set up)\b/.test(t)) return "REVIEW-setup-fee";
  if (/%\s*(rev|revenue|share)|revenue share/.test(t)) return "REVIEW-rev-share";
  return null;
}

/** Generate N original copy variants. Returns [{ headline, body, cta, pricing_flag }]. */
export async function genCopy({ angleId, brief = "", reference = "", n = 1 }) {
  if (!ANTHROPIC_KEY()) throw new Error("ANTHROPIC_API_KEY not set — required for copy generation.");
  const angle = getAngle(angleId);
  const prompt = [
    VOICE,
    angle ? `Angle ${angle.id}: audience = ${angle.audience}; lead magnet = ${angle.lead_magnet || "—"}; visual direction = ${angle.visual_direction || "—"}.` : "",
    brief ? `Operator brief (what they want this round): ${brief}` : "",
    reference ? `Reference patterns to MIMIC IN SPIRIT (never copy wording — learn the framework): ${reference}` : "",
    `Produce ${n} distinct, original ad concept(s).`,
    `Return ONLY JSON: {"variants":[{"headline":"...","body":"1-2 sentences","cta":"...","hook":"one-word hook"}]}`,
  ].filter(Boolean).join("\n\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: COPY_MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt + "\n\nReturn ONLY the JSON object — no prose, no markdown fences." }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const txt = d?.content?.map((b) => b.text || "").join("") || "";
  let parsed; try { parsed = JSON.parse(txt); } catch { try { const m = txt.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { variants: [] }; } catch { parsed = { variants: [] }; } }
  return (parsed.variants || []).slice(0, n).map((v) => ({
    headline: v.headline || "", body: v.body || "", cta: v.cta || "Learn more", hook: v.hook || "custom",
    pricing_flag: pricingFlag(`${v.headline} ${v.body}`),
  }));
}

/** Build a brand-locked image prompt (template — deterministic, no extra model call). */
export function buildImagePrompt({ headline = "", angleId = "", spec = "meta_feed_square", extra = "" }) {
  const angle = getAngle(angleId);
  const d = specDims(spec);
  return [
    `Premium editorial advertising visual, ${d.aspect} aspect (${d.w}x${d.h}). ${d.use}.`,
    `Brand palette: deep ink (#0a0a0b) and warm cream (#f5f1e8) with gold (#c9a961) accents; radial gold glow on dark for atmosphere; generous negative space.`,
    angle?.visual_direction ? `Art direction: ${angle.visual_direction}` : "Art direction: clean, premium real-estate / short-term-rental aesthetic.",
    `Photoreal where it shows a space; tasteful, never stock-photo gloss. No purple, no SaaS-blue, no emoji.`,
    extra ? `Operator note: ${extra}` : "",
    `Leave clean upper space for an overlaid headline. Do NOT render garbled text in the image. Concept: "${headline}".`,
    `No fabricated people implying a real customer or founder.`,
  ].filter(Boolean).join(" ");
}

/** Render an image with Gemini (Nano Banana). Returns a PNG Buffer. */
export async function renderImage(prompt, { final = false } = {}) {
  if (!GEMINI_KEY()) throw new Error("GEMINI_API_KEY not set — required for image rendering.");
  const model = final ? IMG_FINAL : IMG_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY() },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const img = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!img) throw new Error("Gemini returned no image.");
  return Buffer.from(img.inlineData.data, "base64");
}
