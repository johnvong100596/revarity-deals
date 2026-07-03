#!/usr/bin/env node
/**
 * Nightly render-batch entrypoint for GitHub Actions (ffmpeg lives there; Vercel
 * serverless can't run it). Runs the SAME lib/renderBatch the /api/cron/render
 * route runs, but as a plain Node process so ffmpeg + fonts are available. With
 * STORE_DRIVER=cloud + BLOB_READ_WRITE_TOKEN it writes to the SAME Blob queue
 * the live ads.revarity.com Review reads — so drafts land in Review for approval.
 *
 *   node scripts/render-batch.mjs            # real run (drafts into Review)
 *   node scripts/render-batch.mjs --dry-run  # preflight + plan only, no writes
 *
 * Env comes from the GitHub Actions job (mirrors of the Vercel env, as repo
 * secrets). Nothing posts or spends — HITL is preserved (drafts only, D-04).
 */
import { runRenderBatch } from "../lib/renderBatch.js";

const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

const report = await runRenderBatch({ dryRun });
console.log(JSON.stringify(report, null, 2));

// CI signal: a config/preflight gap surfaces as `skipped` and exits 0 (expected
// until env/fonts/ffmpeg are all present). Only hard-fail when we attempted real
// renders and every one errored — that's a genuine regression worth a red run.
if (!dryRun && report.errors?.length && !report.rendered?.length) {
  console.error(`Render batch failed: ${report.errors.map((e) => e.error || e).join("; ")}`);
  process.exit(1);
}
