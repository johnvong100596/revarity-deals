import { NextResponse } from "next/server";
import { readApprovals, writeApprovals } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readApprovals());
}

// Body: { decisions: { "ANGLE/base": "approve"|"hold"|"reject" } }  (filtered in store)
export async function POST(req) {
  let decisions = {};
  try { ({ decisions = {} } = await req.json()); } catch {}
  return NextResponse.json(await writeApprovals(decisions));
}
