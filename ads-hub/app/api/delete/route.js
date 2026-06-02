import { NextResponse } from "next/server";
import { deleteCreative } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently delete a creative from the queue. Only the Review "Rejected" section calls this, as an
 * explicit second step after rejecting (reject hides; delete destroys). D-04 unaffected (no publish/spend).
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  if (!b.id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  try {
    await deleteCreative(b.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
