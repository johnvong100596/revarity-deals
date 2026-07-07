/**
 * lib/renderBatch.js — the nightly money-arc render batch.
 *
 *   real Drive photos → AI hook (money-arc, claims-locked) → Zoe VO (Higgsfield)
 *   → 1080x1920 slideshow render → Review queue (human approves) → Slack ping
 *
 * Also runs a RE-RENDER pass first: drafts whose script was edited in Review are flagged
 * render_stale (the Vercel edit can't touch burned-in captions/VO); this batch rebuilds them from
 * the edited hook, overwrites the same draft, and clears the flag so Review can approve (RERENDER_LIMIT,
 * default 3). Caps 1–2 NEW renders/run (RENDER_BATCH_LIMIT, default 1). Everything is HITL: it
 * only drafts into Review — nothing posts or spends (D-04). Claims are hard-
 * gated by lib/claims via moneyArc.buildScript; CLAIMS_APR_UNLOCKED stays unset
 * (APR stays banned until leadership flips it on written terms). Preflight is
 * honest: if a runtime piece is missing (Drive key, ffmpeg, fonts) it reports
 * exactly what's absent instead of half-writing a draft.
 */
import fs from "node:fs";
import ffmpegStatic from "ffmpeg-static";
import { fetchFolderPhotos, listFolderImages, driveConfigured } from "./drive.js";
import { genHooks, buildScript } from "./moneyArc.js";
import { synthesizeVO, voiceConfigured, voiceProvider } from "./voice.js";
import { renderMoneyArcAd } from "./render.js";
import { renderCarouselSet } from "./carousel.js";
import { claimViolations, DM_KEYWORD } from "./claims.js";
import { putPublicVideo, putPublicPng, appendCreatives, readQueue } from "./store.js";
import { newId } from "./jobs.js";
import { notifyBatch } from "./notify.js";

function ffmpegResolves() {
  const p = process.env.FFMPEG_PATH || ffmpegStatic;
  return !!p && fs.existsSync(p);
}

/** What the batch needs to actually render, checked before any work. */
export function renderPreflight() {
  const reasons = [];
  if (!driveConfigured()) reasons.push("Drive not configured (GDRIVE_SA_JSON)");
  if (!process.env.FONT_BOLD_PATH) reasons.push("fonts not configured (FONT_BOLD_PATH)");
  if (!ffmpegResolves()) reasons.push("ffmpeg not available in this runtime (FFMPEG_PATH)");
  return { ok: reasons.length === 0, reasons, voiceReady: voiceConfigured(), voiceProvider: voiceProvider() };
}

const clampLimit = (n) => Math.max(1, Math.min(2, Number(n) || 1));

/**
 * Render ONE money-arc draft from a (claims-locked) script → both placements + both carousel sets,
 * host them, and build the queue rec. Shared by the new-hook batch and the re-render pass so there's
 * exactly one render path. Returns { rec, summary, voErr }. The rec carries NO render_stale field, so
 * writing it (fresh or overwrite) leaves the draft approvable. `created_at` is preserved on re-render.
 */
async function renderMoneyArcDraft({ photos, script, id, created_at }) {
  const voClips = [];
  let voErr = null;
  if (voiceConfigured()) {
    for (const line of script.voLines) {
      try { voClips.push(await synthesizeVO(line)); }
      catch (e) { voErr = e?.message || String(e); break; }
    }
  }
  // 1080x1920 reels + 1080x1350 feed + 5 PNG slides per placement (OPERATOR-PLAYBOOK step 4).
  const { buffer, manifest } = await renderMoneyArcAd({ photos, script, voClips, size: "reels" });
  const feed = await renderMoneyArcAd({ photos, script, voClips, size: "feed" });
  const igSlides = await renderCarouselSet({ photos, script, size: "feed" });
  const ttSlides = await renderCarouselSet({ photos, script, size: "reels" });
  const video_url = await putPublicVideo(buffer, `moneyarc-${id}-reels`);
  const video_url_feed = await putPublicVideo(feed.buffer, `moneyarc-${id}-feed`);
  const carousel_ig = [];
  for (const s of igSlides) carousel_ig.push(await putPublicPng(s.buffer, `moneyarc-${id}-ig-${s.name}`));
  const carousel_tt = [];
  for (const s of ttSlides) carousel_tt.push(await putPublicPng(s.buffer, `moneyarc-${id}-tt-${s.name}`));

  const allText = [script.hook, script.problem, script.weDoItAll, script.cta, script.postCaption, ...(script.captions || [])].join("\n");
  const qc_gates = {
    gate1: { key: "voice-read", label: "Voice read", voPending: manifest.voPending, voProvider: manifest.voProvider },
    gate2: {
      key: "claims-check",
      label: "Final claims check",
      checks: {
        onlyVerifiedClaim: claimViolations(allText).length === 0,
        disclaimerOnEndCard: !!script.disclaimer,
        dmKeyword: new RegExp(`\\b${DM_KEYWORD}\\b`).test(`${script.cta} ${script.postCaption}`),
        captionsInSafeZones: true, // renderer positions captions inside top-250/bottom-420 zones by construction
        lengthInWindow: manifest.durationSec >= 15 && manifest.durationSec <= 20,
        durationSec: manifest.durationSec,
      },
    },
  };
  const rec = {
    id, angle_id: "MONEYARC", variant: "MONEYARC", source: "render-batch", hasVideo: true,
    video_url, video_url_feed, carousel_ig, carousel_tt, qc_gates,
    headline: script.hook, body: `${script.problem} ${script.weDoItAll}`, cta: script.cta,
    caption: script.postCaption, disclaimer: script.disclaimer, dimensions: manifest.format,
    created_at: created_at || Date.now(),
    qa: {
      image_layer_verdict: "review",
      image_layer_reasons: [
        "auto-rendered money-arc draft — review before approve",
        manifest.voPending ? "VO pending (voice provider not yet wired) — captions only" : `VO: ${manifest.voProvider}`,
      ],
      qa_model: "",
    },
  };
  const summary = { id, unit: script.hook, voProvider: manifest.voProvider, voPending: manifest.voPending, formats: [manifest.format, feed.manifest.format, `carousel ×${carousel_ig.length + carousel_tt.length}`] };
  return { rec, summary, voErr };
}

/**
 * Run the batch. `dryRun` reports what it WOULD do (no VO, no render, no writes).
 * Returns { dryRun, gates, rendered[], skipped[], errors[] }.
 */
export async function runRenderBatch({ dryRun = false, limit = process.env.RENDER_BATCH_LIMIT } = {}) {
  const n = clampLimit(limit);
  const pf = renderPreflight();
  const report = { dryRun, gates: pf, rendered: [], skipped: [], errors: [] };

  if (dryRun) {
    const available = pf.ok || driveConfigured() ? (await listFolderImages().catch(() => [])).length : 0;
    report.wouldRender = pf.ok ? n : 0;
    report.photosAvailable = available;
    if (!pf.ok) report.skipped.push({ reason: `preflight: ${pf.reasons.join("; ")}` });
    return report;
  }

  if (!pf.ok) {
    report.skipped.push({ reason: `preflight: ${pf.reasons.join("; ")}` });
    report.notify = await notifyBatch(report); // a broken nightly must be VISIBLE, not silent (D-20)
    return report;
  }

  let photos = [];
  try {
    photos = await fetchFolderPhotos(undefined, { count: 8 });
  } catch (e) {
    report.errors.push({ error: `Drive fetch: ${e?.message || e}` });
  }
  if (!photos.length) {
    report.skipped.push({ reason: "no real photos in the Drive library — check the /best-of folder is shared with the service account and holds image files" });
    report.notify = await notifyBatch(report); // fire the digest/alert every run, even a zero-photo night (D-20)
    return report;
  }

  // ── Re-render pass: drafts whose script was edited in Review (render_stale) ──
  // The edit (Vercel) can't touch the burned-in captions/VO — ffmpeg lives HERE. So this pass
  // rebuilds the video from the EDITED hook (buildScript re-runs the claims lock), overwrites the
  // SAME per-item blob id, and — because the fresh rec carries no render_stale — clears the flag so
  // Review can approve it. Runs before new-hook gen: edited drafts are blocking approval, so they win.
  const RERENDER_LIMIT = Math.max(0, Number(process.env.RERENDER_LIMIT || 3));
  if (RERENDER_LIMIT > 0) {
    let stale = [];
    try {
      const q = await readQueue();
      stale = q.filter((c) => c.render_stale && c.video_url && (c.angle_id === "MONEYARC" || c.source === "render-batch") && c.headline);
    } catch (e) { report.errors.push({ error: `re-render queue read: ${e?.message || e}` }); }
    if (stale.length > RERENDER_LIMIT) report.skipped.push({ reason: `${stale.length - RERENDER_LIMIT} edited draft(s) deferred to next run (RERENDER_LIMIT=${RERENDER_LIMIT})` });
    let reRendered = 0;
    for (const card of stale.slice(0, RERENDER_LIMIT)) {
      try {
        const script = buildScript({ hook: card.headline }); // claims-locked from the EDITED hook (throws on violation)
        // Keep an edited post caption (organic, never burned into the video) if it's clean; else the formula default.
        if (card.caption && claimViolations(card.caption).length === 0) script.postCaption = card.caption;
        const { rec, summary, voErr } = await renderMoneyArcDraft({ photos, script, id: card.id, created_at: card.created_at });
        if (voErr) report.errors.push({ unit: card.id, error: `VO: ${voErr}` });
        // rec has NO render_stale → shape() clears it → the draft is approvable again.
        await appendCreatives([{ rec }], { isolated: true }); // overwrites the SAME per-item blob (distinct id, no race)
        report.rendered.push({ ...summary, rerender: true });
        reRendered++;
      } catch (e) {
        report.errors.push({ unit: card.id, error: `re-render: ${e?.message || String(e)}` });
      }
    }
    if (reRendered) report.reRendered = reRendered;
  }

  let hooks = [];
  try {
    hooks = await genHooks({ n: n + 2 });
  } catch (e) {
    report.errors.push({ error: `hook gen: ${e?.message || e}` });
    report.notify = await notifyBatch(report); // surface the failure AND any re-renders that landed (D-20)
    return report;
  }

  // Collect every NEW draft and persist them in ONE queue.json write after the loop.
  // Calling appendCreatives() once per unit races on the Blob read-modify-write (public-URL reads
  // lag writes via the CDN), so the second append reads a stale queue and clobbers the first —
  // silently dropping all but the last draft of a multi-render night. One batched write has no race.
  const created = [];
  for (const hook of hooks.slice(0, n)) {
    const id = newId("moneyarc");
    try {
      const script = buildScript({ hook }); // claims-locked; throws on any violation
      const { rec, summary, voErr } = await renderMoneyArcDraft({ photos, script, id });
      if (voErr) report.errors.push({ unit: id, error: `VO: ${voErr}` });
      created.push({ rec }); // persisted in one batched write after the loop (avoids the queue.json append race)
      report.rendered.push(summary);
    } catch (e) {
      report.errors.push({ unit: id, error: e?.message || String(e) });
    }
  }

  // Persist each draft as its OWN blob (isolated) — never a read-modify-write of
  // the shared queue.json. This is what makes the render immune to a concurrent
  // writer (hourly cron double-down, human Create, MCP) clobbering it mid-render.
  if (created.length) {
    try {
      await appendCreatives(created, { isolated: true });
      report.persisted = created.length;
    } catch (e) {
      // Persistence failed: the drafts rendered but are NOT in Review. Demote the
      // "rendered" claims to errors so the report/Slack alert is honest.
      report.errors.push({ error: `queue append (${created.length} draft${created.length === 1 ? "" : "s"} not persisted): ${e?.message || e}` });
      report.rendered = [];
    }
  }

  report.notify = await notifyBatch(report);
  return report;
}
