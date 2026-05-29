import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // hint; long runs need a background job in prod

export async function POST(req) {
  // The engine can only be spawned in local/VM (fs) mode. On the serverless cloud deploy
  // this can't work AND would be an unauthenticated paid-quota trigger — refuse it.
  if ((process.env.STORE_DRIVER || "fs") === "cloud") {
    return NextResponse.json(
      { ok: false, error: "Pipeline runs are disabled on the cloud deployment. Run `pipeline.mjs` locally/CI, then `ingest.mjs` to publish." },
      { status: 501 }
    );
  }
  let clean = true;
  try { ({ clean = true } = await req.json()); } catch {}
  try {
    const result = await runPipeline({ clean });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
