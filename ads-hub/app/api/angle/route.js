import { NextResponse } from "next/server";
import { genAngle } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Generate ONE new ad angle (the marketing brain proposes; the operator edits + saves on Settings).
 * Planning/ideation only — it never generates creatives, publishes, or spends (D-04).
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const angle = await genAngle({
      brief: (b.brief || "").slice(0, 500),
      existing: Array.isArray(b.existing) ? b.existing.slice(0, 40) : [],
    });
    return NextResponse.json({ ok: true, angle });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
