import { NextResponse } from "next/server";
import { tick } from "@/lib/runpath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The autopilot heartbeat — Vercel Cron hits this on a schedule (see vercel.json). Runs the
 * post→track→double-down runpath. Inert unless autopilot is enabled + a channel connected + Meta wired.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token). `?dryRun=1` reports with no side effects.
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  try {
    const report = await tick({ dryRun });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
