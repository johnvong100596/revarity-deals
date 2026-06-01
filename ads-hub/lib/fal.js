/**
 * fal.ai video generation via the QUEUE API (REST, serverless-safe, stateless poll — mirrors
 * lib/higgsfield-cloud.js / lib/veo.js). One key, many models; built for high concurrency + volume
 * (no preview daily cap), so this is the hub's scale engine for ad-volume b-roll.
 *   submit: POST https://queue.fal.run/{model}          → { request_id, status_url, response_url }
 *   status: GET  {status_url}                            → { status: IN_QUEUE|IN_PROGRESS|COMPLETED }
 *   result: GET  {response_url}                          → model output, e.g. { video: { url } }
 * Auth: `Authorization: Key {FAL_KEY}` (FAL_KEY is "key_id:key_secret"). D-04: proposes only.
 */
const KEY = () => process.env.FAL_KEY || "";
const auth = () => `Key ${KEY()}`;

// Friendly engine name → fal endpoint id. All Kling text-to-video share the same input/output shape.
export const FAL_MODELS = {
  kling: "fal-ai/kling-video/v2/master/text-to-video",          // premium quality
  "kling-turbo": "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", // cheap/fast for volume
};

export function hasFal() { return !!KEY(); }

/** Submit a text-to-video job. Returns { statusUrl, responseUrl } to persist on the job for polling. */
export async function startFal(model, input) {
  if (!KEY()) throw new Error("FAL_KEY not set — required for fal.ai video.");
  const res = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`fal submit ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j.status_url || !j.response_url) throw new Error("fal submit returned no status/response url");
  return { requestId: j.request_id, statusUrl: j.status_url, responseUrl: j.response_url };
}

/** One poll. Returns { status: rendering|completed|failed, result_url?, error? }. */
export async function pollFal({ statusUrl, responseUrl }) {
  const s = await fetch(statusUrl, { headers: { Authorization: auth() } });
  if (!s.ok) throw new Error(`fal status ${s.status}`);
  const sj = await s.json();
  if (sj.status === "FAILED" || sj.status === "ERROR") return { status: "failed", error: "fal job failed" };
  if (sj.status !== "COMPLETED") return { status: "rendering" };
  const r = await fetch(responseUrl, { headers: { Authorization: auth() } });
  if (!r.ok) throw new Error(`fal result ${r.status}`);
  const out = await r.json();
  const url = out?.video?.url || out?.video_url || out?.output?.video?.url || (Array.isArray(out?.videos) ? out.videos[0]?.url : null);
  return url ? { status: "completed", result_url: url } : { status: "failed", error: "no video url in fal result" };
}
