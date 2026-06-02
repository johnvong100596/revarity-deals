import { NextResponse } from "next/server";
import { planVariations } from "@/lib/director";
import { primeAngles } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Make up to 10 VARIATIONS of one base concept (similar script + background, varied hook) for A/B testing.
 * Planning only — returns a plan of sibling shots the operator then generates into Review (D-04).
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  await primeAngles(); // honor operator angle/format overrides
  try {
    const plan = await planVariations({
      idea: b.idea || b.brief || "",
      inspiration: b.inspiration || "",
      n: b.n,
      outputPref: b.output || "auto",
      formatPref: b.format || "auto",
      angleId: b.angleId || "",
      targetSeconds: b.targetSeconds || null,
    });
    if (!plan) return NextResponse.json({ ok: false, error: "Couldn't make variations — confirm ANTHROPIC_API_KEY is set and give a base concept to vary." }, { status: 502 });
    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
