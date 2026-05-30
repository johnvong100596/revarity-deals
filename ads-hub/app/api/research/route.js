import { NextResponse } from "next/server";
import { extractPattern } from "@/lib/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Research a pasted competitor/reference ad → generalized winning pattern + ICP-match + a brief the
 * generator can run to make an ORIGINAL lookalike (learn the framework, never copy the words).
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const pattern = await extractPattern({ text: (b.text || "").slice(0, 8000), url: (b.url || "").slice(0, 500) });
    return NextResponse.json({ ok: true, pattern });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
