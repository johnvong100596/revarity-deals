/**
 * Higgsfield Cloud API client (image→video) — platform.higgsfield.ai.
 * Auth: `Authorization: Key KEY_ID:KEY_SECRET` (stable key/secret pair — does NOT rotate like the
 * device token, so it's safe in serverless env). Funded wallet w/ auto-topup. See CONTRACT.md.
 *   create: POST /v1/image2video/dop  { params:{ model, prompt, input_images:[{type:image_url,image_url}] } } → { id, jobs:[…] }
 *   poll:   GET  /v1/job-sets/{id}    → jobs[0].status (queued|in_progress|completed|failed|nsfw) + jobs[0].results.raw.url
 */
const BASE = process.env.HF_CLOUD_URL || "https://platform.higgsfield.ai";
const KEY = process.env.HF_API_KEY || process.env.HIGGSFIELD_API_KEY_ID || "";
const SECRET = process.env.HF_API_SECRET || process.env.HIGGSFIELD_API_KEY_SECRET || "";

export function hasCloudKey() { return !!(KEY && SECRET); }
const authHeader = () => `Key ${KEY}:${SECRET}`;

/** Create an image→video job; returns the job-set id. imageUrl must be publicly fetchable. */
export async function startVideo({ imageUrl, prompt, model = "dop-turbo" }) {
  if (!hasCloudKey()) throw new Error("HF_API_KEY/HF_API_SECRET not set — required for video.");
  const res = await fetch(`${BASE}/v1/image2video/dop`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ params: { model, prompt, input_images: [{ type: "image_url", image_url: imageUrl }] } }),
  });
  if (!res.ok) throw new Error(`Higgsfield Cloud create ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j.id) throw new Error("Cloud create returned no job-set id");
  return j.id;
}

/** One poll of a job set. Returns { status, result_url|null }. */
export async function pollVideo(setId) {
  const res = await fetch(`${BASE}/v1/job-sets/${setId}`, { headers: { Authorization: authHeader() } });
  if (!res.ok) throw new Error(`Higgsfield Cloud poll ${res.status}`);
  const j = await res.json();
  const job = (j.jobs || [])[0] || {};
  const url = job.results?.raw?.url || job.results?.min?.url || null;
  return { status: job.status, result_url: url };
}
