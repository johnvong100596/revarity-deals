#!/usr/bin/env node
/**
 * Revarity Creative Engine — image render step (model-routing.json → image_render)
 * --------------------------------------------------------------------------------
 * Renders the queued creatives with Nano Banana via the Google Gemini API.
 *   - draft model:  gemini-3.1-flash-image-preview  (default, every creative)
 *   - final model:  gemini-3-pro-image-preview      (--final, or escalate on text-fidelity)
 *
 * Reads each <variant>-<format>.prompt.txt in creative-engine/output/<ANGLE>/, calls the
 * API, writes <variant>-<format>.png next to it, and flips render_status in the .json.
 *
 * This step does NOT publish anything (D-04). It only produces local PNGs for the
 * downstream screenshot-QA pass and, after that, the human approval gate.
 *
 * Usage:
 *   node creative-engine/render.mjs            # draft-render everything still PENDING_RENDER
 *   node creative-engine/render.mjs --final    # render on the pro model (text-fidelity cases)
 *   node creative-engine/render.mjs --only AD1_DEAL_LIST/B-meta_feed_square
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");

// ── minimal .env.local loader (no dependency) ───────────────────────────────────
function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const routing = JSON.parse(fs.readFileSync(path.join(ROOT, "creative-engine/model-routing.json"), "utf8"));
const DRAFT_MODEL = routing.tasks.image_render.model;            // gemini-3.1-flash-image-preview
const FINAL_MODEL = routing.tasks.image_render.final_render_model; // gemini-3-pro-image-preview

const argv = process.argv.slice(2);
const useFinal = argv.includes("--final");
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
const MODEL = useFinal ? FINAL_MODEL : DRAFT_MODEL;

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY is not set in .env.local. Add the Google AI Studio key (AIza...) and re-run.");
  console.error("Render skipped — no creative was published; nothing downstream was touched.");
  process.exit(2);
}

// ── Gemini image generation ─────────────────────────────────────────────────────
async function renderOne(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error("no image in response: " + JSON.stringify(data).slice(0, 300));
  return Buffer.from(img.inlineData.data, "base64");
}

// ── walk the queue ──────────────────────────────────────────────────────────────
function queued() {
  const jobs = [];
  for (const angle of fs.readdirSync(OUT)) {
    const dir = path.join(OUT, angle);
    if (!fs.statSync(dir).isDirectory() || angle === "_parked") continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".prompt.txt")) continue;
      const base = f.replace(/\.prompt\.txt$/, "");
      const id = `${angle}/${base}`;
      if (only && id !== only) continue;
      jobs.push({ id, dir, base, promptPath: path.join(dir, f), jsonPath: path.join(dir, `${base}.json`) });
    }
  }
  return jobs;
}

(async () => {
  const jobs = queued();
  console.log(`render: model=${MODEL} | ${jobs.length} job(s)${only ? ` (filtered: ${only})` : ""}`);
  let ok = 0, skip = 0, err = 0;
  for (const job of jobs) {
    const rec = fs.existsSync(job.jsonPath) ? JSON.parse(fs.readFileSync(job.jsonPath, "utf8")) : {};
    if (rec.render_status === "RENDERED" && !useFinal && !only) { skip++; continue; }
    const prompt = fs.readFileSync(job.promptPath, "utf8");
    try {
      const png = await renderOne(prompt);
      fs.writeFileSync(path.join(job.dir, `${job.base}.png`), png);
      rec.render_status = "RENDERED";
      rec.rendered_with = MODEL;
      if (rec.qa) rec.qa.image_layer_verdict = "PENDING_SCREENSHOT_QA";
      fs.writeFileSync(job.jsonPath, JSON.stringify(rec, null, 2));
      console.log(`  ✓ ${job.id} → ${job.base}.png`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${job.id}: ${e.message}`);
      err++;
    }
  }
  console.log(`done: ${ok} rendered, ${skip} already-rendered, ${err} failed.`);
  console.log("Next: screenshot QA pass (Haiku) → human approval gate. Engine does not publish. (D-04)");
})();
