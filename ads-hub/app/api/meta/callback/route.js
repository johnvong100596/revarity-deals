import { NextResponse } from "next/server";
import { exchangeCodeForLongToken, enumerateTargets } from "@/lib/meta";
import { verifyState, stateKey, encryptToken } from "@/lib/metaCrypto";
import { savePending } from "@/lib/metaPending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Meta OAuth callback (D-18/D-19): verify signed state → swap code for a LONG-LIVED user token →
 * ENUMERATE every page the token can reach (classic profile pages AND Business-portfolio-owned/
 * client pages, merged) → park it (token encrypted) in the pending pen → bounce to the picker.
 * Nothing joins the pool until the owner confirms. Self-service, own-assets-only: a member only
 * ever sees what THEIR token enumerates; no admin on company anything required.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const back = (q) => NextResponse.redirect(`${url.origin}/schedule${q}`, 302);
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return back(`?connect_error=${encodeURIComponent(String(err).slice(0, 140))}`);

  const state = url.searchParams.get("state") || "";
  const member = verifyState(state);
  if (!member) return back("?connect_error=login+link+expired+—+try+Connect+again");

  const code = url.searchParams.get("code") || "";
  if (!code) return back("?connect_error=no+code+returned");

  try {
    const redirectUri = `${url.origin}/api/meta/callback`;
    const { token } = await exchangeCodeForLongToken({ code, redirectUri });
    const { pages, debug } = await enumerateTargets(token);
    // Full raw enumeration → Vercel runtime logs (Cena's ask: see what the token can actually reach).
    console.log(`[meta/callback] member=${member.name} enumerated ${pages.length} page(s):`, JSON.stringify(debug));

    if (!pages.length) {
      // Compact per-path diagnostic in the redirect so Cena can paste exactly what was found without
      // digging in Vercel logs: e.g. "me/accounts=0; me/businesses=2; Acme/owned_pages=0(err:…)".
      const summary = debug.steps
        .map((s) => `${s.path}=${s.count}${s.ok ? "" : "(err:" + (s.error || "?").slice(0, 40) + ")"}`)
        .join("; ");
      return back(`?connect_error=${encodeURIComponent(`No pages the login could enumerate. ${summary}`.slice(0, 300))}`);
    }

    const hash = stateKey(state);
    await savePending(hash, {
      member: { id: member.uid, name: member.name },
      encUserToken: encryptToken(token),
      // page tokens are re-derived at finalize; only names/ids/ig ride the pen
      pages: pages.map((p) => ({ pageId: p.pageId, name: p.name, ig: p.ig ? { id: p.ig.id, username: p.ig.username } : null, via: p.via })),
    });
    return back(`?pick=${hash}`);
  } catch (e) {
    return back(`?connect_error=${encodeURIComponent(String(e?.message || e).slice(0, 200))}`);
  }
}
