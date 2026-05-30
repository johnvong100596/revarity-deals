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

/** OAuth start URL for the Connect button (TODO: real OAuth dialog). Returns null until wired. */
export function authStartUrl(/* channel */) { return null; }
