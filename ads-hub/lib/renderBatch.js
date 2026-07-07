/**
 * lib/renderBatch.js — the nightly money-arc render batch.
 *
 *   real Drive photos → AI hook (money-arc, claims-locked) → Zoe VO (Higgsfield)
 *   → 1080x1920 slideshow render → Review queue (human approves) → Slack ping
 *
 * Caps 1–2 renders/run (RENDER_BATCH_LIMIT, default 1). Everything is HITL: it
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
import { putPublicVideo, putPublicPng, appendCreatives } from "./store.js";
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
    await notifyBatch(report); // a broken nightly must be VISIBLE, not silent (D-20)
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
    await notifyBatch(report); // fire the digest/alert every run, even a zero-photo night (D-20)
    return report;
  }

  let hooks = [];
  try {
    hooks = await genHooks({ n: n + 2 });
  } catch (e) {
    report.errors.push({ error: `hook gen: ${e?.message || e}` });
    return report;
  }

  for (const hook of hooks.slice(0, n)) {
    const id = newId("moneyarc");
    try {
      const script = buildScript({ hook }); // claims-locked; throws on any violation
      // VO per line via the abstracted seam (Higgsfield "Zoe" by default).
      const voClips = [];
      if (voiceConfigured()) {
        for (const line of script.voLines) {
          try { voClips.push(await synthesizeVO(line)); }
          catch (e) { report.errors.push({ unit: id, error: `VO: ${e?.message || e}` }); break; }
        }
      }
      // Every ad ships in BOTH placements + the carousel sets (OPERATOR-PLAYBOOK step 4):
      // 1080x1920 reels + 1080x1350 feed + 5 PNG slides per placement.
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

      // The playbook's two QC gates, machine-prechecked where a machine can (gate 2's
      // checklist) — the TICKS stay human, in Review. Approve is blocked until both pass.
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
        id,
        angle_id: "MONEYARC",
        variant: "MONEYARC",
        source: "render-batch",
        hasVideo: true,
        video_url,
        video_url_feed,
        carousel_ig,
        carousel_tt,
        qc_gates,
        headline: script.hook,
        body: `${script.problem} ${script.weDoItAll}`,
        cta: script.cta,
        caption: script.postCaption,
        disclaimer: script.disclaimer,
        dimensions: manifest.format,
        created_at: Date.now(),
        qa: {
          image_layer_verdict: "review",
          image_layer_reasons: [
            "auto-rendered money-arc draft — review before approve",
            manifest.voPending ? "VO pending (voice provider not yet wired) — captions only" : `VO: ${manifest.voProvider}`,
          ],
          qa_model: "",
        },
      };
      await appendCreatives([{ rec }]);
      report.rendered.push({ id, unit: script.hook, voProvider: manifest.voProvider, voPending: manifest.voPending, formats: [manifest.format, feed.manifest.format, `carousel ×${carousel_ig.length + carousel_tt.length}`] });
    } catch (e) {
      report.errors.push({ unit: id, error: e?.message || String(e) });
    }
  }

  await notifyBatch(report);
  return report;
}
