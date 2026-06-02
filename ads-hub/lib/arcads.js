/**
 * Arcads.ai connector — the DEDICATED, CLEARLY-LABELED "UGC talking-head" lane (separate from the
 * premium Veo presenter commercials). BUILT BUT GATED: it stays inert until ARCADS_CLIENT_ID +
 * ARCADS_CLIENT_SECRET are set, exactly like lib/meta.js. Do NOT enable until the commercial diligence
 * is done — get IN WRITING from Arcads sales: Pro tier $/video + rate limits, the actor consent/release
 * chain, and explicit permission for financial-adjacent advertising. (See docs/ARCADS-LANE.md.)
 *
 * GUARDRAILS (revised D-03 + FTC): Arcads here produces a labeled, non-testimonial PRESENTER reading a
 * brand script. It must NEVER imply a real Revarity client or state guaranteed/specific returns, and the
 * shipped ad must carry an AI-generated label (Meta/TikTok/EU/NY). Social proof = real clients only.
 *
 * API shape (per Arcads help docs + the krusemediallc/arcads-claude-code reference, confirmed 2026):
 *   base https://external-api.arcads.ai · HTTP Basic auth base64(clientId:clientSecret) · polling only.
 *   POST /v1/scripts {text,...} -> POST /v1/scripts/:id/generate -> poll GET /v1/scripts/:id/videos.
 * Field names are sales-gated; VERIFY against your contract's API docs at integration time.
 */
const BASE = process.env.ARCADS_URL || "https://external-api.arcads.ai";
const CLIENT_ID = () => process.env.ARCADS_CLIENT_ID || "";
const CLIENT_SECRET = () => process.env.ARCADS_CLIENT_SECRET || "";

export function hasArcads() { return !!(CLIENT_ID() && CLIENT_SECRET()); }

function authHeader() {
  const raw = `${CLIENT_ID()}:${CLIENT_SECRET()}`;
  const b64 = typeof btoa === "function" ? btoa(raw) : Buffer.from(raw).toString("base64");
  return `Basic ${b64}`;
}
async function aFetch(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Arcads ${path} ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

/** Start a UGC talking-head generation from a brand script. Returns a job ref (scriptId) to poll. */
export async function startUgc({ script, actorId } = {}) {
  if (!hasArcads()) throw new Error("Arcads UGC lane not configured — set ARCADS_CLIENT_ID/SECRET (and sign the Pro plan) to enable.");
  if (!script || !script.trim()) throw new Error("Arcads UGC needs a script.");
  // VERIFY field names against your Arcads API contract; this mirrors the documented v1 flow.
  const s = await aFetch("POST", "/v1/scripts", { text: script.slice(0, 2000), ...(actorId ? { actorId } : {}) });
  const scriptId = s.id || s.scriptId;
  if (!scriptId) throw new Error("Arcads returned no script id");
  await aFetch("POST", `/v1/scripts/${scriptId}/generate`, {});
  return scriptId;
}

/** One poll. Returns { status: rendering|completed|failed, result_url?, error? }. */
export async function pollUgc(scriptId) {
  if (!hasArcads()) return { status: "failed", error: "Arcads not configured" };
  const j = await aFetch("GET", `/v1/scripts/${scriptId}/videos`, null);
  const items = j.videos || j.data || (Array.isArray(j) ? j : []);
  const v = items[0] || j;
  const status = (v.status || "").toLowerCase();
  const url = v.url || v.videoUrl || v.downloadUrl || null;
  if (url) return { status: "completed", result_url: url };
  if (status.includes("fail") || status.includes("error")) return { status: "failed", error: v.error || "arcads failed" };
  return { status: "rendering" };
}
