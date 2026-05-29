#!/usr/bin/env node
/**
 * Revarity Creative Engine — human-gate review sheet.
 * Builds output/review.html: every queued creative shown with its headline composited
 * over the reserved zone (brand fonts), the full copy, and the QA verdict — one page for
 * the David/Malcolm approval gate (SKILL step 4 / PLAN A.8). Publishes nothing. (D-04)
 *
 *   node creative-engine/contactsheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "brand-kit/brand.json"), "utf8"));
const p = brand.palette;

function collect() {
  const cards = [];
  for (const angle of fs.readdirSync(OUT).sort()) {
    const dir = path.join(OUT, angle);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const png = path.join(dir, f.replace(/\.json$/, ".png"));
      if (!fs.existsSync(png)) continue;
      // embed as a data URI so review.html is a single self-contained, shareable file
      const b64 = fs.readFileSync(png).toString("base64");
      cards.push({ ...rec, img: `data:image/png;base64,${b64}` });
    }
  }
  return cards;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function card(c) {
  const vertical = (c.spec || "").includes("story") || (c.spec || "").includes("vertical");
  const verdict = c.qa?.image_layer_verdict || "—";
  const badge = verdict === "pass" ? "ok" : verdict === "fail" ? "bad" : "warn";
  const pos = vertical ? "zone-bottom" : "zone-top";
  return `
  <figure class="card">
    <div class="frame ${vertical ? "v" : "sq"}">
      <img src="${esc(c.img)}" alt="${esc(c.angle_id)} ${esc(c.variant)}"/>
      <div class="overlay ${pos}">
        <div class="hl">${esc(c.headline)}</div>
        <span class="cta">${esc(c.cta)} →</span>
      </div>
    </div>
    <figcaption>
      <div class="meta">
        <span class="tag">${esc(c.angle_id)}</span>
        <span class="tag">VAR ${esc(c.variant)}</span>
        <span class="tag">${esc(c.spec)} · ${esc(c.dimensions)}</span>
        <span class="tag verdict ${badge}">QA ${esc(verdict)}</span>
        ${c.pricing_flag ? `<span class="tag flag">${esc(c.pricing_flag)}</span>` : ""}
      </div>
      <p class="body">${esc(c.body)}</p>
    </figcaption>
  </figure>`;
}

const cards = collect();
const passN = cards.filter((c) => c.qa?.image_layer_verdict === "pass").length;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Revarity — Creative Review Queue</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${brand.typography.google_fonts_import}" rel="stylesheet">
<style>
:root{--ink:${p.ink};--ink-soft:${p.ink_soft};--cream:${p.cream};--paper:${p.paper};--gold:${p.gold};--gold-bright:${p.gold_bright};--muted:${p.muted};--line:${p.line};--green:${p.green};--red:${p.red};--amber:${p.amber}}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--cream);font-family:'Manrope',sans-serif;letter-spacing:-0.005em;padding:48px 32px 80px}
header{max-width:1200px;margin:0 auto 36px}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:var(--gold-bright);margin-bottom:14px}
h1{font-family:'Fraunces',serif;font-weight:400;font-size:40px;line-height:1.05;margin:0 0 10px}
h1 em{font-style:italic;font-weight:300;color:var(--gold)}
.sub{color:rgba(245,241,232,0.65);font-size:15px;max-width:680px;line-height:1.5}
.gate{margin-top:18px;padding:12px 16px;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:2px;font-size:13px;color:rgba(245,241,232,0.8)}
.grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:28px}
.card{margin:0;background:var(--ink-soft);border:1px solid var(--line);border-radius:4px;overflow:hidden}
.frame{position:relative;background:#000}
.frame img{display:block;width:100%;height:100%;object-fit:cover}
.frame.sq{aspect-ratio:1/1}.frame.v{aspect-ratio:9/16}
.overlay{position:absolute;left:0;right:0;padding:22px 22px;pointer-events:none}
.zone-top{top:0;background:linear-gradient(180deg,rgba(10,10,11,0.55),transparent)}
.zone-bottom{bottom:0;background:linear-gradient(0deg,rgba(10,10,11,0.62),transparent)}
.hl{font-family:'Fraunces',serif;font-weight:500;font-size:22px;line-height:1.12;color:var(--cream);text-shadow:0 1px 18px rgba(0,0,0,0.5)}
.cta{display:inline-block;margin-top:10px;font-family:'Manrope',sans-serif;font-weight:600;font-size:12px;color:var(--ink);background:var(--gold);padding:7px 12px;border-radius:2px}
figcaption{padding:16px 18px 20px}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);padding:3px 7px;border-radius:2px}
.verdict.ok{color:#0a0a0b;background:var(--green);border-color:var(--green)}
.verdict.bad{color:#fff;background:var(--red);border-color:var(--red)}
.verdict.warn{color:#0a0a0b;background:var(--amber);border-color:var(--amber)}
.flag{color:var(--amber);border-color:var(--amber)}
.body{font-size:13.5px;line-height:1.55;color:rgba(245,241,232,0.82);margin:0}
footer{max-width:1200px;margin:40px auto 0;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase}
</style></head><body>
<header>
  <div class="eyebrow">— Creative Engine · Human Approval Gate —</div>
  <h1>Review <em>queue</em></h1>
  <p class="sub">Engine-generated, brand-locked, auto-QA'd ad creatives. Headlines shown composited over the reserved zone; copy below each. Approve before any spend — the engine does not publish.</p>
  <div class="gate">${cards.length} creatives · ${passN} passed automated QA · pricing-agnostic while D-01 open · no AI testimonials (D-03) · no auto-publish (D-04)</div>
</header>
<main class="grid">
${cards.map(card).join("\n")}
</main>
<footer>Revarity Marketing Engine · brand.json v${brand.version} · review.html generated from output/ · approval is a human money decision</footer>
</body></html>`;

const dest = path.join(OUT, "review.html");
fs.writeFileSync(dest, html);
console.log(`review sheet → creative-engine/output/review.html (${cards.length} creatives, ${passN} QA-pass)`);
