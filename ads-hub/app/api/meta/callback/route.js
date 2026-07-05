import { NextResponse } from "next/server";
import { exchangeCodeForLongToken, listPagesWithIG } from "@/lib/meta";
import { verifyState, stateKey, encryptToken } from "@/lib/metaCrypto";
import { savePending } from "@/lib/metaPending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Meta OAuth callback (D-18): verify the signed state, swap the code for a LONG-LIVED
 * user token, list the member's pages (+ linked IG business accounts), park it all —
 * token encrypted — in the pending pen, and bounce to the Schedule page picker. Nothing
 * joins the pool until the owner confirms their selection there.
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
    const pages = await listPagesWithIG(token);
    if (!pages.length) return back("?connect_error=no+pages+on+this+Meta+account+—+are+you+an+admin+of+the+page%3F");
    const hash = stateKey(state);
    await savePending(hash, {
      member: { id: member.uid, name: member.name },
      encUserToken: encryptToken(token),
      // page tokens are re-derived at finalize; only names/ids ride the pen
      pages: pages.map((p) => ({ pageId: p.pageId, name: p.name, ig: p.ig ? { id: p.ig.id, username: p.ig.username } : null })),
    });
    return back(`?pick=${hash}`);
  } catch (e) {
    return back(`?connect_error=${encodeURIComponent(String(e?.message || e).slice(0, 140))}`);
  }
}
