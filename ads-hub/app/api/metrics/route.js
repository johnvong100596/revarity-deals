import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Monitor data (Phase 2). Live CPL/CPC/CPA/CTR come from the Meta Ads MCP (read-only)
 * and GHL once spend is live (PLAN Stream E/F). Until then we return targets + a
 * pending status so the UI can render honestly. The loop will PROPOSE pauses/scales;
 * a human disposes (D-04).
 */
export async function GET() {
  const { kpi } = await loadConfig();
  return NextResponse.json({
    status: "pending_live_data",
    note: "Activates after spend goes live + Meta Ads MCP (read-only) is wired.",
    targets: kpi,
    creatives: [], // [{ id, cpl, cpc, cpa, ctr, impressions, verdict }]
  });
}
