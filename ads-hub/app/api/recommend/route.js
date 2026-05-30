import { NextResponse } from "next/server";
import { readQueue, readApprovals } from "@/lib/store";
import { readSocial } from "@/lib/social";
import { recommend } from "@/lib/recommend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** AI ads-expert plan: when to post + which approved creatives to prioritize across connected channels. */
export async function GET() {
  const [queue, approvals, social] = await Promise.all([readQueue(), readApprovals(), readSocial()]);
  const dec = approvals.decisions || {};
  const approved = queue.filter((c) => dec[c.id] === "approve");
  const connectedChannels = Object.entries(social.connections || {}).filter(([, v]) => v?.connected).map(([k]) => k);
  try {
    const recommendations = await recommend({ approved, connectedChannels });
    return NextResponse.json({ ok: true, recommendations, approvedCount: approved.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
