import { ANTHROPIC_KEY, getAngle, COPY_MODEL } from "./connectors.js";
import { hasArcads } from "./arcads.js";
import { hasVeo } from "./veo.js";
import brand from "../config/brand.json";

/**
 * The "Director" — the creative-routing brain. Takes a freeform idea OR a full script (e.g. the
 * Penthouse Pivot), reads the context, breaks it into shots, and routes EACH shot to the engine that
 * renders it best, picking placement/format too. Reuses the same Anthropic brain as copy/scoring.
 *
 * It is the decision-maker the operator asked for: "let Claude decide which model generates the best
 * result for the context." It only routes to engines that are actually CONNECTED (e.g. Arcads only if
 * the gated UGC lane is configured). Guardrails (revised D-03 + FTC) are enforced in the system prompt
 * and surfaced as guardrailFlags: presenter/host OK, fake-client testimonials and guaranteed-return
 * claims NOT; AI-generated disclosure required on shipped ads. (D-04: planning never publishes/spends.)
 *
 *   DIRECTOR_MODEL  Anthropic model (default: COPY_MODEL = claude-sonnet-5)
 */
const MODEL = process.env.DIRECTOR_MODEL || COPY_MODEL; // best Claude for ad/shot prompt-writing (centralized default)

const BRAND = [
  "Brand: Revarity — done-for-you short-term-rental (Airbnb) BUSINESS builder for serious investors with real capital. Premium, high-trust, high-ticket. Voice: direct, honest, no hype, no fake scarcity, NO guaranteed-return/occupancy/income claims.",
  "Offer (state honestly): clients come in free, pay nothing until they accept a deal; they fund their own unit at cost (no markups); management billed monthly AFTER setup. Not a course/guru program.",
].join(" ");

const ENGINE_CATALOG = (engines) => engines.map((e) => `- ${e.key}: ${e.desc}`).join("\n");

function availableEngines() {
  const list = [
    { key: "veo-presenter", kind: "presenter", desc: "Veo 3.1 — HIGHEST realism. Cinematic on-camera HOST who WALKS/PRESENTS with native synced dialogue, broadcast-grade. DEFAULT for any spoken-to-camera shot." },
    { key: "veo-broll", kind: "broll", desc: "Veo 3.1 — HIGHEST realism silent cinematic b-roll. DEFAULT for any establishing / lifestyle / product motion shot." },
    { key: "kling", kind: "broll", desc: "Kling 2.x (fal.ai) — high realism, just below Veo. Use ONLY as a Veo fallback, or when the operator explicitly wants high VOLUME." },
    { key: "kling-turbo", kind: "broll", desc: "Kling Turbo — LOWER realism, speed-optimized. Use ONLY if the operator explicitly asks for fastest/cheapest volume tests. Avoid by default." },
    { key: "higgsfield", kind: "broll", desc: "Higgsfield — LOWER realism; only subtle motion on one still. Use ONLY if the operator explicitly wants a near-static hero that moves slightly. Avoid by default." },
    { key: "nano", kind: "image", desc: "Nano Banana (Gemini PRO image model) — ultra-photorealistic STATIC image at top quality. DEFAULT for any static / hero frame." },
  ];
  if (hasArcads()) list.push({ key: "arcads", kind: "ugc", desc: "Arcads — casual SELFIE/UGC talking-head (phone-shot look). Use ONLY for top-of-funnel UGC volume tests, never premium commercials. Labeled, non-testimonial." });
  // If Veo key is absent, drop Veo options so we never route to a dead engine.
  return hasVeo() ? list : list.filter((e) => !e.key.startsWith("veo"));
}

const SHOT_SCHEMA_HINT = `Each shot object: {
  "n": <1-based int>,
  "label": "<short title, e.g. 'Hook — walk to camera'>",
  "kind": "presenter" | "broll" | "image" | "ugc",
  "engine": "veo-presenter" | "veo-broll" | "kling" | "kling-turbo" | "higgsfield" | "nano" | "arcads",
  "engineWhy": "<one line: why THIS engine for THIS shot>",
  "spec": "<one of the spec keys provided, or 'auto'>",
  "durationSec": <int 4-8 for video shots, 0 for image>,
  "prompt": "<full, vivid engine prompt for the shot — scene, motion, lighting, framing>",
  "spokenLine": "<for presenter/ugc only: the exact short line the host says on camera, else ''>",
  "headline": "<short text headline/label to store with the creative>",
  "disclosure": "ai-presenter" | null
}`;

const clampShots = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 12).map((s, i) => ({
  n: Number(s.n) || i + 1,
  label: String(s.label || `Shot ${i + 1}`).slice(0, 80),
  kind: ["presenter", "broll", "image", "ugc"].includes(s.kind) ? s.kind : "broll",
  engine: String(s.engine || "kling"),
  engineWhy: String(s.engineWhy || "").slice(0, 160),
  spec: String(s.spec || "auto"),
  durationSec: Math.min(8, Math.max(0, Number(s.durationSec) || 0)),
  prompt: String(s.prompt || "").slice(0, 1600),
  spokenLine: String(s.spokenLine || "").slice(0, 400),
  headline: String(s.headline || s.label || "").slice(0, 120),
  disclosure: s.disclosure === "ai-presenter" ? "ai-presenter" : (s.kind === "presenter" || s.kind === "ugc" ? "ai-presenter" : null),
}));

/**
 * Plan a creative from a freeform idea/script.
 * @returns { title, summary, shots[], voice|null, music|null, guardrailFlags[], model } or null on failure.
 */
export async function planFromScript({ idea = "", inspiration = "", wantVoice = false, wantMusic = false, outputPref = "auto", formatPref = "auto", angleId = "", targetSeconds = null, claimsVerified = "", claimsNot = "" } = {}) {
  if (!ANTHROPIC_KEY()) return null;
  if (!idea.trim()) return null;

  const engines = availableEngines();
  const specs = Object.entries(brand.creative_specs).map(([name, v]) => ({
    name, use: v.use, aspect: v.w === v.h ? "1:1" : v.h > v.w ? "9:16" : "16:9",
  }));
  const angle = angleId ? getAngle(angleId) : null;

  const sys = [
    `You are the CREATIVE DIRECTOR + media router for an ad studio. ${BRAND}`,
    angle ? `Target angle: ${angle.id} — audience ${angle.audience}; visual direction ${angle.visual_direction || "—"}.` : "",
    "Read the operator's idea or full script and break it into an ordered list of SHOTS. For EACH shot, choose the single engine that renders it best, and choose the placement/format. You are the decision-maker — pick what produces the best result for THIS context.",
    "",
    "ENGINES CURRENTLY CONNECTED (route only to these):",
    ENGINE_CATALOG(engines),
    "",
    "QUALITY MANDATE (non-negotiable): this brand requires ULTRA-photorealistic, broadcast-grade output. For EVERY shot pick the MOST realistic engine capable of it — default video = Veo 3.1, default image = the pro Nano model. NEVER trade realism for speed or cost. Do NOT use 'kling-turbo' or 'higgsfield' unless the operator EXPLICITLY asks for fast/volume or a deliberate near-static still; use 'kling' only as a Veo fallback or for explicit high volume. Reject any cartoon / illustration / 3D-render / uncanny AI-looking result.",
    "ROUTING RULES:",
    "- A host/presenter talking + walking + presenting on camera (premium commercial) -> 'veo-presenter' (native synced dialogue). Put the exact spoken line in spokenLine.",
    "- Silent cinematic establishing/lifestyle/product motion -> 'veo-broll' (DEFAULT, highest realism). 'kling' only as a Veo fallback or explicit high volume; avoid 'kling-turbo'/'higgsfield' unless explicitly requested.",
    "- A static frame/hero image -> 'nano' (ultra/pro).",
    "- Casual selfie/UGC talking-head -> 'arcads' ONLY if listed above (else fall back to 'veo-presenter').",
    "- Match aspect to placement: Reels/Stories/TikTok = 9:16, feed = 1:1 or 4:5, link/landscape = 16:9.",
    "",
    "PLACEMENT/FORMAT specs available (use the key in shot.spec, or 'auto' to let the renderer default):",
    specs.map((s) => `- ${s.name} (${s.aspect}): ${s.use}`).join("\n"),
    outputPref && outputPref !== "auto" ? `Operator forced OUTPUT preference: ${outputPref} (bias shots toward this).` : "Output type: AUTO — you decide the best mix.",
    formatPref && formatPref !== "auto" ? `Operator forced FORMAT/placement: ${formatPref}.` : "Format/placement: AUTO — you choose per shot.",
    targetSeconds ? `TARGET TOTAL RUNTIME: ~${targetSeconds}s. Plan shots whose durationSec roughly sum to this (each video shot 4-8s; chain enough shots to reach the target — e.g. ~${Math.max(1, Math.round(targetSeconds / 6))} shots). If a script is provided, segment it to fit.` : "Runtime: AUTO — choose a sensible length for the format.",
    wantVoice ? "Operator wants VOICEOVER added (ElevenLabs) — include a voice object with a tight script for the b-roll cut." : "",
    wantMusic ? "Operator wants MUSIC added (Lyria) — include a music object with a mood/instrument prompt (no vocals)." : "",
    "",
    "GUARDRAILS (hard): a presenter is a BRAND SPOKESPERSON, never a real-client testimonial. NEVER write a line that claims to be a Revarity client or states/implies guaranteed or specific income/return/occupancy. No fake reviews. Flag in guardrailFlags any place the operator's script crosses these lines, and soften it in the prompt/spokenLine. Presenter & UGC shots get disclosure='ai-presenter'.",
    claimsVerified ? `PROMISES VERIFIED IN WRITING (the ONLY claims allowed in any spokenLine/headline/caption, always qualified): ${claimsVerified}` : "",
    claimsNot ? `NOT CONFIRMED YET (hard KEEP-OUT — never in any shot, spokenLine, or caption; these belong in DM replies / landing page only; flag any use in guardrailFlags): ${claimsNot}` : "",
    "",
    `Return ONLY JSON: {"title":"...","summary":"<2-3 lines: the creative + why this engine mix>","shots":[ ${SHOT_SCHEMA_HINT} ],"voice":{"include":bool,"script":"..."}|null,"music":{"include":bool,"prompt":"..."}|null,"guardrailFlags":["..."]}`,
    "Return ONLY the JSON object — no prose, no markdown fences.",
  ].filter(Boolean).join("\n");

  const user = [
    `OPERATOR IDEA / SCRIPT:\n${idea.slice(0, 8000)}`,
    inspiration ? `\nINSPIRATION / REFERENCE (mimic the framework, never copy wording):\n${inspiration.slice(0, 4000)}` : "",
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3500, system: sys, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const d = await res.json();
    const txt = d?.content?.map((b) => b.text || "").join("") || "";
    let p; try { p = JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); p = m ? JSON.parse(m[0]) : null; }
    if (!p) return null;
    return {
      title: String(p.title || "Untitled creative").slice(0, 120),
      summary: String(p.summary || "").slice(0, 600),
      shots: clampShots(p.shots),
      voice: p.voice && p.voice.include ? { include: true, script: String(p.voice.script || "").slice(0, 1500) } : null,
      music: p.music && p.music.include ? { include: true, prompt: String(p.music.prompt || "").slice(0, 400) } : null,
      guardrailFlags: Array.isArray(p.guardrailFlags) ? p.guardrailFlags.map((x) => String(x).slice(0, 200)).slice(0, 8) : [],
      model: MODEL,
    };
  } catch {
    return null;
  }
}

// Shared Anthropic call + plan normalization for the batch generators below (planFromScript keeps its own
// inline copy so it stays untouched). Returns the same plan shape, or null on any failure.
async function callPlan({ sys, user, maxTokens = 4000 }) {
  if (!ANTHROPIC_KEY()) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: sys, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const d = await res.json();
    const txt = d?.content?.map((b) => b.text || "").join("") || "";
    let p; try { p = JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); p = m ? JSON.parse(m[0]) : null; }
    if (!p) return null;
    return {
      title: String(p.title || "Batch").slice(0, 120),
      summary: String(p.summary || "").slice(0, 600),
      shots: clampShots(p.shots),
      voice: null, music: null,
      guardrailFlags: Array.isArray(p.guardrailFlags) ? p.guardrailFlags.map((x) => String(x).slice(0, 200)).slice(0, 8) : [],
      model: MODEL,
    };
  } catch { return null; }
}

const specCatalog = () => Object.entries(brand.creative_specs).map(([name, v]) => ({ name, use: v.use, aspect: v.w === v.h ? "1:1" : v.h > v.w ? "9:16" : "16:9" }));
const QUALITY = "QUALITY MANDATE: ULTRA-photorealistic, broadcast-grade. Default video = Veo 3.1, default image = the pro Nano model. No cartoon / illustration / 3D-render / uncanny AI look.";
const HARD_GUARDRAILS = "GUARDRAILS (hard): a presenter is a BRAND SPOKESPERSON, never a real-client testimonial; NEVER state or imply guaranteed/specific income, return, or occupancy; no fake reviews; keep the at-cost / no-program-fee offer honest. Flag any crossing in guardrailFlags and soften it. Presenter/UGC shots get disclosure='ai-presenter'.";

/**
 * Up to N (≤10) VARIATIONS of one base concept for A/B testing — same script + background, varied hook.
 * Returns the plan shape (each variation is one shot), or null.
 */
export async function planVariations({ idea = "", inspiration = "", n = 5, outputPref = "auto", formatPref = "auto", angleId = "", targetSeconds = null } = {}) {
  if (!ANTHROPIC_KEY() || !idea.trim()) return null;
  const count = Math.min(10, Math.max(1, Number(n) || 5));
  const angle = angleId ? getAngle(angleId) : null;
  const sys = [
    `You are the CREATIVE DIRECTOR + media router for an ad studio. ${BRAND}`,
    angle ? `Target angle: ${angle.id} — audience ${angle.audience}; visual direction ${angle.visual_direction || "—"}.` : "",
    `Produce EXACTLY ${count} VARIATIONS of ONE core concept for A/B testing. Hold the SCRIPT / voiceover line and the BACKGROUND / scene SIMILAR across all of them — same setting, same engine, same format. Vary ONLY the hook / opening line, the headline wording, small framing-lighting-detail tweaks, and the CTA emphasis. Each variation is an independent sibling test, NOT a multi-shot sequence.`,
    "Return each variation as ONE shot object (n = 1..N), reusing the same engine + spec across the set unless one variation clearly needs a tweak.",
    "ENGINES CURRENTLY CONNECTED (route only to these):", ENGINE_CATALOG(availableEngines()),
    QUALITY,
    "PLACEMENT specs (use the key in shot.spec, or 'auto'):", specCatalog().map((s) => `- ${s.name} (${s.aspect}): ${s.use}`).join("\n"),
    outputPref && outputPref !== "auto" ? `Bias every variation toward output type: ${outputPref}.` : "Output type: AUTO — keep it consistent across the set.",
    formatPref && formatPref !== "auto" ? `Force format/placement: ${formatPref} for all.` : "Format: keep the SAME placement across variations.",
    targetSeconds ? `Each video variation ~${targetSeconds}s (4-8s per shot).` : "",
    HARD_GUARDRAILS,
    `Return ONLY JSON: {"title":"<N variations: concept>","summary":"<what's held constant vs what varies>","shots":[ ${SHOT_SCHEMA_HINT} ],"guardrailFlags":["..."]}`,
    "Return ONLY the JSON object — no prose, no markdown fences.",
  ].filter(Boolean).join("\n");
  const user = [
    `BASE CONCEPT TO VARY:\n${idea.slice(0, 8000)}`,
    inspiration ? `\nINSPIRATION / REFERENCE (mimic the framework, never copy wording):\n${inspiration.slice(0, 4000)}` : "",
    `\nProduce exactly ${count} sibling variations.`,
  ].join("\n");
  return callPlan({ sys, user });
}

/**
 * Up to N (≤10) NEW, distinct content concepts for an angle, cohesive with the brand's recent designs.
 * `recent` = array of recent creatives [{headline, body, angle_id, spec}]. Returns the plan shape, or null.
 */
export async function planFromAngle({ angleId = "", recent = [], n = 5, outputPref = "auto", formatPref = "auto" } = {}) {
  if (!ANTHROPIC_KEY()) return null;
  const count = Math.min(10, Math.max(1, Number(n) || 5));
  const angle = angleId ? getAngle(angleId) : null;
  const recentLines = (recent || []).slice(0, 10)
    .map((c, i) => `${i + 1}. [${c.angle_id || "—"} · ${c.spec || "—"}] "${String(c.headline || "").slice(0, 90)}"${c.body ? ` — ${String(c.body).slice(0, 90)}` : ""}`)
    .join("\n");
  const sys = [
    `You are the CREATIVE DIRECTOR for an ad studio. ${BRAND}`,
    angle ? `TARGET ANGLE: ${angle.id} — audience ${angle.audience}; lead magnet ${angle.lead_magnet || "—"}; visual direction ${angle.visual_direction || "—"}.` : "No angle was chosen — pick the best-fit angle(s) for this brand and keep the set coherent.",
    `Generate EXACTLY ${count} NEW, DISTINCT content concepts for this angle. They must feel cohesive with the brand's RECENT designs (provided below) — same visual language, voice, and quality bar — but each concept is a FRESH idea, NOT a variation of another.`,
    "Return each concept as ONE shot object (n = 1..N), ready to render.",
    "ENGINES CURRENTLY CONNECTED (route only to these):", ENGINE_CATALOG(availableEngines()),
    QUALITY,
    "PLACEMENT specs (use the key in shot.spec, or 'auto'):", specCatalog().map((s) => `- ${s.name} (${s.aspect}): ${s.use}`).join("\n"),
    outputPref && outputPref !== "auto" ? `Bias output type: ${outputPref}.` : "Output type: AUTO — choose the best per concept.",
    formatPref && formatPref !== "auto" ? `Force format/placement: ${formatPref}.` : "Format: choose the best per concept.",
    HARD_GUARDRAILS,
    `Return ONLY JSON: {"title":"<angle: N fresh concepts>","summary":"<the angle + how these stay on-brand with recent work>","shots":[ ${SHOT_SCHEMA_HINT} ],"guardrailFlags":["..."]}`,
    "Return ONLY the JSON object — no prose, no markdown fences.",
  ].filter(Boolean).join("\n");
  const user = [
    angle ? `Generate ${count} new concepts for angle ${angle.id}.` : `Generate ${count} new on-brand concepts.`,
    recentLines ? `\nRECENT DESIGNS (match their look / voice / quality bar; do NOT duplicate them):\n${recentLines}` : "\n(No recent designs on file yet — set the standard with premium, on-brand concepts.)",
  ].join("\n");
  return callPlan({ sys, user });
}
