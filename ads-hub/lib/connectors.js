import brand from "../config/brand.json";
import angles from "../config/ad-angles.json";
import { readSettings } from "./settings.js";
import { claimViolations, VERIFIED_CLAIM, DISCLAIMER } from "./claims.js";

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

// Operator overrides (Settings) merged over the read-only base. Request-scoped cache: a generation route
// calls `await primeOverrides()` once before building prompts / computing dims; the sync helpers below then
// read the merged angles + formats. (primeAngles kept as an alias for existing callers.)
let _angleOverride = null;
let _specOverride = null; // array of { name, w, h, use }
export async function primeOverrides() {
  try {
    const s = await readSettings();
    _angleOverride = Array.isArray(s.angles) && s.angles.length ? s.angles : null;
    _specOverride = Array.isArray(s.formats) && s.formats.length ? s.formats : null;
  } catch { _angleOverride = null; _specOverride = null; }
}
export const primeAngles = primeOverrides;

/**
 * Angle library is PARKED (studio-freedom): the marketing brain decides copy, structure and
 * format from the operator's prompt alone. Set ANGLES_ENABLED=1 to restore preset angles if
 * free-prompt quality drops — the library, Settings editor and overrides are all intact.
 * The claims lock (lib/claims assertClean), QA scoring, and the human approve queue are
 * infrastructure, NOT angles — they stay on regardless of this flag.
 */
export function anglesEnabled() { return String(process.env.ANGLES_ENABLED || "0") === "1"; }
export function effectiveAngles() { return anglesEnabled() ? (_angleOverride || angles.angles) : []; }
export function getAngle(id) { return effectiveAngles().find((a) => a.id === id) || null; }
function specsMap() {
  if (_specOverride) { const m = {}; for (const f of _specOverride) if (f && f.name) m[f.name] = { w: f.w, h: f.h, use: f.use }; return m; }
  return brand.creative_specs;
}
export function specDims(spec) {
  const s = specsMap()[spec];
  return s ? { w: s.w, h: s.h, aspect: s.w === s.h ? "1:1" : s.h > s.w ? "9:16" : "16:9", label: spec, use: s.use } : { w: 1080, h: 1080, aspect: "1:1", label: spec || "meta_feed_square" };
}

// SINGLE claims regime lives in lib/claims.js (money-arc / financing). Do NOT reintroduce a second
// (legacy free-entry / $375-mo / at-cost) guard here — one regime only.
const VOICE = [
  "Brand: Revarity — done-for-you short-term-rental (Airbnb) setup for property owners. We handle design, furniture, photography, and launch, end-to-end.",
  "Voice: direct, premium, honest. No hype adjectives, no emoji, no fake scarcity or countdowns.",
  "Offer (money-arc): the real barrier to launching an Airbnb is the ~$30,000 setup, not the property. We do all of it, and that setup can be financed.",
  `Claims (SINGLE regime — enforced by lib/claims.js): the ONLY financial claim allowed in creative is "${VERIFIED_CLAIM}". NEVER state or imply "0%", "APR", interest, or any credit-check language (locked until leadership unlocks per Malcolm's written terms). NEVER promise guaranteed returns/approval/income/occupancy. No fake urgency or countdowns. Every end card carries: "${DISCLAIMER}".`,
].join(" ");

// Claims flag — delegates to the single regime (lib/claims). Returns the first violation kind, or null.
function pricingFlag(text) {
  const v = claimViolations(text);
  return v.length ? v[0].kind : null;
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

// "World Tour" b-roll preset — a ~20s luxury-STR location journey (Dubai → Miami → Singapore → Mount Fuji
// → Da Nang Dragon Bridge → Toronto → Banff), built as 7 stitchable, brand-locked segments (Veo caps one
// clip at ~8s). D-03 safe: aspirational lifestyle only, no testimonials, no on-screen text. Render each
// segment, concat in order, drop the result at /public/hero/world-tour.mp4 and the hero auto-upgrades.
const WORLD_TOUR_MASTER = "Ultra-photorealistic cinematic real-estate commercial b-roll, shot on a high-end cinema camera (ARRI Alexa / RED, prime lens), broadcast/film grade, indistinguishable from real footage — no CGI, 3D render, cartoon, or AI-looking artifacts. Luxury short-term-rental aesthetic. Each location is revealed through the floor-to-ceiling window or balcony of a beautifully furnished short-term rental — interior in foreground, iconic view beyond. Warm golden-hour editorial color grade, soft natural light, shallow depth of field. Buttery-smooth, fluid, high-frame-rate motion (60fps feel) — slow, deliberate, perfectly stabilized gimbal / steadicam / slow dolly moves, natural motion blur, no stutter, judder, strobing, or warping. No on-screen text, captions, logos, or watermark. Any person is a tasteful aspirational lifestyle figure — never speaking to camera, never a testimonial.";
export const WORLD_TOUR = {
  id: "world-tour",
  title: "World Tour — luxury STR location journey (~20s, 7 stitchable segments)",
  master: WORLD_TOUR_MASTER,
  segments: [
    { location: "Dubai", shot: "Interior of a sleek marble-and-warm-wood Dubai penthouse at golden hour; an infinity-edge balcony pool in the foreground, floor-to-ceiling glass beyond framing the Burj Khalifa and amber desert skyline. Slow dolly forward toward the window.", out: "Transition out: speed-ramp whip-pan right with heavy motion blur." },
    { location: "Miami", shot: "A bright Art-Deco South Beach condo, sheer white curtains billowing in the ocean breeze; balcony over the turquoise Atlantic, palms and pastel buildings in late-afternoon sun. Glide toward the open balcony.", out: "Transition out: match-cut on the shimmering ocean surface." },
    { location: "Singapore", shot: "A modern Singapore sky-apartment with an infinity pool; Marina Bay Sands and the glowing Supertrees of Gardens by the Bay beyond at blue-gold dusk. Crane up over the pool toward the skyline.", out: "Transition out: warm lens-flare light wipe." },
    { location: "Mount Fuji", shot: "A minimalist Japanese ryokan, tatami and warm wood, an open shoji to a private onsen; snow-capped Mount Fuji beyond with cherry blossoms drifting in soft dawn light. Slow push toward the view.", out: "Transition out: cut on a warm paper-lantern glow." },
    { location: "Da Nang — Dragon Bridge", shot: "A chic riverside apartment balcony over the Han River at night; the golden Dragon Bridge breathing fire, city lights rippling on the water. Track the fire-breath along the bridge.", out: "Transition out: whip-tilt upward." },
    { location: "Toronto", shot: "A refined downtown Toronto condo with a skyline view at dusk; the CN Tower and city lights flickering on, Lake Ontario beyond, cool dusk blues warmed by interior lamplight. Slow lateral dolly across the glass.", out: "Transition out: dissolve through the window's reflection." },
    { location: "Banff", shot: "A luxury timber-and-glass mountain chalet, fireplace crackling inside; the mirror-still turquoise of Moraine Lake, snow-dusted peaks and pines reflected, crisp golden morning. Slow push out toward the lake and settle.", out: "Loop point: gentle fade designed to cut cleanly back to the opening Dubai shot." },
  ],
};
/** All 7 World Tour segments as ready-to-render prompts (each = master style + scene + transition). */
export function worldTourSegments() {
  return WORLD_TOUR.segments.map((s, i) => ({ n: i + 1, location: s.location, prompt: `${WORLD_TOUR_MASTER} SCENE — ${s.location}: ${s.shot} ${s.out}` }));
}
function buildWorldTourSegment(segment = 1, brief = "") {
  const segs = worldTourSegments();
  const s = segs[Math.max(0, (Number(segment) || 1) - 1)] || segs[0];
  return `${s.prompt}${brief ? ` Operator note: ${brief}.` : ""}`;
}

/** Build a cinematic B-ROLL prompt for Veo / Kling. D-03-safe: aspirational lifestyle footage, NEVER a
 *  talking-head/testimonial. The selling message is carried by a separate voiceover, not on-screen text.
 *  Heavy realism + smooth-motion direction so the clip looks like real high-frame-rate film, not AI video.
 *  Pass {preset:"world-tour", segment:1-7} for the reusable luxury-STR location-journey preset. */
export function buildBrollPrompt({ headline = "", angleId = "", brief = "", preset = "", segment = 0 } = {}) {
  if (preset === "world-tour") return buildWorldTourSegment(segment, brief);
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
