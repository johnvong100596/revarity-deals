import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // hint; long runs need a background job in prod

export async function POST(req) {
  let clean = true;
  try { ({ clean = true } = await req.json()); } catch {}
  try {
    const result = await runPipeline({ clean });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
