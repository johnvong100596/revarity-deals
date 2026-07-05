import { NextResponse } from "next/server";
import { readComputeLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The running compute meter (engine-audit P0-1c): totals from the spend ledger. */
export async function GET() {
  const log = await readComputeLog();
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
  const dayKey = now.toISOString().slice(0, 10);
  let month = 0, today = 0;
  const byKind = {};
  for (const e of log) {
    const d = new Date(e.at);
    const credits = Number(e.credits) || 0;
    if (`${d.getUTCFullYear()}-${d.getUTCMonth()}` === monthKey) {
      month += credits;
      byKind[e.kind] = (byKind[e.kind] || 0) + credits;
    }
    if (e.at?.slice(0, 10) === dayKey) today += credits;
  }
  return NextResponse.json({
    ok: true,
    today: Math.round(today * 10) / 10,
    month: Math.round(month * 10) / 10,
    byKind,
    entries: log.length,
    note: "Estimates, not an invoice — tune lib/computeCost.js / COMPUTE_COST_JSON.",
  });
}
