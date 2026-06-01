import { NextResponse } from "next/server";
import { genCopy, buildImagePrompt, buildBrollPrompt, renderImage, specDims } from "@/lib/connectors";
import { startVideo } from "@/lib/higgsfield-cloud";
import { startVeo } from "@/lib/veo";
import { startFal, FAL_MODELS } from "@/lib/fal";
import { appendCreatives, putPublicImage } from "@/lib/store";
import { saveJob, newId } from "@/lib/jobs";
import { scoreCreative } from "@/lib/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * On-demand generation (serverless, direct REST — no CLI). The operator generates as many as they
 * want until they find a winner; everything lands in the Review queue and still stops there (D-04).
 *   type "copy"  → N original copy variants (fast, no image)
 *   type "image" → copy + brand-locked render → appended to the queue (fast)
 *   type "video" → render base image → Higgsfield image→video job → poll via GET /api/generate/{jobId}
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  const type = b.type || "image";
  const angleId = b.angleId || "";
  const brief = (b.brief || "").slice(0, 2000);
  const reference = (b.reference || "").slice(0, 4000);
  const spec = b.spec || "meta_feed_square";
  const n = Math.min(Math.max(parseInt(b.n, 10) || 1, 1), 4);

  try {
    if (type === "copy") {
      const variants = await genCopy({ angleId, brief, reference, n });
      // Predictive Creative Score per variant (non-blocking, parallel — null if scoring fails).
      const scored = await Promise.all(
        variants.map(async (v) => ({ ...v, scores: await scoreCreative({ ...v, angleId, spec, brief }) }))
      );
      return NextResponse.json({ ok: true, type, variants: scored });
    }

    if (type === "image") {
      const [copy] = await genCopy({ angleId, brief, reference, n: 1 });
      if (!copy) throw new Error("copy generation returned nothing");
      const prompt = buildImagePrompt({ headline: copy.headline, angleId, spec, extra: brief });
      // Render the image and score the copy in parallel — scoring never blocks the creative.
      const [adPng, scores] = await Promise.all([
        renderImage(prompt, { final: !!b.final }),
        scoreCreative({ headline: copy.headline, body: copy.body, cta: copy.cta, angleId, spec, brief }),
      ]);
      const d = specDims(spec);
      const id = `hub-generated/${newId("ad").slice(4)}`;
      const rec = {
        id, angle_id: angleId || "CUSTOM", variant: "HUB", spec, dimensions: `${d.w}x${d.h}`,
        headline: copy.headline, body: copy.body, cta: copy.cta, pricing_flag: copy.pricing_flag,
        source: "hub", brief, created_at: Date.now(), scores,
        qa: { image_layer_verdict: "review", image_layer_reasons: ["hub-generated — review before approve"], qa_model: "" },
      };
      await appendCreatives([{ rec, adPng }]);
      return NextResponse.json({ ok: true, type, id, headline: copy.headline, body: copy.body, cta: copy.cta, pricing_flag: copy.pricing_flag, scores });
    }

    if (type === "video") {
      const engine = b.engine || "kling"; // default to the scalable fal engine (no preview cap)
      const [copy] = await genCopy({ angleId, brief, reference, n: 1 });
      const d = specDims(spec);
      const aspect = d.aspect === "9:16" ? "9:16" : d.aspect === "1:1" ? "1:1" : "16:9";
      const brollPrompt = buildBrollPrompt({ headline: copy?.headline || brief, angleId, brief });
      // Score the concept now (non-blocking); stash on the job so the poll route attaches it to the
      // finished video creative in Review. Judges the copy as it will run over b-roll + voiceover.
      const scores = await scoreCreative({ headline: copy?.headline, body: copy?.body, cta: copy?.cta, angleId, spec, brief, hasVideo: true });

      // fal.ai (Kling) — scalable, parallel, no preview daily cap. D-03-safe b-roll (no talking-head).
      if (FAL_MODELS[engine]) {
        const { statusUrl, responseUrl } = await startFal(FAL_MODELS[engine], { prompt: brollPrompt, duration: "5", aspect_ratio: aspect });
        const job = await saveJob({ id: newId("vid"), type: "video", engine, status: "rendering", falStatusUrl: statusUrl, falResponseUrl: responseUrl, angleId, spec, headline: copy?.headline || "", brief, scores, createdAt: Date.now() });
        return NextResponse.json({ ok: true, type, engine, jobId: job.id, status: "rendering" });
      }

      // Veo 3.1 — premium b-roll (rate-limited preview model)
      if (engine === "veo") {
        const aspectRatio = d.aspect === "9:16" ? "9:16" : "16:9"; // Veo has no 1:1
        const opName = await startVeo({ prompt: brollPrompt, aspectRatio, resolution: "720p" });
        const job = await saveJob({ id: newId("vid"), type: "video", engine, status: "rendering", veoOp: opName, aspectRatio, angleId, spec, headline: copy?.headline || "", brief, scores, createdAt: Date.now() });
        return NextResponse.json({ ok: true, type, engine, jobId: job.id, status: "rendering" });
      }

      // Higgsfield — subtle motion on a brand still (silent; fine for ambient image-ads)
      const imgPrompt = buildImagePrompt({ headline: copy?.headline || brief, angleId, spec, extra: brief });
      const adPng = await renderImage(imgPrompt, { final: false });
      const imageUrl = await putPublicImage(adPng, newId("src").slice(4));
      const setId = await startVideo({ imageUrl, prompt: brief || copy?.headline || "slow cinematic push-in, subtle motion" });
      const job = await saveJob({ id: newId("vid"), type: "video", engine: "higgsfield", status: "rendering", cloudSetId: setId, angleId, spec, headline: copy?.headline || "", brief, scores, createdAt: Date.now() });
      return NextResponse.json({ ok: true, type, engine: "higgsfield", jobId: job.id, status: "rendering" });
    }

    return NextResponse.json({ ok: false, error: `unknown type ${type}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
