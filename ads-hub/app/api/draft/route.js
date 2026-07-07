import { NextResponse } from "next/server";
import { updateCreative } from "@/lib/store";
import { claimViolations } from "@/lib/claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * In-place script edit for a Review draft (behind the hub session gate, like /api/approve).
 *
 *   POST { id, patch: { headline?, body?, cta?, caption? } }
 *
 * The claims lock re-runs on the EDITED text here, server-side: a violating edit returns 422 and
 * never persists — the same regime the generator is held to (lib/claims). On success the draft's
 * text is updated (isolated per-item write); a VIDEO draft is flagged render_stale so Review blocks
 * its approval until a re-render matches the pixels (ffmpeg runs on GitHub Actions, not here — a
 * static draft's copy is the card text, so it updates live). Nothing posts or spends (D-04).
 */
const EDITABLE = ["headline", "body", "cta", "caption"];

export async function POST(req) {
  let id, patch = {};
  try { ({ id, patch = {} } = await req.json()); } catch {}
  if (!id || typeof id !== "string") return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const clean = {};
  for (const k of EDITABLE) if (typeof patch?.[k] === "string") clean[k] = patch[k];
  if (!Object.keys(clean).length) return NextResponse.json({ ok: false, error: "no editable text fields" }, { status: 400 });

  // THE GATE: re-run the claims lock on the edited text. A violation blocks the save.
  const violations = claimViolations(Object.values(clean).join("\n"));
  if (violations.length) {
    return NextResponse.json(
      { ok: false, error: "claims_lock", kinds: [...new Set(violations.map((v) => v.kind))], violations },
      { status: 422 }
    );
  }

  const res = await updateCreative(id, clean);
  if (!res.ok) return NextResponse.json(res, { status: res.error === "not_found" ? 404 : 500 });
  return NextResponse.json({ ok: true, card: res.card });
}
