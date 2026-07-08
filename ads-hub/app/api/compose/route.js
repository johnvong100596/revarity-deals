// POST /api/compose — the SIMPLE path: your caption + your photos → one draft in Review.
// No AI generation. Runs the claims lock on the visible text, then queues a manual post
// (single image or carousel) that Review previews as an IG/FB post. Nothing publishes (D-04).
import { appendCreatives, listLibraryPhotos } from "@/lib/store";
import { claimViolations } from "@/lib/claims";
import { newId } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const name = String(body?.name || "").trim().slice(0, 200);
  const caption = String(body?.caption || "").trim().slice(0, 3000);
  const disclaimer = String(body?.disclaimer || "").trim().slice(0, 300);
  const cta = String(body?.cta || "").trim().slice(0, 40);
  const format = body?.format === "carousel" ? "carousel" : "square";
  const photoIds = Array.isArray(body?.photos) ? body.photos.map((x) => String(x)).slice(0, 10) : [];

  if (!caption && !photoIds.length) {
    return Response.json({ ok: false, error: "Add a caption or at least one photo." }, { status: 400 });
  }

  // Claims lock on everything that will be VISIBLE (caption + disclaimer + CTA). Same regime as the generator.
  const violations = claimViolations([caption, disclaimer, cta].filter(Boolean).join("\n"));
  if (violations.length) {
    return Response.json({ ok: false, error: "claims_lock", kinds: [...new Set(violations.map((v) => v.kind))], violations }, { status: 422 });
  }

  // Resolve Library ids → urls (in the order given: photo 1, photo 2, …).
  let urls = [];
  if (photoIds.length) {
    const lib = await listLibraryPhotos();
    const byId = new Map(lib.map((p) => [p.id, p]));
    const unknown = photoIds.filter((id) => !byId.has(id));
    if (unknown.length) return Response.json({ ok: false, error: `Photo(s) not in the library: ${unknown.join(", ")}` }, { status: 400 });
    urls = photoIds.map((id) => byId.get(id).url);
  }

  const carousel = format === "carousel" && urls.length > 1;
  const id = `hub-generated/${newId("post").slice(5)}`;
  const rec = {
    id, angle_id: "POST", variant: "MANUAL", source: "compose",
    spec: "meta_feed_square", dimensions: "1080x1080",
    headline: name || caption.slice(0, 90),
    body: caption, caption, disclaimer: disclaimer || undefined,
    cta: cta || "Comment SETUP",
    image_url: urls[0] || null,
    carousel_ig: carousel ? urls : undefined,
    sourcePhotos: urls.length ? urls : undefined,
    created_at: Date.now(),
    qa: { image_layer_verdict: "review", image_layer_reasons: ["manual post — review the IG/FB preview, then you post it"], qa_model: "" },
  };
  await appendCreatives([{ rec }], { isolated: true });
  return Response.json({ ok: true, id, status: "pending-review" });
}
