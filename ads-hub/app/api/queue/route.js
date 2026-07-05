import { NextResponse } from "next/server";
import { readQueue, readApprovals, readTrash } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [queue, approvals, trash] = await Promise.all([readQueue(), readApprovals(), readTrash()]);
  // Decisions scoped to the LIVE queue so removed items never skew the Review tallies.
  const live = new Set(queue.map((c) => c.id));
  const decisions = Object.fromEntries(Object.entries(approvals.decisions || {}).filter(([id]) => live.has(id)));
  return NextResponse.json({ count: queue.length, decisions, queue, trash });
}
