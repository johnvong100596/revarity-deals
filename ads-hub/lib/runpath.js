import { readSocial, writeSocial } from "./social.js";
import { readPerformance, writePerformance, rankWinners } from "./performance.js";
import { readQueue, readApprovals, appendCreatives, publicImageUrl } from "./store.js";
import { metaReady, publish, fetchInsights } from "./meta.js";
import { genCopy, buildImagePrompt, renderImage, specDims } from "./connectors.js";
import { newId } from "./jobs.js";

/**
 * The autonomous runpath: POST due+approved → TRACK views → DOUBLE-DOWN on winners.
 * Runs every cron tick. Completely inert unless autopilot is ENABLED; each step is also gated on the
 * channel being connected and the Meta token being wired (metaReady) — so nothing posts or spends
 * until everything's truly live. dryRun reports what WOULD happen with zero side effects.
 *
 * Honors approve-the-queue: only human-approved creatives post, and double-down variations land back
 * in the Review queue (not auto-posted).
 */
const MIN_VIEWS = Number(process.env.DOUBLEDOWN_MIN_VIEWS || 1000);
const MAX_DD_PER_TICK = Number(process.env.DOUBLEDOWN_MAX_PER_TICK || 2);

export async function tick({ dryRun = false } = {}) {
  const now = Date.now();
  const report = { ranAt: new Date(now).toISOString(), dryRun, autopilot: false, posted: [], skipped: [], tracked: 0, winners: [], doubledDown: [], note: "" };

  const social = await readSocial();
  if (!social.autopilot?.enabled) { report.note = "autopilot off — nothing runs"; return report; }
  report.autopilot = true;
  const connected = (ch) => !!social.connections?.[ch]?.connected;

  // 1) POST — due, approved, connected, token-wired
  const dec = (await readApprovals()).decisions || {};
  const queue = await readQueue();
  const byId = Object.fromEntries(queue.map((c) => [c.id, c]));
  let socialChanged = false;
  for (const item of social.schedule || []) {
    if (item.status !== "queued" || !item.postAt || new Date(item.postAt).getTime() > now) continue;
    if (!connected(item.channel)) { report.skipped.push({ id: item.id, reason: "channel not connected" }); continue; }
    if (dec[item.creativeId] !== "approve" || !byId[item.creativeId]) { report.skipped.push({ id: item.id, reason: "creative not approved" }); continue; }
    if (!metaReady(item.channel)) { report.skipped.push({ id: item.id, reason: "Meta token not wired" }); continue; }
    if (dryRun) { report.posted.push({ id: item.id, channel: item.channel, would: true }); continue; }
    try {
      const c = byId[item.creativeId];
      const caption = [c.headline, c.body, c.cta].filter(Boolean).join("\n\n");
      const imageUrl = await publicImageUrl(item.creativeId);
      const postRef = await publish({ channel: item.channel, caption, imageUrl });
      item.status = "posted"; item.postRef = postRef; item.postedAt = new Date(now).toISOString();
      socialChanged = true; report.posted.push({ id: item.id, channel: item.channel, postRef });
    } catch (e) { report.skipped.push({ id: item.id, reason: e.message }); }
  }
  if (socialChanged && !dryRun) await writeSocial(social);

  // 2) TRACK — refresh insights for posted items
  const perf = await readPerformance();
  const posts = perf.posts || [];
  const at = Object.fromEntries(posts.map((p, i) => [p.postRef, i]));
  let perfChanged = false;
  for (const item of (social.schedule || []).filter((x) => x.status === "posted" && x.postRef && metaReady(x.channel))) {
    if (dryRun) { report.tracked++; continue; }
    try {
      const ins = await fetchInsights({ channel: item.channel, postRef: item.postRef });
      if (!ins) continue;
      const rec = { creativeId: item.creativeId, channel: item.channel, postRef: item.postRef, postedAt: item.postedAt, ...ins, updatedAt: new Date(now).toISOString() };
      if (item.postRef in at) posts[at[item.postRef]] = rec; else { posts.push(rec); at[item.postRef] = posts.length - 1; }
      perfChanged = true; report.tracked++;
    } catch { /* transient insight error — skip this tick */ }
  }
  if (perfChanged && !dryRun) { perf.posts = posts; await writePerformance(perf); }

  // 3) DOUBLE-DOWN — make more like winners (into the Review queue; human still approves)
  const winners = rankWinners(posts).filter((w) => (w.views || 0) >= MIN_VIEWS);
  report.winners = winners.slice(0, 5).map((w) => ({ creativeId: w.creativeId, views: w.views }));
  const done = new Set(social.doubledDown || []);
  let made = 0;
  for (const w of winners) {
    if (made >= MAX_DD_PER_TICK || done.has(w.postRef)) continue;
    const base = byId[w.creativeId];
    if (!base) continue;
    if (dryRun) { report.doubledDown.push({ from: w.creativeId, would: true }); done.add(w.postRef); made++; continue; }
    try {
      const brief = `Fresh variation in the spirit of a proven winner (angle ${base.angle_id}, headline "${base.headline}") — same winning angle, new hook + visual.`;
      const [copy] = await genCopy({ angleId: base.angle_id, brief, n: 1 });
      const spec = base.spec || "meta_feed_square";
      const adPng = await renderImage(buildImagePrompt({ headline: copy.headline, angleId: base.angle_id, spec, extra: brief }), {});
      const d = specDims(spec);
      const id = `hub-generated/${newId("dd").slice(3)}`;
      await appendCreatives([{ rec: { id, angle_id: base.angle_id, variant: "DOUBLEDOWN", spec, dimensions: `${d.w}x${d.h}`, headline: copy.headline, body: copy.body, cta: copy.cta, pricing_flag: copy.pricing_flag, source: "doubledown", from: w.creativeId, created_at: now, qa: { image_layer_verdict: "review", image_layer_reasons: ["auto-made from a winner — review before approve"], qa_model: "" } }, adPng }]);
      done.add(w.postRef); made++; report.doubledDown.push({ from: w.creativeId, newId: id });
    } catch (e) { report.skipped.push({ reason: "double-down: " + e.message }); }
  }
  if (made && !dryRun) { social.doubledDown = [...done]; await writeSocial(social); }

  return report;
}
