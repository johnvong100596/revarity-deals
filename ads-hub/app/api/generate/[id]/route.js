import { NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/jobs";
import { pollVideo } from "@/lib/higgsfield-cloud";
import { pollVeo, fetchVeoVideo } from "@/lib/veo";
import { pollFal } from "@/lib/fal";
import { pollUgc } from "@/lib/arcads";
import { putPublicVideo, appendCreatives } from "@/lib/store";
import { specDims, primeOverrides } from "@/lib/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Poll a generation job. Each call is short (serverless-safe): we ask the engine once and advance the
 * job's status. For Veo, the finished file URI needs the API key, so on completion we download it and
 * re-host it as a public video the browser can play. No function is held open across the render.
 */
export async function GET(_req, { params }) {
  const job = await getJob(params.id);
  if (!job) return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });

  if (job.type === "video" && job.status === "rendering") {
    try {
      if (job.engine === "veo") {
        const r = await pollVeo(job.veoOp);
        if (r.status === "completed" && r.video_uri) {
          const buf = await fetchVeoVideo(r.video_uri);
          job.result_url = await putPublicVideo(buf, job.id);
          job.status = "done";
          await saveJob(job);
        } else if (r.status === "failed") {
          job.status = "failed"; job.error = r.error || "veo failed"; await saveJob(job);
        } // else still rendering
      } else if (job.engine === "arcads") {
        const r = await pollUgc(job.arcadsScriptId);
        if (r.status === "completed" && r.result_url) { job.status = "done"; job.result_url = r.result_url; await saveJob(job); }
        else if (r.status === "failed") { job.status = "failed"; job.error = r.error || "arcads failed"; await saveJob(job); }
      } else if (job.falStatusUrl) {
        const r = await pollFal({ statusUrl: job.falStatusUrl, responseUrl: job.falResponseUrl });
        if (r.status === "completed") { job.status = "done"; job.result_url = r.result_url; await saveJob(job); }
        else if (r.status === "failed") { job.status = "failed"; job.error = r.error || "fal failed"; await saveJob(job); }
      } else {
        const { status, result_url } = await pollVideo(job.cloudSetId);
        if (status === "completed" && result_url) { job.status = "done"; job.result_url = result_url; await saveJob(job); }
        else if (status === "failed" || status === "canceled") { job.status = "failed"; job.error = `higgsfield ${status}`; await saveJob(job); }
        else { job.hfStatus = status; } // still rendering — don't persist churn
      }
    } catch (e) {
      job.error = String(e.message || e); // transient poll error; keep rendering
    }
  }

  // When a video finishes, append it to the Review queue once (so it shows as an approve/post card — D-04 still holds).
  if (job.type === "video" && job.status === "done" && job.result_url && !job.queued) {
    try {
      await primeOverrides(); // honor custom format dimensions when stamping the finished video's record
      const d = specDims(job.spec || "");
      const rec = {
        id: `hub-generated/${job.id}`, angle_id: job.angleId || "CUSTOM", variant: "HUB", spec: job.spec,
        dimensions: `${d.w}x${d.h}`, headline: job.headline || "", body: "", cta: "",
        source: "hub", brief: job.brief || "", created_at: job.createdAt || Date.now(), video_url: job.result_url,
        scores: job.scores || null, mode: job.mode || "broll", disclosure: job.disclosure || null, script: job.script || null,
        qa: { image_layer_verdict: "review", image_layer_reasons: ["hub-generated video — review before approve"], qa_model: "" },
      };
      await appendCreatives([{ rec }]);
      job.queued = true;
      await saveJob(job);
    } catch { /* leave unqueued; a later poll will retry the append */ }
  }
  return NextResponse.json({ ok: true, job });
}
