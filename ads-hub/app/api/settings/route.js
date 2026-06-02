import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { writeSettings } from "@/lib/settings";
import { keyStatus, COPY_MODEL } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODELS = {
  copy: COPY_MODEL,
  image: process.env.IMG_MODEL || "gemini-3.1-flash-image-preview",
  image_final: process.env.IMG_FINAL_MODEL || "gemini-3-pro-image-preview",
  video: process.env.HF_MODEL || "seedance1_5",
};

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json({ ok: true, config, keys: keyStatus(), models: MODELS });
}

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const saved = await writeSettings({ budgetMonthly: b.budgetMonthly, kpi: b.kpi });
    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
