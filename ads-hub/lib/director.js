import { ANTHROPIC_KEY, getAngle } from "./connectors.js";
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
 *   DIRECTOR_MODEL  Anthropic model (default COPY_MODEL, then claude-sonnet-4-6)
 */
const MODEL = process.env.DIRECTOR_MODEL || process.env.COPY_MODEL || "claude-sonnet-4-6";

const BRAND = [
  "Brand: Revarity — done-for-you short-term-rental (Airbnb) BUSINESS builder for serious investors with real capital. Premium, high-trust, high-ticket. Voice: direct, honest, no hype, no fake scarcity, NO guaranteed-return/occupancy/income claims.",
  "Offer (state honestly): clients come in free, pay nothing until they accept a deal; they fund their own unit at cost (no markups); management billed monthly AFTER setup. Not a course/guru program.",
].join(" ");

const ENGINE_CATALOG = (engines) => engines.map((e) => `- ${e.key}: ${e.desc}`).join("\n");

function availableEngines() {
  const list = [
    { key: "veo-presenter", kind: "presenter", desc: "Veo 3.1 — cinematic on-camera HOST/presenter who WALKS and PRESENTS with native synced dialogue. Premium commercial look. USE for any spoken-to-camera segment that should look like a polished real-estate/luxury commercial." },
    { key: "veo-broll", kind: "broll", desc: "Veo 3.1 — premium silent cinematic b-roll (no person speaking). Best quality motion/establishing shots." },
    { key: "kling", kind: "broll", desc: "Kling (fal.ai) — scalable cinematic b-roll motion, cheaper than Veo, good for volume." },
    { key: "kling-turbo", kind: "broll", desc: "Kling Turbo (fal.ai) — fastest/cheapest b-roll for high-volume variant tests." },
    { key: "higgsfield", kind: "broll", desc: "Higgsfield — subtle motion on a single brand still (ambient parallax/push-in). Cheapest; use for a calm hero still that moves slightly." },
    { key: "nano", kind: "image", desc: "Nano Banana (Gemini) — premium STATIC image ad. Use for static placements or a clean hero frame." },
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
export async function planFromScript({ idea = "", inspiration = "", wantVoice = false, wantMusic = false, outputPref = "auto", formatPref = "auto", angleId = "" } = {}) {
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
    "ROUTING RULES:",
    "- A host/presenter talking + walking + presenting on camera (premium commercial) -> 'veo-presenter' (it has native synced dialogue). Put the exact spoken line in spokenLine.",
    "- Silent cinematic establishing/lifestyle/product motion -> 'veo-broll' (best) or 'kling'/'kling-turbo' (cheaper, for volume) or 'higgsfield' (subtle motion on one still).",
    "- A static frame/hero image -> 'nano'.",
    "- Casual selfie/UGC talking-head -> 'arcads' ONLY if listed above (else fall back to 'veo-presenter').",
    "- Match aspect to placement: Reels/Stories/TikTok = 9:16, feed = 1:1 or 4:5, link/landscape = 16:9.",
    "",
    "PLACEMENT/FORMAT specs available (use the key in shot.spec, or 'auto' to let the renderer default):",
    specs.map((s) => `- ${s.name} (${s.aspect}): ${s.use}`).join("\n"),
    outputPref && outputPref !== "auto" ? `Operator forced OUTPUT preference: ${outputPref} (bias shots toward this).` : "Output type: AUTO — you decide the best mix.",
    formatPref && formatPref !== "auto" ? `Operator forced FORMAT/placement: ${formatPref}.` : "Format/placement: AUTO — you choose per shot.",
    wantVoice ? "Operator wants VOICEOVER added (ElevenLabs) — include a voice object with a tight script for the b-roll cut." : "",
    wantMusic ? "Operator wants MUSIC added (Lyria) — include a music object with a mood/instrument prompt (no vocals)." : "",
    "",
    "GUARDRAILS (hard): a presenter is a BRAND SPOKESPERSON, never a real-client testimonial. NEVER write a line that claims to be a Revarity client or states/implies guaranteed or specific income/return/occupancy. No fake reviews. Flag in guardrailFlags any place the operator's script crosses these lines, and soften it in the prompt/spokenLine. Presenter & UGC shots get disclosure='ai-presenter'.",
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
