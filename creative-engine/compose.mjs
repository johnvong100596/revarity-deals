#!/usr/bin/env node
/**
 * Revarity Creative Engine — finished-ad compositor.
 * Renders text-forward Story/Feed ads in the reference style (big Fraunces headline with a
 * gold-italic accent, short Manrope subcopy, a cream CTA pill) by compositing the copy CRISPLY
 * via headless Chrome — not letting the image model render text. Brand kit is law.
 *
 * Two backdrops:
 *   ink   (default) — ink canvas + soft radial gold glow (Perplexity / Wisprflow look)
 *   photo (--photo) — our editorial render as the background under a dark scrim (OpenAI look)
 *
 *   node creative-engine/compose.mjs               # all queued creatives → <base>.ad.png
 *   node creative-engine/compose.mjs --only AD1_DEAL_LIST/A-meta_story_vertical
 *   node creative-engine/compose.mjs --photo       # use the rendered photo as backdrop
 *
 * Output: <base>.ad.png next to each creative. Publishes nothing. (D-04)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "brand-kit/brand.json"), "utf8"));
const p = brand.palette;

const argv = process.argv.slice(2);
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
const PHOTO = argv.includes("--photo");

function chrome() {
  const cands = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return cands.find((c) => fs.existsSync(c));
}

// Gold-italic the chosen emphasis (if the record carries one), else a $-figure, else last word.
function emphasize(h, chosen) {
  const e = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  if (chosen) { const i = h.indexOf(chosen); if (i >= 0) return e(h.slice(0, i)) + `<em>${e(chosen)}</em>` + e(h.slice(i + chosen.length)); }
  const money = h.match(/\$[\d,]+(?:\s?[–-]\s?\$?[\d,]+)?(?:\s?\/\s?(?:mo|month))?/);
  if (money) return e(h).replace(e(money[0]), `<em>${e(money[0])}</em>`);
  const m = h.match(/^(.*\s)(\S+?)([.?!]?)$/);
  return m ? `${e(m[1])}<em>${e(m[2])}</em>${e(m[3])}` : e(h);
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const LINK_SVG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${p.gold_deep}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

function buildHtml(rec) {
  const vertical = (rec.spec || "").includes("story") || (rec.spec || "").includes("vertical");
  const W = 1080, H = vertical ? 1920 : 1080;
  const bg = PHOTO && rec._imgDataUri
    ? `background:#000 url('${rec._imgDataUri}') center/cover no-repeat;`
    : `background:radial-gradient(120% 80% at 22% 32%, rgba(201,169,97,0.20) 0%, transparent 55%), ${p.ink};`;
  const scrim = PHOTO ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.55),rgba(10,10,11,.78))"></div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="${brand.typography.google_fonts_import}" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  .ad{position:relative;width:${W}px;height:${H}px;${bg}color:${p.cream};
    font-family:'Manrope',sans-serif;padding:${vertical ? "150px 96px 130px" : "90px 90px"};
    display:flex;flex-direction:column;}
  .wm{font-family:'Fraunces',serif;font-size:34px;font-weight:500;color:${p.gold};letter-spacing:.5px;position:relative;z-index:2}
  .body-wrap{flex:1;display:flex;flex-direction:column;justify-content:${vertical ? "flex-start" : "center"};padding-top:${vertical ? "70px" : "0"};position:relative;z-index:2}
  h1{font-family:'Fraunces',serif;font-weight:500;font-size:${vertical ? "104px" : "78px"};line-height:1.02;
    letter-spacing:-.02em;color:${p.cream};max-width:14ch}
  h1 em{font-style:italic;font-weight:300;color:${p.gold}}
  .sub{font-size:34px;line-height:1.45;color:rgba(245,241,232,.72);margin-top:40px;max-width:24ch;font-weight:400}
  .cta-wrap{position:relative;z-index:2;display:flex;justify-content:center;margin-top:auto}
  .cta{display:inline-flex;align-items:center;gap:14px;background:${p.cream};color:${p.ink};
    font-weight:700;font-size:38px;padding:26px 44px;border-radius:999px;letter-spacing:-.01em}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-size:20px;letter-spacing:.34em;text-transform:uppercase;
    color:${p.gold_bright};margin-bottom:26px;position:relative;z-index:2;font-weight:500}
</style></head>
<body><div class="ad">${scrim}
  <div class="wm">Revarity</div>
  <div class="body-wrap">
    <div class="eyebrow">Done-for-you short-term rentals</div>
    <h1>${emphasize(rec.headline, rec.emphasis)}</h1>
    ${rec.body ? `<p class="sub">${esc(rec.body)}</p>` : ""}
  </div>
  <div class="cta-wrap"><div class="cta">${LINK_SVG}<span>${esc(rec.cta)}</span></div></div>
</div></body></html>`;
}

function jobs() {
  const list = [];
  for (const angle of fs.readdirSync(OUT).sort()) {
    const dir = path.join(OUT, angle);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const base = f.replace(/\.json$/, "");
      const id = `${angle}/${base}`;
      if (only && id !== only) continue;
      const png = path.join(dir, `${base}.png`);
      if (PHOTO && fs.existsSync(png)) rec._imgDataUri = `data:image/png;base64,${fs.readFileSync(png).toString("base64")}`;
      list.push({ id, dir, base, rec, vertical: (rec.spec || "").includes("story") || (rec.spec || "").includes("vertical") });
    }
  }
  return list;
}

(async () => {
  const exe = chrome();
  if (!exe) { console.error("No Chrome/Edge found. Install Chrome or set executablePath."); process.exit(2); }
  const list = jobs();
  console.log(`compose: ${list.length} ad(s) | backdrop=${PHOTO ? "photo" : "ink"} | chrome=${path.basename(exe)}`);
  const browser = await puppeteer.launch({ executablePath: exe, headless: "new", args: ["--no-sandbox"] });
  let ok = 0;
  for (const j of list) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: j.vertical ? 1920 : 1080, deviceScaleFactor: 1 });
    await page.setContent(buildHtml(j.rec), { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    const dest = path.join(j.dir, `${j.base}.ad${PHOTO ? "-photo" : ""}.png`);
    await page.screenshot({ path: dest, type: "png" });
    await page.close();
    console.log(`  ✓ ${j.id} → ${j.base}.ad.png`);
    ok++;
  }
  await browser.close();
  console.log(`\ncomposed ${ok} finished ads (<base>.ad.png). Headlines composited crisply — no AI text. (D-04: not published)`);
})();
