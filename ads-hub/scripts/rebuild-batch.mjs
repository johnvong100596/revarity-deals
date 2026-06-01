/**
 * Clean rebuild of the 28-ad batch into the live queue, fixing the lost-update race:
 *  - regenerate 14 images via the dev server (collect copy from the API response)
 *  - reuse the 14 already-rendered video jobs (no re-spend) from Blob jobs/
 *  - drop the partial hub items and write queue.json ONCE (atomic → no race)
 * Run with the dev server up in cloud mode (STORE_DRIVER=cloud npm run dev).
 */
import { head, list, put } from "@vercel/blob";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BASE = process.env.HUB_BASE || "http://localhost:4321";
const QUEUE_KEY = "state/queue.json";
const IG = "meta_story_vertical", FB = "meta_feed_square";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONCEPTS = [
  "Honesty hook: most Airbnb 'mentors' sell a course — we build the actual unit. Premium, credible.",
  "Free to come in: browse our sourced short-term-rental deals and community at no cost; pay nothing until you accept a deal.",
  "Done-for-you end to end: we source the unit, coordinate the lease, design, furnish, launch the listing, and manage it.",
  "At cost, no markup: you fund your own unit at cost — no inflated fees, no franchise fee. Transparent and premium.",
  "Not a course, not a guru program: a real short-term-rental operating business for serious investors.",
  "Own an Airbnb without running one: your capital builds the asset, our team handles operations.",
  "Hands-off ownership: keys, cleaning, guests, pricing, listing — all handled. You own the asset.",
  "Turn a lease into income: a beautifully furnished, launch-ready short-term rental.",
  "Small intake: we work with a limited number of clients; not every market or budget is a fit.",
  "From empty unit to booked listing: the premium transformation, done right.",
  "Management billed after setup, never upfront: ongoing service, transparent.",
  "Premium short-stay, editorial interiors, golden light — the Revarity standard.",
  "For investors with real capital who want a built business, not homework.",
  "Book a consultation — we'll tell you honestly if a short-term rental makes sense for you.",
];

function card(o) {
  const vertical = (o.spec || "").includes("story") || (o.spec || "").includes("vertical");
  const q = encodeURIComponent(o.id);
  return {
    id: o.id, angle_id: o.angle_id || "CUSTOM", variant: "HUB", spec: o.spec, dimensions: o.dimensions || "",
    headline: o.headline || "", body: o.body || "", cta: o.cta || "", pricing_flag: o.pricing_flag || null,
    qa: "review", qa_reasons: ["hub-generated — review before approve"], qa_model: "",
    vertical, source: "hub", created_at: o.created_at || Date.now(),
    hasImg: !o.video_url, image_url: null, ad_url: o.video_url ? null : `/api/image?id=${q}&v=ad`, ad_photo_url: null,
    video_url: o.video_url || null,
  };
}

async function waitForServer() {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(BASE + "/api/health")).ok) return; } catch {} await sleep(2000); }
  throw new Error("dev server not reachable");
}

async function main() {
  await waitForServer();
  console.log("server up — rebuilding batch…");

  // 1) regenerate 14 images, collect copy from responses
  const imgCards = [];
  for (let i = 0; i < CONCEPTS.length; i++) {
    const spec = i < 7 ? IG : FB;
    try {
      const res = await fetch(BASE + "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "image", spec, brief: CONCEPTS[i] }) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "img fail");
      imgCards.push(card({ id: d.id, spec, headline: d.headline, body: d.body, cta: d.cta, pricing_flag: d.pricing_flag }));
      console.log(`img ${imgCards.length}/14 (${spec})`);
    } catch (e) { console.log("img ✗", e.message); }
  }

  // 2) pull the rendered video jobs (no re-spend)
  const jobsList = await list({ token: TOKEN, prefix: "jobs/", limit: 1000 });
  const vids = [];
  for (const b of jobsList.blobs) {
    try { const j = await (await fetch(b.url, { cache: "no-store" })).json(); if (j.type === "video" && j.status === "done" && j.result_url && j.headline) vids.push(j); } catch {}
  }
  vids.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const vidCards = vids.slice(0, 14).map((j) => card({ id: `hub-generated/${j.id}`, spec: j.spec, headline: j.headline, brief: j.brief, video_url: j.result_url, created_at: j.createdAt }));
  console.log(`video cards: ${vidCards.length}`);

  // 3) single atomic queue write: keep non-hub items, replace hub items with our clean 28
  const b = await head(QUEUE_KEY, { token: TOKEN });
  const cur = await (await fetch(b.url, { cache: "no-store" })).json();
  const kept = cur.filter((c) => c.source !== "hub");
  const next = [...vidCards, ...imgCards, ...kept];
  await put(QUEUE_KEY, JSON.stringify(next), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token: TOKEN });
  console.log(`\nDONE — wrote queue: ${imgCards.length} images + ${vidCards.length} videos + ${kept.length} kept = ${next.length} total`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
