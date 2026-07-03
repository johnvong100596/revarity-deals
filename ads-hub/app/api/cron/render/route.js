import { NextResponse } from "next/server";
import { runRenderBatch } from "@/lib/renderBatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Nightly money-arc render batch — Vercel Cron hits this (see vercel.json).
 * Drafts 1–2 real-photo money-arc ads into Review (HITL; nothing posts/spends).
 * Same CRON_SECRET Bearer auth as /api/cron. `?dryRun=1` reports the plan +
 * preflight gates with no side effects.
 *
 * Runtime note: the render shells to ffmpeg + needs font files. If this runs on
 * a runtime without ffmpeg/fonts, the batch preflight reports exactly what's
 * missing (it does NOT crash) — point the schedule at an ffmpeg-capable runtime
 * or set FFMPEG_PATH/FONT_*_PATH. Provider swap (VO) is one env var (VO_PROVIDER).
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "cron not configured (CRON_SECRET unset)" }, { status: 503 });
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  try {
    const report = await runRenderBatch({ dryRun });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
