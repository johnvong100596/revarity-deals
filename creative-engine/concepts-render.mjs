#!/usr/bin/env node
/**
 * Turn concepts.json (the army-of-content workflow output — pre-written, brand-safe copy)
 * into render-ready records + editorial image prompts under output/CONCEPTS/. The copy is
 * already vetted, so we skip copy-gen and go straight to image prompt → render → QA → compose.
 *
 *   node creative-engine/concepts-render.mjs            # clean output, stage all concepts (story)
 *   then: render.mjs → qa.mjs → compose.mjs → compose.mjs --photo
 *
 * Publishes nothing. (D-04)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "brand-kit/brand.json"), "utf8"));
const routing = JSON.parse(fs.readFileSync(path.join(ROOT, "creative-engine/model-routing.json"), "utf8"));
const concepts = JSON.parse(fs.readFileSync(path.join(__dirname, "concepts.json"), "utf8")).concepts || [];
const p = brand.palette;
const SPEC = "meta_story_vertical", W = 1080, H = 1920;

// editorial image prompt (same rules as engine.mjs) with SUBJECT = the concept's visual_direction
function imagePrompt(vd) {
  return [
    `High-end EDITORIAL PHOTOGRAPH used as an ad background for Revarity (done-for-you short-term-rental operator). vertical 9:16 story composition, ${W}x${H}px.`,
    ``,
    `AESTHETIC (critical): photoreal, magazine-quality editorial photography — Architectural Digest / Kinfolk / financial-broadsheet register. Cinematic, tactile, soft natural light, shallow depth of field.`,
    `HARD BAN: flat vector illustration, clipart, infographics, icons, charts, isometric, cartoon, 2000s/2010s flat design, generic SaaS illustration, gradient mesh, stock-photo gloss.`,
    ``,
    `ABSOLUTE RULE — NO TEXT, NO NUMBERS: zero letters, digits, currency symbols, labels, captions, brand names, or logos. PROPS unbranded/label-free (blank book covers, unmarked folders, plain candles); never a real hotel/brand name.`,
    ``,
    `COLOR GRADE toward the brand: warm filmic neutrals — cream/bone (${p.cream}) light, deep ink (${p.ink}) shadow, gold/brass (${p.gold}) as a sparing natural accent. NO purple, NO SaaS-blue, NO neon.`,
    `COMPOSITION: generous negative space; keep the lower third clean/empty (a headline overlays there in post). Push objects to the opposite side.`,
    ``,
    `SUBJECT: ${vd}`,
    ``,
    `BANNED (hard): no fabricated human faces or people presented as clients/founders/testimonials; no AI talking-head; no emoji; no third-party logos; and NO rendered text or numbers whatsoever.`,
  ].join("\n");
}

// clean prior output (keep .gitkeep)
for (const e of fs.readdirSync(OUT)) { if (e !== ".gitkeep") fs.rmSync(path.join(OUT, e), { recursive: true, force: true }); }
const dir = path.join(OUT, "CONCEPTS");
fs.mkdirSync(dir, { recursive: true });

let n = 0;
for (let i = 0; i < concepts.length; i++) {
  const c = concepts[i];
  const base = `c${String(i + 1).padStart(2, "0")}-${c.archetype || "concept"}`;
  const copy = `${c.headline} ${c.body} ${c.cta}`;
  const rec = {
    angle_id: "CONCEPTS", variant: `c${String(i + 1).padStart(2, "0")}`, archetype: c.archetype || null,
    spec: SPEC, dimensions: `${W}x${H}`,
    headline: c.headline, body: c.body, cta: c.cta, emphasis: c.emphasis || null,
    visual_direction: c.visual_direction, pricing_flag: copy.includes("[PENDING-D01]") ? "PENDING-D01" : null,
    render_status: "PENDING_RENDER",
    render_route: { task: "image_render", engine: routing.tasks.image_render.engine, draft_model: routing.tasks.image_render.model, final_model: routing.tasks.image_render.final_render_model, prompt_file: `${base}.prompt.txt` },
    qa: { image_layer_verdict: "PENDING_RENDER" },
  };
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(rec, null, 2));
  fs.writeFileSync(path.join(dir, `${base}.prompt.txt`), imagePrompt(c.visual_direction) + "\n");
  n++;
}
console.log(`staged ${n} concept creatives → output/CONCEPTS/ (story 9:16).`);
console.log("next: render.mjs → qa.mjs → compose.mjs → compose.mjs --photo");
