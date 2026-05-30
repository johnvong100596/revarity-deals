import { NextResponse } from "next/server";
import { readSocial } from "@/lib/social";
import { readPerformance, rankWinners } from "@/lib/performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Winners + double-down status. Empty until a channel is connected and posts start gathering views. */
export async function GET() {
  const [social, perf] = await Promise.all([readSocial(), readPerformance()]);
  const connected = Object.entries(social.connections || {}).filter(([, v]) => v?.connected).map(([k]) => k);
  const posts = perf.posts || [];
  const winners = rankWinners(posts);
  return NextResponse.json({
    ok: true,
    connected,
    hasData: posts.length > 0,
    winners,
    note: connected.length
      ? "Tracking is on. As posts gather views, your top performers show here and the studio drafts more like them."
      : "Connect a channel (Schedule → Connect) to start tracking views and auto-make more of the winners.",
  });
}
