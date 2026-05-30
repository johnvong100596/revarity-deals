#!/usr/bin/env node
/**
 * higgsfield.mjs — dependency-free direct client for the Higgsfield "agents" API.
 * --------------------------------------------------------------------------------
 * Reverse-engineered from the @higgsfield/cli binary + a forwarding capture proxy (see CONTRACT.md).
 * Lets the engine (and the deployed app) generate images/videos over raw HTTP with NO CLI binary.
 *
 * Auth: reads {access_token, refresh_token} from $HIGGSFIELD_CREDENTIALS_PATH or
 *       ~/.config/higgsfield/credentials.json (the file the CLI's `hf auth login` writes).
 *       On 401 it refreshes via the device-auth endpoint and rewrites the file.
 *
 * Image→video flow (what imageToVideo() does):
 *   1. POST {API}/agents/uploads?type=image            → { id, url, upload_url }   (presigned S3 PUT)
 *   2. PUT  {upload_url}  (file bytes, Content-Type)    → 200                       (direct to S3)
 *   3. POST {API}/agents/uploads/{id}/confirm?type=image → { status:"uploaded" }
 *   4. POST {API}/agents/jobs  { job_set_type, params:{ medias:[{data:{id,type:"media_input"},role:"start_image"}], ... } }
 *                                                       → ["<job_id>"]
 *   5. GET  {API}/agents/jobs/{job_id}  (poll)          → { status, result_url, ... }  until status==="completed"
 *
 * CLI:
 *   node higgsfield.mjs balance
 *   node higgsfield.mjs upload ./img.png
 *   node higgsfield.mjs cost  seedance1_5 ./img.png --prompt "push in" --resolution 1080p --duration 4
 *   node higgsfield.mjs i2v   seedance1_5 ./img.png --prompt "push in" --resolution 1080p --duration 4 --out clip.mp4
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const API = process.env.HIGGSFIELD_API_URL || "https://fnf.higgsfield.ai";
const DEVICE_AUTH = process.env.HIGGSFIELD_DEVICE_AUTH_URL || "https://fnf-device-auth.higgsfield.ai";
const CLIENT = process.env.HIGGSFIELD_CLIENT_NAME || "claude_code";
const CRED_PATH = process.env.HIGGSFIELD_CREDENTIALS_PATH || path.join(os.homedir(), ".config", "higgsfield", "credentials.json");

// ── credentials (load / persist) ─────────────────────────────────────────────────
function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CRED_PATH, "utf8")); }
  catch { throw new Error(`no Higgsfield credentials at ${CRED_PATH} — run \`hf auth login\` once, or set HIGGSFIELD_CREDENTIALS_PATH`); }
}
function saveCreds(c) { fs.writeFileSync(CRED_PATH, JSON.stringify(c, null, 2)); }
let creds = loadCreds();

async function refresh() {
  const r = await fetch(`${DEVICE_AUTH}/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hf-mcp-client-name": CLIENT },
    body: JSON.stringify({ refresh_token: creds.refresh_token }),
  });
  if (!r.ok) throw new Error(`token refresh failed ${r.status}: ${(await r.text()).slice(0, 200)} — re-run \`hf auth login\``);
  const t = await r.json();
  creds = { ...creds, ...t };                 // {access_token, refresh_token, expires_in}
  saveCreds({ access_token: creds.access_token, refresh_token: creds.refresh_token });
  return creds.access_token;
}

// ── core request (Bearer auth, one refresh-and-retry on 401) ─────────────────────
async function api(method, pathname, { json, raw, retry = true } = {}) {
  const headers = { authorization: `Bearer ${creds.access_token}`, "x-hf-mcp-client-name": CLIENT };
  let body;
  if (json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(json); }
  const res = await fetch(`${API}${pathname}`, { method, headers, body });
  if (res.status === 401 && retry) { await refresh(); return api(method, pathname, { json, raw, retry: false }); }
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return raw ? res : res.json();
}

// ── public surface ─────────────────────────────────────────────────────────────────
export async function balance() { return api("GET", "/agents/balance"); }
export async function models() { return api("GET", "/agents/models"); }

/** Upload a local image; returns the media_input id usable in job params. */
export async function uploadImage(file) {
  const buf = fs.readFileSync(file);
  const ctype = file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png";
  const init = await api("POST", "/agents/uploads?type=image", { json: {} });   // { id, url, upload_url }
  const put = await fetch(init.upload_url, { method: "PUT", headers: { "content-type": ctype }, body: buf });
  if (!put.ok) throw new Error(`S3 PUT failed ${put.status}: ${(await put.text()).slice(0, 200)}`);
  await api("POST", `/agents/uploads/${init.id}/confirm?type=image`, { json: {} });
  return init.id;
}

/** Build the params object for an image→video job (model-aware). */
export function videoParams({ prompt, mediaId, aspect = "16:9", duration = 4, resolution, mode, sound, model = "" }) {
  const p = { aspect_ratio: aspect, duration: Number(duration), prompt,
    medias: [{ data: { id: mediaId, type: "media_input" }, role: "start_image" }] };
  if (resolution && /seedance|wan/i.test(model)) p.resolution = resolution;
  if (mode && /cinematic_studio_video_v2/.test(model)) p.mode = mode;
  if (sound !== undefined && /kling/i.test(model)) p.sound = sound;
  return p;
}

export async function cost(jobSetType, params) { return api("POST", "/agents/jobs/cost", { json: { job_set_type: jobSetType, params } }); }

/** Create a job set; returns array of job ids. */
export async function createJob(jobSetType, params) { return api("POST", "/agents/jobs", { json: { job_set_type: jobSetType, params } }); }

/** Poll one job id until terminal; returns the job record (with result_url when completed). */
export async function pollJob(id, { timeoutMs = 20 * 60_000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  for (;;) {
    const job = await api("GET", `/agents/jobs/${id}`);
    if (job.status === "completed") return job;
    if (job.status === "failed" || job.status === "canceled") throw new Error(`job ${id} ${job.status}: ${JSON.stringify(job).slice(0, 200)}`);
    if (Date.now() - start > timeoutMs) throw new Error(`job ${id} timed out after ${Math.round((Date.now() - start) / 1000)}s (status=${job.status})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Full image→video: upload → create → poll → return { result_url, job }. */
export async function imageToVideo({ model, imagePath, prompt, aspect, duration, resolution, mode, sound, pollMs }) {
  const mediaId = await uploadImage(imagePath);
  const params = videoParams({ prompt, mediaId, aspect, duration, resolution, mode, sound, model });
  const [jobId] = await createJob(model, params);
  const job = await pollJob(jobId, pollMs ? { intervalMs: pollMs } : undefined);
  if (!job.result_url) throw new Error(`completed but no result_url: ${JSON.stringify(job).slice(0, 200)}`);
  return { result_url: job.result_url, job };
}

export async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// ── tiny CLI (only when run directly) ───────────────────────────────────────────────
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("higgsfield.mjs");
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : d; };
  const pos = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));
  (async () => {
    try {
      if (cmd === "balance") console.log(JSON.stringify(await balance(), null, 2));
      else if (cmd === "models") console.log(JSON.stringify(await models(), null, 2));
      else if (cmd === "upload") console.log(await uploadImage(pos[0]));
      else if (cmd === "cost" || cmd === "i2v") {
        const [model, image] = pos;
        const mediaId = await uploadImage(image);
        const params = videoParams({ prompt: flag("--prompt", ""), mediaId, aspect: flag("--aspect", "16:9"),
          duration: flag("--duration", "4"), resolution: flag("--resolution"), mode: flag("--mode"), model });
        if (cmd === "cost") { console.log(JSON.stringify(await cost(model, params), null, 2)); return; }
        const [jobId] = await createJob(model, params);
        console.error(`job ${jobId} — polling…`);
        const job = await pollJob(jobId);
        const out = flag("--out", `${path.basename(image, path.extname(image))}.mp4`);
        const bytes = await download(job.result_url, out);
        console.log(`✓ ${out} (${(bytes / 1e6).toFixed(1)}MB)\n${job.result_url}`);
      } else {
        console.error("usage: node higgsfield.mjs <balance|models|upload <img>|cost <model> <img> [--prompt..]|i2v <model> <img> [--prompt..] [--out..]>");
        process.exit(2);
      }
    } catch (e) { console.error("ERROR:", e.message); process.exit(1); }
  })();
}
