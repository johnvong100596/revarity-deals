import { NextResponse } from "next/server";
import { readApprovals, writeApprovals, appendRejectLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readApprovals());
}

// Body: { decisions: { "ANGLE/base": "approve"|"hold"|"reject" },
//         reasons:   { "ANGLE/base": "why it was rejected" } }   (reasons optional)
// Rejected ids with a reason land in the append-only reject-reason log (Phase-1b).
export async function POST(req) {
  let decisions = {}, reasons = {};
  try { ({ decisions = {}, reasons = {} } = await req.json()); } catch {}
  const saved = await writeApprovals(decisions);
  const rejectEntries = Object.entries(reasons)
    .filter(([id]) => decisions[id] === "reject")
    .map(([id, reason]) => ({ id, reason }));
  const rejectLog = await appendRejectLog(rejectEntries);
  return NextResponse.json({ ...saved, rejectLog });
}
