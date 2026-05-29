#!/usr/bin/env node
/**
 * Revarity Creative Engine — automated screenshot QA pass (SKILL step 3 / prompts.md template 3)
 * ----------------------------------------------------------------------------------------------
 * Runs a vision model over each rendered PNG and writes a verdict — the high-volume QA.
 * Catches: garbled/any rendered text, off-brand color, dated clipart/illustration look,
 * fabricated faces/logos, branded props, and missing headline space.
 *
 * The reviewer is whatever model-routing.json → tasks.qa_review specifies (default
 * claude-haiku-4-5). Provider is inferred from the model id:
 *   claude-*  → Anthropic Messages API (needs ANTHROPIC_API_KEY)
 *   gemini-*  → Google Gemini API       (needs GEMINI_API_KEY)
 * On verdict "uncertain", escalates to tasks.qa_review_deep (default claude-sonnet).
 * If a claude model is configured but ANTHROPIC_API_KEY is absent, it falls back to
 * gemini-2.5-flash (with a warning) so the pipeline never breaks.
 *
 *   pass      → record qa.image_layer_verdict = "pass" (stays in the queue)
 *   fail      → PNG + json moved to output/_parked/ with reasons (regen / human)
 *   uncertain → left in place, flagged for human
 *
 * Usage:  node creative-engine/qa.mjs [--only ANGLE/base]
 * Publishes nothing (D-04). Writes output/qa-<ts>.md.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");

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
const PRIMARY = routing.tasks.qa_review.model;                 // claude-haiku-4-5-...
const DEEP = routing.tasks.qa_review_deep?.model;              // claude-sonnet-4-6
const FALLBACK = "gemini-2.5-flash";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const provider = (m) => (m.startsWith("claude") ? "anthropic" : "gemini");

// resolve a configured model to one we can actually call, given available keys
function resolve(model) {
  if (provider(model) === "anthropic" && !ANTHROPIC_KEY) {
    return { model: FALLBACK, provider: "gemini", fellBack: model };
  }
  return { model, provider: provider(model), fellBack: null };
}

const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

function ts() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function qaPrompt(spec, headlineZone) {
  return [
    "You are the QA reviewer for Revarity ad creatives, screening a generated BACKGROUND VISUAL before it reaches a human approval queue. The headline/copy are overlaid later, so this image should contain NO text of its own.",
    "",
    "Check, in order:",
    "1. RENDERED TEXT — any letters, words, numbers, currency symbols, or logos drawn in the image, including on props (book covers, candles, folders)? There should be NONE. Any rendered text/number (especially garbled or a real brand name) = fail.",
    "2. BRAND COLOR — palette must be warm editorial neutrals: cream/bone light, deep ink shadow, gold/brass accents. Purple, neon, SaaS-blue, or garish over-saturation = fail.",
    "3. AESTHETIC — must read as premium editorial PHOTOGRAPHY (Architectural Digest / Kinfolk register). Flat vector illustration, clipart, infographic, icon, chart, isometric, cartoon, or dated 2000s/2010s flat design = fail.",
    "4. BANNED CONTENT — any fabricated human face presented as a client/founder/testimonial, any third-party logo, or emoji = fail.",
    `5. HEADLINE SPACE — for this ${spec} format, is there a clean, uncluttered ${headlineZone} where a headline can be legibly overlaid? Too busy there = fail.`,
    "",
    'Return ONLY a JSON object: {"verdict":"pass"|"fail"|"uncertain","reasons":["..."],"regenerate_hint":"short guidance if fail"}',
    "Do not pass anything with rendered text. When genuinely unsure between pass and fail on brand/aesthetic, return fail. Use uncertain only when the image is ambiguous or corrupt.",
  ].join("\n");
}

function coerce(txt) {
  let v;
  try { v = JSON.parse(txt); } catch {
    const m = txt && txt.match(/\{[\s\S]*\}/);
    try { v = JSON.parse(m ? m[0] : "{}"); } catch { v = null; }
  }
  if (!v) v = { verdict: "uncertain", reasons: ["QA model returned non-JSON"], regenerate_hint: "" };
  if (!["pass", "fail", "uncertain"].includes(v.verdict)) v.verdict = "uncertain";
  v.reasons = Array.isArray(v.reasons) ? v.reasons : v.reasons ? [String(v.reasons)] : [];
  return v;
}

async function callGemini(model, b64, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: b64 } }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return coerce(data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "{}");
}

async function callAnthropic(model, b64, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
          { type: "text", text: prompt + "\n\nRespond with ONLY the JSON object, no prose." },
        ] },
        { role: "assistant", content: "{" }, // prefill to force JSON
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const txt = "{" + (data?.content?.map((b) => b.text || "").join("") || "");
  return coerce(txt);
}

async function review(model, b64, prompt) {
  const r = resolve(model);
  const v = r.provider === "anthropic" ? await callAnthropic(r.model, b64, prompt) : await callGemini(r.model, b64, prompt);
  v._model = r.model + (r.fellBack ? ` (fallback for ${r.fellBack})` : "");
  return v;
}

function jobs() {
  const list = [];
  for (const angle of fs.readdirSync(OUT)) {
    const dir = path.join(OUT, angle);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".png")) continue;
      const base = f.replace(/\.png$/, "");
      const id = `${angle}/${base}`;
      if (only && id !== only) continue;
      list.push({ id, angle, dir, base, png: path.join(dir, f), json: path.join(dir, `${base}.json`) });
    }
  }
  return list;
}

(async () => {
  if (!GEMINI_KEY && !ANTHROPIC_KEY) { console.error("No QA key (need ANTHROPIC_API_KEY for Haiku or GEMINI_API_KEY)."); process.exit(2); }
  const resolved = resolve(PRIMARY);
  if (resolved.fellBack) console.warn(`! qa_review configured as ${resolved.fellBack} but ANTHROPIC_API_KEY missing — falling back to ${FALLBACK}. Add the key to run on Haiku.\n`);
  console.log(`QA: reviewer=${PRIMARY}${DEEP ? ` (escalates→${DEEP})` : ""} | running on ${resolved.model} | ${jobs().length} creative(s)`);

  const stamp = ts();
  const rows = [];
  let pass = 0, fail = 0, unc = 0;

  for (const j of jobs()) {
    const rec = fs.existsSync(j.json) ? JSON.parse(fs.readFileSync(j.json, "utf8")) : {};
    const spec = rec.spec || "meta_feed_square";
    const zone = spec.includes("story") || spec.includes("vertical") ? "lower third" : "upper area / one quadrant";
    const b64 = fs.readFileSync(j.png).toString("base64");
    const prompt = qaPrompt(spec, zone);

    let v;
    try {
      v = await review(PRIMARY, b64, prompt);
      if (v.verdict === "uncertain" && DEEP) { // SKILL escalation: uncertain → deeper reviewer
        const d = await review(DEEP, b64, prompt);
        d._escalated_from = v._model;
        v = d;
      }
    } catch (e) { v = { verdict: "uncertain", reasons: [e.message], _model: "error" }; }

    rec.qa = rec.qa || {};
    rec.qa.image_layer_verdict = v.verdict;
    rec.qa.image_layer_reasons = v.reasons || [];
    rec.qa.regenerate_hint = v.regenerate_hint || "";
    rec.qa.qa_model = v._model;
    if (v._escalated_from) rec.qa.escalated_from = v._escalated_from;

    if (v.verdict === "fail") {
      const parked = path.join(OUT, "_parked", j.angle);
      fs.mkdirSync(parked, { recursive: true });
      fs.renameSync(j.png, path.join(parked, `${j.base}.png`));
      const pp = path.join(j.dir, `${j.base}.prompt.txt`);
      if (fs.existsSync(pp)) fs.renameSync(pp, path.join(parked, `${j.base}.prompt.txt`));
      fs.writeFileSync(path.join(parked, `${j.base}.json`), JSON.stringify(rec, null, 2));
      fs.rmSync(j.json, { force: true });
      fail++;
    } else {
      fs.writeFileSync(j.json, JSON.stringify(rec, null, 2));
      v.verdict === "pass" ? pass++ : unc++;
    }
    rows.push({ id: j.id, verdict: v.verdict, model: v._model, reasons: (v.reasons || []).join("; ") });
    console.log(`  ${v.verdict === "pass" ? "✓" : v.verdict === "fail" ? "✗" : "?"} ${j.id} — ${v.verdict} [${v._model}]${v.reasons?.length ? " (" + v.reasons.join("; ") + ")" : ""}`);
  }

  const lines = [`# Automated screenshot QA — ${stamp}`, "",
    `Reviewer: ${PRIMARY}${DEEP ? ` (escalates → ${DEEP})` : ""}. ${rows.length} reviewed → **${pass} pass, ${fail} parked, ${unc} uncertain**.`, "",
    "| Creative | Verdict | Reviewer | Reasons |", "|---|---|---|---|",
    ...rows.map((r) => `| ${r.id} | ${r.verdict} | ${r.model} | ${(r.reasons || "—").replace(/\|/g, "\\|")} |`),
    "", "Parked → `output/_parked/` (re-roll with `regen.mjs`). Engine publishes nothing. (D-04)"];
  fs.writeFileSync(path.join(OUT, `qa-${stamp}.md`), lines.join("\n"));
  console.log(`\n${pass} pass / ${fail} parked / ${unc} uncertain → output/qa-${stamp}.md`);
})();
