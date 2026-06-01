#!/usr/bin/env node
/**
 * Batch-generate 28 ad creatives into the LIVE review queue.
 * Run against a local dev server started with STORE_DRIVER=cloud (writes to the prod Vercel Blob queue):
 *     STORE_DRIVER=cloud npm run dev      (in one shell)
 *     node scripts/batch-28-ads.mjs       (in another)
 * 14 images (7 IG 9:16 + 7 FB 1:1) + 14 videos (Kling via fal, 7 IG + 7 FB). D-04: everything stops at Review.
 */
const BASE = process.env.HUB_BASE || "http://localhost:4321";
const IG = "meta_story_vertical", FB = "meta_feed_square";

// 14 distinct, compliant STR-offer concepts (honest model: free entry, at-cost, done-for-you, no guarantees).
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

const items = [];
CONCEPTS.forEach((brief, i) => {
  const spec = i < 7 ? IG : FB;               // 0-6 → Instagram (9:16), 7-13 → Facebook (1:1)
  items.push({ type: "image", spec, brief });
  items.push({ type: "video", engine: "kling", spec, brief });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(BASE + "/api/health"); if (r.ok) return; } catch {}
    await sleep(2000);
  }
  throw new Error("dev server not reachable at " + BASE);
}
async function gen(item) {
  const res = await fetch(BASE + "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.error || `generate ${res.status}`);
  return data;
}
async function pollJob(id) {
  for (let i = 0; i < 150; i++) {
    await sleep(5000);
    const res = await fetch(`${BASE}/api/generate/${id}`, { cache: "no-store" });
    const { job } = await res.json().catch(() => ({}));
    if (job?.status === "done") return job;
    if (job?.status === "failed") throw new Error(job.error || "render failed");
  }
  throw new Error("timed out");
}

async function run() {
  await waitForServer();
  console.log("server up — generating 28 ads (14 image + 14 video)…");
  let okImg = 0, okVid = 0, fail = 0;

  for (const img of items.filter((x) => x.type === "image")) {
    try { await gen(img); console.log(`img ✓ (${img.spec}) ${++okImg}/14`); }
    catch (e) { fail++; console.log(`img ✗ ${e.message}`); }
  }

  const jobs = [];
  for (const v of items.filter((x) => x.type === "video")) {
    try { const d = await gen(v); jobs.push(d.jobId); console.log(`vid queued (${v.spec}) ${jobs.length}/14`); }
    catch (e) { fail++; console.log(`vid submit ✗ ${e.message}`); }
  }
  await Promise.all(jobs.map((id) =>
    pollJob(id).then(() => console.log(`vid ✓ ${++okVid}/${jobs.length}`)).catch((e) => { fail++; console.log(`vid ✗ ${e.message}`); })
  ));

  console.log(`\nDONE — images:${okImg} videos:${okVid} failed:${fail}`);
}
run().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
