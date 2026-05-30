import { NextResponse } from "next/server";
import { readQueue, readApprovals } from "@/lib/store";
import { loadConfig } from "@/lib/config";
import { computeSummary } from "@/lib/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Weekly snapshot from internal data (queue + approvals + budget). For the page and a future weekly auto-send. */
export async function GET() {
  const [queue, approvals, config] = await Promise.all([readQueue(), readApprovals(), loadConfig()]);
  return NextResponse.json({ ok: true, summary: computeSummary(queue, approvals, config) });
}
