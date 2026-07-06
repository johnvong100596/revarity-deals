import { NextResponse } from "next/server";
import { planFromScript } from "@/lib/director";
import { primeAngles } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The Director: turn a freeform idea or full script into a routed, shot-by-shot plan. Planning only —
 * it never generates, publishes, or spends (D-04). The client then posts each shot to /api/generate.
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  await primeAngles(); // honor operator angle overrides when the Director routes a shot
  try {
    const plan = await planFromScript({
      idea: b.idea || b.script || "",
      inspiration: b.inspiration || "",
      wantVoice: !!b.wantVoice,
      wantMusic: !!b.wantMusic,
      outputPref: b.output || "auto",
      formatPref: b.format || "auto",
      angleId: b.angleId || "",
      targetSeconds: b.targetSeconds || null,
      claimsVerified: (b.claimsVerified || "").slice(0, 800),
      claimsNot: (b.claimsNot || "").slice(0, 800),
      brand: b.brand || "revarity",
    });
    if (!plan) return NextResponse.json({ ok: false, error: "Could not plan this idea — confirm ANTHROPIC_API_KEY is set and give a bit more detail." }, { status: 502 });
    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
