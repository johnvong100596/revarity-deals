import { NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/jobs";
import { pollVideo } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Poll a generation job. Each call is short (serverless-safe): for a rendering video we ask
 * Higgsfield once and advance the job's status. No function is ever held open across the render.
 */
export async function GET(_req, { params }) {
  const job = await getJob(params.id);
  if (!job) return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });

  if (job.type === "video" && job.status === "rendering") {
    try {
      const { status, result_url } = await pollVideo(job.hfJobId);
      if (status === "completed" && result_url) { job.status = "done"; job.result_url = result_url; await saveJob(job); }
      else if (status === "failed" || status === "canceled") { job.status = "failed"; job.error = `higgsfield ${status}`; await saveJob(job); }
      else { job.hfStatus = status; } // still rendering — don't persist churn
    } catch (e) {
      job.error = String(e.message || e); // transient poll error; keep rendering
    }
  }
  return NextResponse.json({ ok: true, job });
}
