import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Serverless Higgsfield client (image→video) — port of creative-engine/higgsfield.mjs.
 * Reads tokens from env first (HIGGSFIELD_ACCESS_TOKEN / HIGGSFIELD_REFRESH_TOKEN) so it works on
 * Vercel where there is no ~/.config file; falls back to credentials.json in local/VM dev.
 * Video renders for minutes — callers create a job, then POLL via getJob() across separate requests
 * (we never hold a function open). See CONTRACT.md for the full API.
 */
const API = process.env.HIGGSFIELD_API_URL || "https://fnf.higgsfield.ai";
const DEVICE_AUTH = process.env.HIGGSFIELD_DEVICE_AUTH_URL || "https://fnf-device-auth.higgsfield.ai";
const CLIENT = process.env.HIGGSFIELD_CLIENT_NAME || "claude_code";
const CRED_PATH = process.env.HIGGSFIELD_CREDENTIALS_PATH || path.join(os.homedir(), ".config", "higgsfield", "credentials.json");

function loadCreds() {
  if (process.env.HIGGSFIELD_ACCESS_TOKEN) {
    return { access_token: process.env.HIGGSFIELD_ACCESS_TOKEN, refresh_token: process.env.HIGGSFIELD_REFRESH_TOKEN || "" };
  }
  try { return JSON.parse(fs.readFileSync(CRED_PATH, "utf8")); }
  catch { throw new Error("No Higgsfield credentials — set HIGGSFIELD_ACCESS_TOKEN (+ _REFRESH_TOKEN) or run `hf auth login` locally."); }
}
let creds = null;
function getCreds() { return (creds ||= loadCreds()); }

async function refresh() {
  const c = getCreds();
  if (!c.refresh_token) throw new Error("Higgsfield token expired and no refresh_token available.");
  const r = await fetch(`${DEVICE_AUTH}/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hf-mcp-client-name": CLIENT },
    body: JSON.stringify({ refresh_token: c.refresh_token }),
  });
  if (!r.ok) throw new Error(`Higgsfield refresh failed ${r.status}`);
  const t = await r.json();
  creds = { ...c, ...t };
  // best-effort persist in dev (serverless fs is ephemeral/read-only — ignore failures)
  try { if (!process.env.HIGGSFIELD_ACCESS_TOKEN && process.env.STORE_DRIVER !== "cloud") fs.writeFileSync(CRED_PATH, JSON.stringify({ access_token: creds.access_token, refresh_token: creds.refresh_token }, null, 2)); } catch {}
  return creds.access_token;
}

async function api(method, pathname, { json, retry = true } = {}) {
  const headers = { authorization: `Bearer ${getCreds().access_token}`, "x-hf-mcp-client-name": CLIENT };
  let body;
  if (json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(json); }
  const res = await fetch(`${API}${pathname}`, { method, headers, body });
  if (res.status === 401 && retry) { await refresh(); return api(method, pathname, { json, retry: false }); }
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function balance() { return api("GET", "/agents/balance"); }

/** Upload an image buffer; returns the media_input id. */
export async function uploadImage(buf, contentType = "image/png") {
  const init = await api("POST", "/agents/uploads?type=image", { json: {} }); // { id, url, upload_url }
  const put = await fetch(init.upload_url, { method: "PUT", headers: { "content-type": contentType }, body: buf });
  if (!put.ok) throw new Error(`Higgsfield S3 PUT ${put.status}`);
  await api("POST", `/agents/uploads/${init.id}/confirm?type=image`, { json: {} });
  return init.id;
}

/** Kick off an image→video job; returns the Higgsfield job id (poll separately). */
export async function startVideo({ model = "seedance1_5", mediaId, prompt, aspect = "16:9", duration = 4, resolution = "1080p" }) {
  const params = {
    aspect_ratio: aspect, duration: Number(duration), prompt,
    medias: [{ data: { id: mediaId, type: "media_input" }, role: "start_image" }],
  };
  if (/seedance|wan/i.test(model) && resolution) params.resolution = resolution;
  const [jobId] = await api("POST", "/agents/jobs", { json: { job_set_type: model, params } });
  return jobId;
}

/** One poll. Returns { status, result_url|null }. */
export async function pollVideo(jobId) {
  const j = await api("GET", `/agents/jobs/${jobId}`);
  return { status: j.status, result_url: j.result_url || null, raw: j };
}
