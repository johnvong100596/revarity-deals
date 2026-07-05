import { NextResponse } from "next/server";
import { oauthStartUrl, metaAppReady } from "@/lib/meta";
import { signState } from "@/lib/metaCrypto";
import { getMember } from "@/lib/member";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start Meta Login for Business for THIS member (D-18): each owner OAuths their own
 * channels once against John's Meta App (team = testers/developers, dev mode — no App
 * Review needed for internal use). Redirects to the FB dialog; /api/meta/callback lands
 * the pages in a picker.
 */
export async function GET(req) {
  if (!metaAppReady()) {
    return NextResponse.json({ ok: false, error: "Meta app not configured — set META_APP_ID + META_APP_SECRET in Vercel (John's Meta App; team added as testers)." }, { status: 503 });
  }
  const member = await getMember();
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/meta/callback`;
  const state = signState({ uid: member.id, name: member.name });
  return NextResponse.redirect(oauthStartUrl({ redirectUri, state }), 302);
}
