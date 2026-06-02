/**
 * Veo 3.1 text-to-video via the Gemini API (REST, serverless-safe, fetch-only — stateless poll pattern,
 * mirrors lib/higgsfield-cloud.js so /api/generate/[id] can poll without holding a function open).
 * Two modes: (1) silent cinematic B-ROLL (penthouse, lifestyle) — voiceover layered via ElevenLabs;
 * (2) PRESENTER commercials — a brand spokesperson walking/presenting with NATIVE synced dialogue
 * (rendered directly from the prompt; no generateAudio/personGeneration params — the Gemini API rejects
 * them). Revised-D-03: a presenter/host is allowed; fake-client testimonials and guaranteed-return
 * claims are NOT (enforced in the prompt + the human gate).
 *
 *   start: POST /v1beta/models/{model}:predictLongRunning  { instances:[{prompt}], parameters:{...} } → { name }
 *   poll:  GET  /v1beta/{operation.name}  → { done, response|error }
 * The finished video URI is a Gemini file that needs the API key to fetch, so the poll route downloads
 * it (see fetchVeoVideo) and re-hosts it as a public Blob the browser can play.
 */
const BASE = process.env.VEO_URL || "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.VEO_MODEL || "veo-3.1-generate-preview";
const KEY = () => process.env.GEMINI_API_KEY || "";

export function hasVeo() { return !!KEY(); }

/** Start a Veo b-roll job. Returns the long-running operation name (store it on the job). */
export async function startVeo({ prompt, aspectRatio = "9:16", resolution = "720p" }) {
  if (!KEY()) throw new Error("GEMINI_API_KEY not set — required for Veo video.");
  // Gemini-API Veo: `generateAudio` and `personGeneration:"allow_adult"` are NOT accepted (Vertex-only /
  // region-gated → 400). Veo 3.1 renders people AND native synced audio directly from the prompt, so the
  // presenter's host + spoken line come from buildPresenterPrompt. Keep parameters minimal.
  const parameters = { aspectRatio, resolution };
  const res = await fetch(`${BASE}/models/${MODEL}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY(), "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [{ prompt }], parameters }),
  });
  if (!res.ok) throw new Error(`Veo start ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j.name) throw new Error("Veo returned no operation name");
  return j.name;
}

/** One poll. Returns { status: rendering|completed|failed, video_uri?, error? }. */
export async function pollVeo(opName) {
  const res = await fetch(`${BASE}/${opName}`, { headers: { "x-goog-api-key": KEY() } });
  if (!res.ok) throw new Error(`Veo poll ${res.status}`);
  const j = await res.json();
  if (!j.done) return { status: "rendering" };
  if (j.error) return { status: "failed", error: j.error.message || JSON.stringify(j.error).slice(0, 200) };
  // Response nesting varies across Veo revisions — dig the common shapes for the file URI.
  const r = j.response || {};
  // Veo's Responsible-AI filter can block output (often the native audio/dialogue) — surface the real
  // reason so the operator knows to tweak the line + retry (these attempts are not billed).
  const rai = r.generateVideoResponse?.raiMediaFilteredReasons;
  if (Array.isArray(rai) && rai.length) return { status: "failed", error: `Veo content filter: ${String(rai[0]).slice(0, 220)}` };
  const samples =
    r.generatedVideos || r.generateVideoResponse?.generatedSamples || r.generatedSamples ||
    r.videos || (r.video ? [r] : []);
  const s = Array.isArray(samples) ? samples[0] : null;
  const uri = s?.video?.uri || s?.video?.videoUri || s?.uri || s?.videoUri || r?.video?.uri || null;
  return uri ? { status: "completed", video_uri: uri } : { status: "failed", error: "no video uri in Veo response" };
}

/** Download a finished Veo video (the file URI needs the API key) → Buffer. */
export async function fetchVeoVideo(uri) {
  const url = uri.includes("?") ? `${uri}&key=${KEY()}` : `${uri}?key=${KEY()}`;
  const res = await fetch(url, { headers: { "x-goog-api-key": KEY() } });
  if (!res.ok) throw new Error(`Veo download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
