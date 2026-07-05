import { NextResponse } from "next/server";
import { removeCreatives, readTrash } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Soft remove / restore (the Review + gallery "Remove" action).
 * Body: { ids: ["ANGLE/base", ...], restore?: true }
 * Removed items go to a 30-day trash (state/removed.json) and vanish from the queue,
 * gallery, counts, winner-ranking, and the posting path. Restore brings them back.
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  const ids = Array.isArray(b.ids) ? b.ids : b.id ? [b.id] : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "no ids" }, { status: 400 });
  const { trash } = await removeCreatives(ids, { restore: !!b.restore });
  return NextResponse.json({ ok: true, restored: !!b.restore, count: ids.length, trash });
}

/** Current trash contents (also purges anything past its 30 days). */
export async function GET() {
  return NextResponse.json({ ok: true, trash: await readTrash() });
}
