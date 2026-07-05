/**
 * Meta connector — the ONE place real Instagram/Facebook/Meta-Ads API calls live.
 * Everything else (scheduling, the cron runpath, tracking, double-down, autopilot) is fully built and
 * runs without this; these calls just stay gated until a token + account ids are set in env. The
 * moment they exist, the runpath goes live. Organic IG/FB publish + insights are implemented to the
 * documented Graph API; validate on the first real connect. Paid Meta Ads publishing is a stub TODO.
 *
 * Env to go live (set in Vercel):
 *   META_ACCESS_TOKEN     long-lived token (instagram_basic, instagram_content_publish, pages_manage_posts, read_insights)
 *   META_IG_USER_ID       IG Business account id      (instagram)
 *   META_PAGE_ID          Facebook Page id            (facebook)
 *   META_AD_ACCOUNT_ID    act_<id>                    (meta_ads — paid, stub)
 *   META_GRAPH_VERSION    optional, default v21.0
 */
const V = process.env.META_GRAPH_VERSION || "v21.0";
const G = `https://graph.facebook.com/${V}`;
const TOKEN = () => process.env.META_ACCESS_TOKEN || "";

/** Is a channel actually wired (real token + the id it needs)? Distinct from the user "connecting" in the UI. */
export function metaReady(channel) {
  if (!TOKEN()) return false;
  if (channel === "instagram") return !!process.env.META_IG_USER_ID;
  if (channel === "facebook") return !!process.env.META_PAGE_ID;
  if (channel === "meta_ads") return !!process.env.META_AD_ACCOUNT_ID;
  return false;
}

async function g(method, path, params) {
  const url = new URL(`${G}/${path}`);
  url.searchParams.set("access_token", TOKEN());
  const init = { method };
  if (method === "POST") { init.body = new URLSearchParams(params || {}); }
  else { for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v); }
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph ${path} ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`);
  return j;
}

/** Publish one creative to a channel. imageUrl must be PUBLIC. Returns a postRef for later insights. */
export async function publish({ channel, caption = "", imageUrl }) {
  if (!metaReady(channel)) throw new Error(`Meta ${channel} not wired — set the token + id in env (see lib/meta.js).`);
  if (channel === "instagram") {
    if (!imageUrl) throw new Error("instagram publish needs a public imageUrl");
    const c = await g("POST", `${process.env.META_IG_USER_ID}/media`, { image_url: imageUrl, caption });
    const pub = await g("POST", `${process.env.META_IG_USER_ID}/media_publish`, { creation_id: c.id });
    return pub.id; // IG media id
  }
  if (channel === "facebook") {
    const p = await g("POST", `${process.env.META_PAGE_ID}/photos`, imageUrl ? { url: imageUrl, caption } : { message: caption });
    return p.post_id || p.id;
  }
  if (channel === "meta_ads") throw new Error("Paid Meta Ads publishing is a stub — wire campaign/adset/ad creation in lib/meta.js.");
  throw new Error(`unknown channel ${channel}`);
}

/** Pull view-ish metrics for a posted item. Returns { views, likes, saves }. */
export async function fetchInsights({ channel, postRef }) {
  if (!metaReady(channel) || !postRef) return null;
  if (channel === "instagram") {
    const ins = await g("GET", `${postRef}/insights`, { metric: "reach,impressions,saved,likes" }).catch(() => null);
    const m = Object.fromEntries((ins?.data || []).map((d) => [d.name, d.values?.[0]?.value || 0]));
    return { views: m.reach || m.impressions || 0, likes: m.likes || 0, saves: m.saved || 0 };
  }
  if (channel === "facebook") {
    const j = await g("GET", `${postRef}`, { fields: "insights.metric(post_impressions),likes.summary(true)" }).catch(() => null);
    const views = j?.insights?.data?.[0]?.values?.[0]?.value || 0;
    return { views, likes: j?.likes?.summary?.total_count || 0, saves: 0 };
  }
  return null;
}

/* ───────────────────── workspace channel pool (D-18) ─────────────────────
 * Per-owner OAuth (Meta Login for Business) against JOHN'S Meta App — team members are added
 * as testers/developers on the app, so dev mode covers internal use with no App Review.
 * Env: META_APP_ID + META_APP_SECRET (+ optional META_TOKEN_KEY for token encryption).
 * Tokens are handled by the caller (encrypted at rest via lib/metaCrypto) — this module is
 * pure Graph API and never touches the store. */
const APP_ID = () => process.env.META_APP_ID || "";
const APP_SECRET = () => process.env.META_APP_SECRET || "";
export function metaAppReady() { return !!(APP_ID() && APP_SECRET()); }

export const OAUTH_SCOPES = [
  "pages_show_list", "pages_manage_posts", "pages_read_engagement",
  "instagram_basic", "instagram_content_publish", "read_insights", "business_management",
].join(",");

/** The Meta Login dialog URL (each owner connects their own channels once). */
export function oauthStartUrl({ redirectUri, state }) {
  if (!metaAppReady()) return null;
  const u = new URL(`https://www.facebook.com/${V}/dialog/oauth`);
  u.searchParams.set("client_id", APP_ID());
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", OAUTH_SCOPES);
  u.searchParams.set("response_type", "code");
  return u.toString();
}

async function gTok(path, params) {
  const url = new URL(`${G}/${path}`);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph ${path} ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`);
  return j;
}

/** code → short-lived user token → LONG-LIVED user token (~60 days; page tokens derived from it don't expire). */
export async function exchangeCodeForLongToken({ code, redirectUri }) {
  const short = await gTok("oauth/access_token", { client_id: APP_ID(), client_secret: APP_SECRET(), redirect_uri: redirectUri, code });
  const long = await gTok("oauth/access_token", { grant_type: "fb_exchange_token", client_id: APP_ID(), client_secret: APP_SECRET(), fb_exchange_token: short.access_token });
  return { token: long.access_token, expiresIn: long.expires_in || null };
}

/** The pages (and linked IG business accounts) this user can post to. Returns [{pageId,name,pageToken,ig:{id,username}|null}]. */
export async function listPagesWithIG(userToken) {
  const j = await gTok("me/accounts", { access_token: userToken, fields: "id,name,access_token,instagram_business_account{id,username}", limit: "50" });
  return (j.data || []).map((p) => ({
    pageId: p.id, name: p.name, pageToken: p.access_token,
    ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || "" } : null,
  }));
}

/** Re-derive a fresh page token from a stored long-lived user token (self-heal on OAuth errors). */
export async function refreshPageToken({ userToken, pageId }) {
  const j = await gTok(`${pageId}`, { access_token: userToken, fields: "access_token" });
  return j.access_token || null;
}

async function gWith(token, method, path, params) {
  const url = new URL(`${G}/${path}`);
  url.searchParams.set("access_token", token);
  const init = { method };
  if (method === "POST") init.body = new URLSearchParams(params || {});
  else for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph ${path} ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`);
  return j;
}

/** Publish one creative to a POOL channel (token supplied by the caller, already decrypted). */
export async function publishTo({ kind, pageId, igUserId, token, caption = "", imageUrl }) {
  if (!token) throw new Error("channel token missing — the owner may need to reconnect");
  if (kind === "instagram") {
    if (!igUserId) throw new Error("channel has no linked Instagram business account");
    if (!imageUrl) throw new Error("instagram publish needs a public imageUrl");
    const c = await gWith(token, "POST", `${igUserId}/media`, { image_url: imageUrl, caption });
    const pub = await gWith(token, "POST", `${igUserId}/media_publish`, { creation_id: c.id });
    return pub.id;
  }
  if (kind === "facebook") {
    const p = await gWith(token, "POST", `${pageId}/photos`, imageUrl ? { url: imageUrl, caption } : { message: caption });
    return p.post_id || p.id;
  }
  throw new Error(`unknown channel kind ${kind}`);
}

/** Insights for a POOL channel post. */
export async function fetchInsightsFor({ kind, postRef, token }) {
  if (!token || !postRef) return null;
  if (kind === "instagram") {
    const ins = await gWith(token, "GET", `${postRef}/insights`, { metric: "reach,impressions,saved,likes" }).catch(() => null);
    const m = Object.fromEntries((ins?.data || []).map((d) => [d.name, d.values?.[0]?.value || 0]));
    return { views: m.reach || m.impressions || 0, likes: m.likes || 0, saves: m.saved || 0 };
  }
  if (kind === "facebook") {
    const j = await gWith(token, "GET", `${postRef}`, { fields: "insights.metric(post_impressions),likes.summary(true)" }).catch(() => null);
    const views = j?.insights?.data?.[0]?.values?.[0]?.value || 0;
    return { views, likes: j?.likes?.summary?.total_count || 0, saves: 0 };
  }
  return null;
}

/** OAuth start URL for the legacy env-channel Connect button (kept for compat). */
export function authStartUrl(/* channel */) { return null; }
