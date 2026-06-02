import brand from "../config/brand.json";
import angles from "../config/ad-angles.json";
import { readSettings } from "./settings.js";

/**
 * Direct-REST generation connectors (serverless-safe, fetch-only — no CLI, no SDK deps).
 *   copy   → Anthropic Messages API   (COPY_MODEL, default claude-opus-4-8)
 *   image  → Google Gemini API "Nano Banana"  (IMG_MODEL, default gemini-3.1-flash-image-preview)
 *   video  → Higgsfield (lib/higgsfield.js)
 * Brand-locked + pricing-guarded (D-01: $375/mo flat is OK; setup fee / rev-share are NOT).
 * Nothing here publishes or spends on ads (D-04).
 */
// Single source of truth for the marketing/ads "brain" model — imported by director, score, research,
// swipe, recommend, and the Settings display. Best Claude for ads/prompt-writing. Override per-env.
export const COPY_MODEL = process.env.COPY_MODEL || "claude-opus-4-8";
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

// Operator angle overrides (Settings) merged over the read-only base. Request-scoped cache: a generation
// route calls `await primeAngles()` once before building prompts; the sync builders then read via getAngle.
let _angleOverride = null;
export async function primeAngles() {
  try { const s = await readSettings(); _angleOverride = Array.isArray(s.angles) && s.angles.length ? s.angles : null; }
  catch { _angleOverride = null; }
}
export function effectiveAngles() { return _angleOverride || angles.angles; }
export function getAngle(id) { return effectiveAngles().find((a) => a.id === id) || null; }
export function specDims(spec) {
  const s = brand.creative_specs[spec];
  return s ? { w: s.w, h: s.h, aspect: s.w === s.h ? "1:1" : s.h > s.w ? "9:16" : "16:9", label: spec, use: s.use } : { w: 1080, h: 1080, aspect: "1:1", label: spec || "meta_feed_square" };
}

const VOICE = [
  "Brand: Revarity, Inc. — a done-for-you short-term-rental (Airbnb) BUSINESS builder for serious investors with real capital. We source the unit, coordinate the lease, design & furnish it, launch the listing, and manage it end-to-end.",
  "Voice: direct, premium, honest. No hype adjectives, no emoji, no fake scarcity or countdowns.",
  "Offer model (state honestly): clients come in FREE — browse sourced deals and join the community at no cost, and pay nothing until they ACCEPT a specific deal. There is NO tuition, franchise, membership, or entry ('door') fee. It is NOT a course or guru program. The client funds their own unit's launch cost (their business expense and asset), provided AT COST with no inflated markups. Management is a separate ONGOING service billed AFTER the unit is set up — never an upfront charge.",
  "Claims guard: NEVER promise or imply guaranteed returns, occupancy, or profit — results vary and the client assumes full financial responsibility. Any projected income must be a RANGE labelled 'estimate' with a 'no guarantee' note. If you say 'no upfront cost,' you MUST qualify that it means no program/entry/franchise fee (the client still funds their own unit at cost). Never imply hidden markups; never show itemized markup.",
].join(" ");

// Flag the highest-risk claims for human review under the at-cost / no-guarantee model.
function pricingFlag(text) {
  const t = (text || "").toLowerCase();
  if (/guarantee|guaranteed|risk[\s-]?free|can't lose|cannot lose/.test(t)) return "REVIEW-guarantee-claim";
  if (/revenue share|%\s*(rev|revenue|share)/.test(t)) return "REVIEW-rev-share";
  if (/\bno (up[\s-]?front|upfront) (cost|fee|investment)s?\b/.test(t) && !/(program|entry|franchise|tuition|door|membership) fee/.test(t)) return "REVIEW-upfront-claim";
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

/** Propose ONE new ad angle for the operator to review/edit before saving. Returns a single angle object
 *  (id/type/audience/lead_magnet/visual_direction/variants). Brand-voice + claims-guard aware. */
export async function genAngle({ brief = "", existing = [] } = {}) {
  if (!ANTHROPIC_KEY()) throw new Error("ANTHROPIC_API_KEY not set — required to generate an angle.");
  const ids = (existing || []).map((a) => a.id).filter(Boolean).join(", ");
  const prompt = [
    VOICE,
    brief ? `The operator wants a new ad angle around: ${brief}` : "Propose one fresh, distinct ad angle for this brand's paid funnel.",
    ids ? `Make it genuinely different from these existing angles: ${ids}.` : "",
    "Honor the claims guard: no guaranteed returns; any income is a labelled estimate range.",
    `Return ONLY JSON: {"id":"AD#_SHORT_SLUG (uppercase + underscores)","type":"lead_magnet|direct_offer|awareness","audience":"who this targets","lead_magnet":"the free thing offered (empty string for direct_offer)","visual_direction":"one sentence of art direction","variants":[{"id":"A","hook":"one-word hook","headline":"the hook headline","cta":"button text"}]}`,
  ].filter(Boolean).join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: COPY_MODEL, max_tokens: 900, messages: [{ role: "user", content: prompt + "\n\nReturn ONLY the JSON object — no prose, no markdown fences." }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const txt = d?.content?.map((b) => b.text || "").join("") || "";
  let a; try { a = JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); a = m ? JSON.parse(m[0]) : null; }
  if (!a || !a.id) throw new Error("angle generation returned nothing usable");
  return a;
}

/** Build a brand-locked image prompt (template — deterministic, no extra model call). */
export function buildImagePrompt({ headline = "", angleId = "", spec = "meta_feed_square", extra = "" }) {
  const angle = getAngle(angleId);
  const d = specDims(spec);
  return [
    `Premium editorial advertising visual, ${d.aspect} aspect (${d.w}x${d.h}). ${d.use}.`,
    `Brand palette: deep ink (#0a0a0b) and warm cream (#f5f1e8) with gold (#c9a961) accents; radial gold glow on dark for atmosphere; generous negative space.`,
    angle?.visual_direction ? `Art direction: ${angle.visual_direction}` : "Art direction: clean, premium real-estate / short-term-rental aesthetic.",
    `ULTRA-photorealistic — indistinguishable from a real professional photograph; absolutely no illustration, cartoon, 3D-render, or AI-looking artifacts. Tasteful, never stock-photo gloss. No purple, no SaaS-blue, no emoji.`,
    extra ? `Operator note: ${extra}` : "",
    `Leave clean upper space for an overlaid headline. Do NOT render garbled text in the image. Concept: "${headline}".`,
    `No fabricated people implying a real customer or founder.`,
  ].filter(Boolean).join(" ");
}

/** Negative prompt for the text-to-video engines that accept one (Kling / fal). Targets the artifacts
 *  that betray AI video and the low-frame-rate "choppy" look — so the b-roll reads as smooth real footage. */
export const VIDEO_NEGATIVE = [
  "low frame rate, choppy, stutter, judder, strobing, jerky motion, motion artifacts, ghosting, frame blending, time-lapse,",
  "warping, morphing, melting, flickering, wobbling, blurry, soft focus, low resolution, pixelated, compression artifacts,",
  "distorted, deformed, extra limbs, extra fingers, malformed hands, plastic skin, waxy skin, uncanny, mannequin,",
  "cartoon, anime, illustration, painting, 3d render, cgi, video game, claymation, stop motion,",
  "watermark, text, captions, subtitles, logo, timestamp, oversaturated, washed out, harsh flat lighting, stock footage look",
].join(" ");

/** Build a cinematic B-ROLL prompt for Veo / Kling. D-03-safe: aspirational lifestyle footage, NEVER a
 *  talking-head/testimonial. The selling message is carried by a separate voiceover, not on-screen text.
 *  Heavy realism + smooth-motion direction so the clip looks like real high-frame-rate film, not AI video. */
export function buildBrollPrompt({ headline = "", angleId = "", brief = "" }) {
  const angle = getAngle(angleId);
  return [
    "Ultra-photorealistic cinematic B-ROLL for a premium short-form ad — indistinguishable from real footage shot on a high-end cinema camera (ARRI Alexa / RED) with a prime lens. Broadcast / film grade. Absolutely NO CGI, 3D render, cartoon, illustration, plastic texture, waxy skin, or AI-looking artifacts.",
    "Motion: buttery-smooth, fluid, high-frame-rate look (60fps feel) — slow, deliberate, perfectly stabilized camera moves (gimbal, steadicam, gentle drone glide, or subtle dolly). Natural, tasteful motion blur. NO stutter, judder, strobing, warping, morphing, jitter, or frame-skipping.",
    "Photography: warm editorial color grade, soft natural light, shallow depth of field, fine real-world texture and detail — fabric weave, wood grain, glass and metal reflections. Never stock-photo gloss, never over-saturated.",
    angle?.visual_direction ? `Scene direction: ${angle.visual_direction}.` : "Scene: a beautifully furnished luxury short-term rental / penthouse with aspirational lifestyle moments.",
    brief ? `Operator note: ${brief}.` : "",
    `Mood/theme to evoke (do NOT render as on-screen text): "${headline}".`,
    "If a person appears, they are an aspirational lifestyle figure moving naturally through the space — NOT speaking to camera, NOT a testimonial. No captions, no logos, no on-screen text, no watermark.",
  ].filter(Boolean).join(" ");
}

/** Build a PRESENTER / commercial prompt (Veo native synced dialogue). A brand SPOKESPERSON who walks
 *  through and presents a luxury STR space, talking to camera — premium commercial, NOT selfie/UGC.
 *  Revised-D-03 safe: a host/presenter is allowed; a fake CLIENT/testimonial or any guaranteed-return
 *  claim is NOT. The spoken line is rendered as native audio by Veo, so keep it short enough for the clip. */
export function buildPresenterPrompt({ headline = "", body = "", cta = "", angleId = "", brief = "", spokenLine = "" }) {
  const angle = getAngle(angleId);
  const line = (spokenLine || headline || "").trim();
  return [
    "Cinematic, ULTRA-photorealistic short-form VIDEO AD with a single on-camera PRESENTER (brand spokesperson) — broadcast-grade; the host looks like a real human on real film, no uncanny / CGI / AI-looking artifacts. Premium real-estate / luxury commercial look, NOT a selfie or phone-shot UGC video.",
    "The presenter is a credible, aspirational host who walks through and presents a beautifully furnished luxury short-term-rental space, speaking directly and naturally to camera. Confident and conversational — no hype, no influencer cadence, no hard-sell energy.",
    angle?.visual_direction ? `Scene / art direction: ${angle.visual_direction}.` : "Scene: a high-end furnished STR / penthouse — floor-to-ceiling windows, city or coastal view, warm editorial lighting; smooth gimbal/steadicam motion following the host through the space.",
    "Motion & realism: buttery-smooth, fluid, high-frame-rate look (60fps feel) — stabilized gimbal/steadicam moves, natural motion blur, no stutter, judder, warping, or strobing; the host's movement and lip-sync look completely natural, shot on a high-end cinema camera.",
    brief ? `Director's note: ${brief}.` : "",
    line ? `The presenter says, in a natural conversational tone (lip-synced): "${line}"` : "",
    "Warm cinematic color grade, shallow depth of field, premium broadcast quality. No on-screen text, captions, or logos burned into the frame.",
    "GUARDRAILS (must hold): the presenter is a BRAND SPOKESPERSON, NOT a customer or testimonial. Do NOT have them claim to be a Revarity client, and do NOT state or imply any guaranteed or specific income, return, or occupancy. No fabricated results, no fake reviews.",
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
