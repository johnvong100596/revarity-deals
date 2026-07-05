import crypto from "node:crypto";

/**
 * Token encryption for the workspace channel pool (D-18). Channel tokens live in the
 * shared store, so they are NEVER stored plaintext: AES-256-GCM, key from META_TOKEN_KEY
 * (32-byte hex or any string, hashed) — falls back to a key derived from META_APP_SECRET
 * so no extra env is strictly required. Rotating the key invalidates stored tokens
 * (owners just reconnect).
 */
function key() {
  const raw = process.env.META_TOKEN_KEY || process.env.META_APP_SECRET || "";
  if (!raw) throw new Error("token crypto needs META_TOKEN_KEY or META_APP_SECRET in env");
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decryptToken(blob) {
  const b = Buffer.from(String(blob), "base64");
  const iv = b.subarray(0, 12), tag = b.subarray(12, 28), ct = b.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/** Signed OAuth state (HMAC over member payload + timestamp) — survives the FB round-trip. */
export function signState(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyState(state, maxAgeMs = 15 * 60 * 1000) {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  const want = crypto.createHmac("sha256", key()).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.ts || Date.now() - p.ts > maxAgeMs) return null;
    return p;
  } catch { return null; }
}
export const stateKey = (state) => crypto.createHash("sha256").update(String(state)).digest("hex").slice(0, 24);
