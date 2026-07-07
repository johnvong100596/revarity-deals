/**
 * lib/drive.js — Google Drive, SERVICE-ACCOUNT, READ-ONLY.
 *
 * Pulls the real listing photos the money-arc render needs from a shared Drive
 * folder. Read-only by scope (drive.readonly) — this module can list + download,
 * never write or delete. Dependency-free: mints a Google OAuth access token by
 * RS256-signing a JWT with the service-account key (node:crypto), then hits the
 * Drive v3 REST API with fetch. No `googleapis` dep, no browser exposure.
 *
 * Env (set on our side / in Vercel — NEVER commit the key):
 *   GDRIVE_SA_JSON      — the full service-account JSON (as a string), OR
 *   GDRIVE_SA_JSON_B64  — the same JSON, base64-encoded (handy for env UIs)
 *   GDRIVE_PHOTOS_FOLDER_ID — default folder to pull real photos from
 *
 * Stub-safe: when the key is absent, driveConfigured() is false and the callers
 * degrade honestly (same pattern as blobConfigured / hasCloudKey) instead of
 * throwing deep in a render.
 */
import crypto from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";

function loadServiceAccount() {
  // Try BOTH sources and use the first that actually parses into a usable key.
  // A non-empty-but-malformed GDRIVE_SA_JSON must NOT shadow a valid _B64 (raw
  // multi-line JSON pasted into a secret is easy to corrupt via the private_key
  // newlines; base64 is the safe path). Precedence is "first that works", not
  // "first that's set" — so either secret being valid is sufficient.
  const candidates = [];
  if (process.env.GDRIVE_SA_JSON) candidates.push(process.env.GDRIVE_SA_JSON);
  if (process.env.GDRIVE_SA_JSON_B64) {
    try { candidates.push(Buffer.from(process.env.GDRIVE_SA_JSON_B64, "base64").toString("utf8")); } catch { /* bad base64 → skip */ }
  }
  for (const raw of candidates) {
    try {
      const sa = JSON.parse(raw);
      if (sa.client_email && sa.private_key) return sa;
    } catch { /* try the next candidate */ }
  }
  return null;
}

export function driveConfigured() {
  return !!loadServiceAccount();
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Short-lived token cache (tokens last ~1h; reuse within a batch).
let _tok = { value: "", exp: 0 };

async function accessToken() {
  const sa = loadServiceAccount();
  if (!sa) throw new Error("drive_not_configured");
  const now = Math.floor(Date.now() / 1000);
  if (_tok.value && _tok.exp - 60 > now) return _tok.value;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(sa.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Drive token ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const j = await res.json();
  if (!j.access_token) throw new Error("Drive token response had no access_token");
  _tok = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return _tok.value;
}

/**
 * List image files in a Drive folder (non-recursive), newest first.
 * Returns [{ id, name, mimeType, modifiedTime, size }]. Fail-open [] on trouble
 * so a render never crashes on a Drive hiccup — the caller reports "no photos".
 */
export async function listFolderImages(folderId = process.env.GDRIVE_PHOTOS_FOLDER_ID, { max = 40 } = {}) {
  if (!driveConfigured() || !folderId) return [];
  try {
    const token = await accessToken();
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: "files(id,name,mimeType,modifiedTime,size,thumbnailLink)",
      orderBy: "modifiedTime desc",
      pageSize: String(Math.min(100, max)),
      // Shared Drives support (harmless for My Drive folders too).
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const res = await fetch(`${DRIVE}/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn(`[drive] list ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return [];
    }
    const j = await res.json();
    return (j.files || []).slice(0, max);
  } catch (e) {
    console.warn("[drive] list failed:", e?.message || e);
    return [];
  }
}

/** Download one file's bytes → Buffer. Throws (caller decides) — a missing photo
 *  mid-render is a real failure, not something to swallow silently. */
export async function downloadFile(fileId) {
  const token = await accessToken();
  const res = await fetch(`${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Convenience: list + download the first N images from a folder → [{ name, buffer }]. */
export async function fetchFolderPhotos(folderId = process.env.GDRIVE_PHOTOS_FOLDER_ID, { count = 8 } = {}) {
  const files = await listFolderImages(folderId, { max: count });
  const out = [];
  for (const f of files.slice(0, count)) {
    try {
      out.push({ name: f.name, mimeType: f.mimeType, buffer: await downloadFile(f.id) });
    } catch (e) {
      console.warn(`[drive] skip ${f.name}:`, e?.message || e);
    }
  }
  return out;
}
