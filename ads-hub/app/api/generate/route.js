import { NextResponse } from "next/server";
import { genCopy, buildImagePrompt, renderImage, specDims } from "@/lib/connectors";
import { startVideo } from "@/lib/higgsfield-cloud";
import { appendCreatives, putPublicImage } from "@/lib/store";
import { saveJob, newId } from "@/lib/jobs";

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
      return NextResponse.json({ ok: true, type, variants });
    }

    if (type === "image") {
      const [copy] = await genCopy({ angleId, brief, reference, n: 1 });
      if (!copy) throw new Error("copy generation returned nothing");
      const prompt = buildImagePrompt({ headline: copy.headline, angleId, spec, extra: brief });
      const adPng = await renderImage(prompt, { final: !!b.final });
      const d = specDims(spec);
      const id = `hub-generated/${newId("ad").slice(4)}`;
      const rec = {
        id, angle_id: angleId || "CUSTOM", variant: "HUB", spec, dimensions: `${d.w}x${d.h}`,
        headline: copy.headline, body: copy.body, cta: copy.cta, pricing_flag: copy.pricing_flag,
        source: "hub", brief, created_at: Date.now(),
        qa: { image_layer_verdict: "review", image_layer_reasons: ["hub-generated — review before approve"], qa_model: "" },
      };
      await appendCreatives([{ rec, adPng }]);
      return NextResponse.json({ ok: true, type, id, headline: copy.headline, body: copy.body, cta: copy.cta, pricing_flag: copy.pricing_flag });
    }

    if (type === "video") {
      const [copy] = await genCopy({ angleId, brief, reference, n: 1 });
      const imgPrompt = buildImagePrompt({ headline: copy?.headline || brief, angleId, spec, extra: brief });
      const adPng = await renderImage(imgPrompt, { final: false });
      const imageUrl = await putPublicImage(adPng, newId("src").slice(4));
      const setId = await startVideo({ imageUrl, prompt: brief || copy?.headline || "slow cinematic push-in, subtle motion" });
      const job = await saveJob({ id: newId("vid"), type: "video", status: "rendering", cloudSetId: setId, angleId, spec, headline: copy?.headline || "", brief, createdAt: Date.now() });
      return NextResponse.json({ ok: true, type, jobId: job.id, status: "rendering" });
    }

    return NextResponse.json({ ok: false, error: `unknown type ${type}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
