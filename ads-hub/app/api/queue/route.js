import { NextResponse } from "next/server";
import { readQueue, readApprovals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [queue, approvals] = await Promise.all([readQueue(), readApprovals()]);
  return NextResponse.json({ count: queue.length, decisions: approvals.decisions, queue });
}
