import { NextResponse } from "next/server";
import { planFromAngle } from "@/lib/director";
import { primeAngles } from "@/lib/connectors";
import { readQueue } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Auto-generate up to 10 NEW content concepts for an angle, cohesive with the brand's recent designs.
 * Reads the most recent creatives from the queue as the "recent design" context. Planning only —
 * returns a plan of concept shots the operator then generates into Review (D-04).
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  await primeAngles();
  try {
    let recent = [];
    try {
      const q = await readQueue();
      recent = (q || []).slice(-10).reverse().map((c) => ({ headline: c.headline, body: c.body, angle_id: c.angle_id, spec: c.spec }));
    } catch { /* recent context is best-effort */ }
    const plan = await planFromAngle({
      angleId: b.angleId || "",
      recent,
      n: b.n,
      outputPref: b.output || "auto",
      formatPref: b.format || "auto",
    });
    if (!plan) return NextResponse.json({ ok: false, error: "Couldn't generate concepts — confirm ANTHROPIC_API_KEY is set." }, { status: 502 });
    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
