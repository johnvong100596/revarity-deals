import { head, list } from "@vercel/blob";
const token = process.env.BLOB_READ_WRITE_TOKEN;
(async () => {
  const b = await head("state/queue.json", { token });
  const q = await (await fetch(b.url, { cache: "no-store" })).json();
  const hub = q.filter((c) => c.source === "hub");
  const hubImg = hub.filter((c) => !c.video_url);
  const hubVid = hub.filter((c) => c.video_url);
  const bySpec = {}; hub.forEach((c) => { bySpec[c.spec] = (bySpec[c.spec] || 0) + 1; });
  console.log("queue total:", q.length);
  console.log("hub items:", hub.length, "| hub images:", hubImg.length, "| hub videos:", hubVid.length);
  console.log("hub by spec:", JSON.stringify(bySpec));
  // how many video JOBS actually rendered (source of truth for recovery)
  const jobs = await list({ token, prefix: "jobs/", limit: 1000 });
  let doneVids = 0, total = 0;
  for (const blob of jobs.blobs) {
    total++;
    try { const j = await (await fetch(blob.url, { cache: "no-store" })).json(); if (j.type === "video" && j.status === "done" && j.result_url) doneVids++; } catch {}
  }
  console.log("video jobs total:", total, "| done-with-url (recoverable):", doneVids);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
