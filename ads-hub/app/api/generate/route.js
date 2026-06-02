import { NextResponse } from "next/server";
import { genCopy, buildImagePrompt, buildBrollPrompt, buildPresenterPrompt, renderImage, specDims } from "@/lib/connectors";
import { startVideo } from "@/lib/higgsfield-cloud";
import { startVeo } from "@/lib/veo";
import { startFal, FAL_MODELS } from "@/lib/fal";
import { startUgc } from "@/lib/arcads";
import { appendCreatives, putPublicImage } from "@/lib/store";
import { saveJob, newId } from "@/lib/jobs";
import { scoreCreative } from "@/lib/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * On-demand generation (serverless, direct REST — no CLI). Everything lands in the Review queue and
 * still stops there (D-04). Types:
 *   "copy"  → N original copy variants (+ Creative Score)
 *   "image" → copy + brand-locked render → queue
 *   "video" → b-roll (Veo/Kling/Higgsfield) OR mode:"presenter" commercial (Veo native dialogue);
 *             engine:"arcads" routes the gated UGC talking-head lane. Poll via GET /api/generate/{jobId}.
 * The Director (/api/director) calls this per shot with directorPrompt + headline/spokenLine overrides,
 * so a planned shot renders without re-deriving copy.
 */

// Use director/operator-provided copy if present, else generate it.
async function resolveCopy({ provided, angleId, brief, reference }) {
  if (provided && (provided.headline || provided.body || provided.cta)) {
    return { headline: provided.headline || "", body: provided.body || "", cta: provided.cta || "Learn more", pricing_flag: null, hook: "custom" };
  }
  const [c] = await genCopy({ angleId, brief, reference, n: 1 });
  return c;
}

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  const type = b.type || "image";
  const angleId = b.angleId || "";
  const brief = (b.brief || "").slice(0, 2000);
  const reference = (b.reference || "").slice(0, 4000);
  const spec = b.spec && b.spec !== "auto" ? b.spec : "meta_feed_square";
  const n = Math.min(Math.max(parseInt(b.n, 10) || 1, 1), 4);
  const directorPrompt = (b.directorPrompt || "").slice(0, 1800);
  const provided = b.headline || b.body || b.cta ? { headline: b.headline, body: b.body, cta: b.cta } : null;

  try {
    if (type === "copy") {
      const variants = await genCopy({ angleId, brief, reference, n });
      const scored = await Promise.all(variants.map(async (v) => ({ ...v, scores: await scoreCreative({ ...v, angleId, spec, brief }) })));
      return NextResponse.json({ ok: true, type, variants: scored });
    }

    if (type === "image") {
      const copy = await resolveCopy({ provided, angleId, brief, reference });
      if (!copy) throw new Error("copy generation returned nothing");
      const prompt = directorPrompt || buildImagePrompt({ headline: copy.headline, angleId, spec, extra: brief });
      const [adPng, scores] = await Promise.all([
        renderImage(prompt, { final: b.final !== false }), // ultra-realism: default to the PRO image model

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
      const mode = b.mode === "presenter" ? "presenter" : "broll";
      let engine = b.engine || "kling";
      if (mode === "presenter") engine = "veo"; // presenter commercials need Veo's native synced dialogue
      const copy = await resolveCopy({ provided, angleId, brief, reference });
      const d = specDims(spec);
      const aspect = d.aspect === "9:16" ? "9:16" : d.aspect === "1:1" ? "1:1" : "16:9";
      const spokenLine = (b.spokenLine || copy?.headline || brief || "").slice(0, 400);
      const disclosure = mode === "presenter" || engine === "arcads" ? "ai-presenter" : null;
      const videoPrompt = directorPrompt || (mode === "presenter"
        ? buildPresenterPrompt({ headline: copy?.headline, body: copy?.body, cta: copy?.cta, angleId, brief, spokenLine })
        : buildBrollPrompt({ headline: copy?.headline || brief, angleId, brief }));
      const scores = await scoreCreative({ headline: copy?.headline, body: copy?.body, cta: copy?.cta, angleId, spec, brief, hasVideo: true });
      const baseJob = { type: "video", angleId, spec, headline: copy?.headline || "", brief, mode, disclosure, scores, script: disclosure ? spokenLine : null };

      // Arcads — gated UGC talking-head lane (fails closed until ARCADS_CLIENT_ID/SECRET set).
      if (engine === "arcads") {
        const scriptId = await startUgc({ script: spokenLine || copy?.headline || brief });
        const job = await saveJob({ id: newId("vid"), engine: "arcads", status: "rendering", arcadsScriptId: scriptId, ...baseJob, createdAt: Date.now() });
        return NextResponse.json({ ok: true, type, engine, jobId: job.id, status: "rendering" });
      }

      // fal.ai (Kling / Kling Turbo) — scalable D-03-safe b-roll.
      if (FAL_MODELS[engine]) {
        const falDuration = Number(b.targetSeconds) >= 10 ? "10" : "5"; // Kling supports 5s or 10s clips
        const { statusUrl, responseUrl } = await startFal(FAL_MODELS[engine], { prompt: videoPrompt, duration: falDuration, aspect_ratio: aspect });
        const job = await saveJob({ id: newId("vid"), engine, status: "rendering", falStatusUrl: statusUrl, falResponseUrl: responseUrl, ...baseJob, createdAt: Date.now() });
        return NextResponse.json({ ok: true, type, engine, jobId: job.id, status: "rendering" });
      }

      // Veo — presenter commercial (native synced audio + people) OR premium silent b-roll.
      if (engine === "veo") {
        const aspectRatio = d.aspect === "9:16" ? "9:16" : "16:9"; // Veo has no 1:1
        // Presenter vs b-roll differ only by PROMPT (buildPresenterPrompt vs buildBrollPrompt). Veo 3.1
        // gives the talking host + native synced audio from the prompt — no generateAudio/personGeneration
        // params (the Gemini API rejects them).
        const opName = await startVeo({ prompt: videoPrompt, aspectRatio, resolution: "720p" });
        const job = await saveJob({ id: newId("vid"), engine: "veo", status: "rendering", veoOp: opName, aspectRatio, ...baseJob, createdAt: Date.now() });
        return NextResponse.json({ ok: true, type, engine, jobId: job.id, status: "rendering" });
      }

      // Higgsfield — subtle motion on a brand still (silent ambient; b-roll only).
      const imgPrompt = directorPrompt || buildImagePrompt({ headline: copy?.headline || brief, angleId, spec, extra: brief });
      const adPng = await renderImage(imgPrompt, { final: false });
      const imageUrl = await putPublicImage(adPng, newId("src").slice(4));
      const setId = await startVideo({ imageUrl, prompt: brief || copy?.headline || "slow cinematic push-in, subtle motion" });
      const job = await saveJob({ id: newId("vid"), engine: "higgsfield", status: "rendering", cloudSetId: setId, ...baseJob, createdAt: Date.now() });
      return NextResponse.json({ ok: true, type, engine: "higgsfield", jobId: job.id, status: "rendering" });
    }

    return NextResponse.json({ ok: false, error: `unknown type ${type}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
