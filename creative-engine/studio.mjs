#!/usr/bin/env node
/**
 * Revarity Ads — STUDIO HOME mockup (the post-login dashboard draft).
 * A studio-grade creative-ops command center, brand-locked, modeled on the categories the
 * top tools own: Foreplay (swipe/briefs/discovery), Motion (perf analytics), AdCreative.ai
 * (generation) — unified. Static mockup using real finished ads as the gallery.
 *
 *   node creative-engine/studio.mjs   →   output/studio-home.html
 * Mockup only — proposes, never publishes/spends (D-04).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "brand-kit/brand.json"), "utf8"));
const angles = JSON.parse(fs.readFileSync(path.join(ROOT, "creative-engine/ad-angles.json"), "utf8"));
const p = brand.palette;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// collect up to 8 finished ads for the gallery (prefer ink .ad.png, allow .ad-light.png)
function gallery() {
  const cards = [];
  if (!fs.existsSync(OUT)) return cards;
  for (const angle of fs.readdirSync(OUT).sort()) {
    const dir = path.join(OUT, angle);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const base = f.replace(/\.json$/, "");
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const adInk = path.join(dir, `${base}.ad.png`), adLight = path.join(dir, `${base}.ad-light.png`);
      const png = fs.existsSync(adInk) ? adInk : fs.existsSync(adLight) ? adLight : null;
      if (!png) continue;
      cards.push({
        rec, backdrop: png.endsWith("-light.png") ? "light" : "ink",
        img: `data:image/png;base64,${fs.readFileSync(png).toString("base64")}`,
      });
      if (cards.length >= 8) return cards;
    }
  }
  return cards;
}

const g = readSafe();
function readSafe() { try { return gallery(); } catch { return []; } }
const total = g.length;
const approved = 0; // mockup: nothing approved yet
const STAT = { queue: total, awaiting: total, approved, budget: angles.campaign_budget_monthly_usd, cpl: angles.kpi_targets.cpl_usd_max };

const navItems = [
  ["Studio", true], ["Create", false], ["Swipe file", false], ["Review queue", false],
  ["Budget", false], ["Monitor", false], ["Settings", false],
];
const chip = (s) => `<span class="chip ${s.cls}">${s.label}</span>`;
const galleryHtml = g.map((c) => {
  const q = c.rec.qa?.image_layer_verdict || c.rec.qa || "—";
  const status = q === "pass" ? { cls: "ok", label: "QA pass" } : { cls: "warn", label: String(q) };
  return `<figure class="g-card">
    <div class="g-frame"><img src="${c.img}" alt=""/><div class="g-badges">${chip(status)}<span class="chip neutral">${esc(c.backdrop)}</span></div></div>
    <figcaption><div class="g-h">${esc((c.rec.headline || "").slice(0, 46))}</div>
    <div class="g-meta">${esc(c.rec.angle_id || c.rec.archetype || "")} · ${esc(c.rec.spec || "story")}</div></figcaption>
  </figure>`;
}).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Revarity Ads · Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${brand.typography.google_fonts_import}" rel="stylesheet">
<style>
:root{--ink:${p.ink};--ink2:${p.ink_soft};--cream:${p.cream};--paper:${p.paper};--gold:${p.gold};--goldb:${p.gold_bright};--muted:${p.muted};--muted2:${p.muted_dark};--line:${p.line};--lined:${p.line_dark};--green:${p.green};--red:${p.red};--amber:${p.amber}}
*{box-sizing:border-box;margin:0}body{background:var(--ink);color:var(--cream);font-family:'Manrope',sans-serif;letter-spacing:-.005em}
.app{display:grid;grid-template-columns:248px 1fr;min-height:100vh}
/* sidebar */
.side{background:var(--ink2);border-right:1px solid var(--lined);padding:24px 16px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
.logo{font-family:'Fraunces',serif;font-size:23px;font-weight:500}.logo em{font-style:italic;font-weight:300;color:var(--gold)}
.logo-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin:3px 0 28px}
.nav{display:flex;flex-direction:column;gap:2px}
.nav a{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:4px;font-size:14px;color:rgba(245,241,232,.7);cursor:pointer}
.nav a:hover{background:rgba(201,169,97,.06);color:var(--cream)}
.nav a.on{background:rgba(201,169,97,.13);color:var(--cream);box-shadow:inset 2px 0 0 var(--gold)}
.nav .d{width:6px;height:6px;border-radius:50%;background:var(--muted)}.nav a.on .d{background:var(--goldb)}
.user{margin-top:auto;display:flex;align-items:center;gap:10px;padding-top:18px;border-top:1px solid var(--lined)}
.av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--goldb));color:var(--ink);display:grid;place-items:center;font-weight:700;font-size:14px}
.user .nm{font-size:13px}.user .rl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
/* main */
.main{padding:0 0 60px}
.top{display:flex;align-items:center;gap:16px;padding:20px 36px;border-bottom:1px solid var(--lined);position:sticky;top:0;background:rgba(10,10,11,.86);backdrop-filter:blur(8px);z-index:5}
.search{flex:1;max-width:420px;background:rgba(245,241,232,.05);border:1px solid var(--line);border-radius:999px;padding:10px 16px;color:var(--muted);font-size:13px;font-family:'JetBrains Mono',monospace}
.ws{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);border:1px solid var(--lined);padding:8px 12px;border-radius:4px}
.btn{cursor:pointer;border:none;font-family:'Manrope';font-weight:600;font-size:13px;padding:11px 18px;border-radius:4px}
.btn.gold{background:var(--gold);color:var(--ink)}.btn.gold:hover{background:var(--goldb)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--cream)}
.wrap{padding:30px 36px;max-width:1280px}
.hello{font-family:'Fraunces',serif;font-size:30px;font-weight:400;margin-bottom:3px}.hello em{font-style:italic;color:var(--gold)}
.hello-sub{color:var(--muted);font-size:13.5px;margin-bottom:24px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}
.stat{background:var(--ink2);border:1px solid var(--lined);border-radius:6px;padding:16px 18px}
.stat .k{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}
.stat .v{font-family:'Fraunces',serif;font-size:30px;line-height:1}.stat .v small{font-size:14px;color:var(--muted)}
.stat .v.gold{color:var(--gold)}
.gate{font-size:11.5px;color:var(--muted);border:1px solid var(--lined);border-left:3px solid var(--gold);border-radius:3px;padding:10px 14px;margin:6px 0 26px;background:rgba(201,169,97,.04)}
.qa-row{display:flex;gap:12px;margin-bottom:30px;flex-wrap:wrap}
.qa{flex:1;min-width:200px;background:linear-gradient(160deg,rgba(201,169,97,.10),rgba(201,169,97,.02));border:1px solid var(--line);border-radius:6px;padding:18px;cursor:pointer}
.qa .t{font-family:'Fraunces',serif;font-size:18px;margin-bottom:4px}.qa .s{font-size:12px;color:var(--muted)}
.sec{display:flex;align-items:center;justify-content:space-between;margin:28px 0 14px}
.sec h2{font-family:'Fraunces',serif;font-size:21px;font-weight:400}
.sec .link{font-size:12px;color:var(--gold);cursor:pointer}
.pipe{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:8px}
.pl{background:var(--ink2);border:1px solid var(--lined);border-radius:6px;padding:14px 16px}
.pl .n{font-family:'Fraunces',serif;font-size:26px}.pl .l{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.pl.live{border-color:var(--line);box-shadow:inset 0 0 0 1px rgba(201,169,97,.12)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px}
.g-card{background:var(--ink2);border:1px solid var(--lined);border-radius:8px;overflow:hidden;transition:.15s;cursor:pointer}
.g-card:hover{border-color:var(--line);transform:translateY(-2px)}
.g-frame{position:relative;aspect-ratio:9/16;background:#000}.g-frame img{width:100%;height:100%;object-fit:cover}
.g-badges{position:absolute;top:8px;left:8px;display:flex;gap:5px;flex-wrap:wrap}
.chip{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:3px}
.chip.ok{background:var(--green);color:#0a0a0b}.chip.warn{background:var(--amber);color:#0a0a0b}.chip.neutral{background:rgba(245,241,232,.14);color:var(--cream)}
.g-card figcaption{padding:11px 13px}.g-h{font-size:12.5px;line-height:1.3;margin-bottom:5px}
.g-meta{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.foot{padding:24px 36px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2)}
</style></head><body>
<div class="app">
  <aside class="side">
    <div class="logo">Revarity <em>Ads</em></div><div class="logo-sub">ads.revarity.com · studio</div>
    <nav class="nav">${navItems.map(([n, on]) => `<a class="${on ? "on" : ""}"><span class="d"></span>${n}</a>`).join("")}</nav>
    <div class="user"><div class="av">M</div><div><div class="nm">Malcolm</div><div class="rl">CEO · approver</div></div></div>
  </aside>
  <main class="main">
    <div class="top">
      <div class="search">Search creatives, angles, runs…</div>
      <div class="ws">Brand · Revarity</div>
      <button class="btn ghost">Mine winners</button>
      <button class="btn gold">+ New run</button>
    </div>
    <div class="wrap">
      <div class="hello">Welcome back, <em>Malcolm</em></div>
      <div class="hello-sub">Here's what the engine has staged for your approval.</div>
      <div class="stats">
        <div class="stat"><div class="k">In review queue</div><div class="v">${STAT.queue}</div></div>
        <div class="stat"><div class="k">Awaiting approval</div><div class="v gold">${STAT.awaiting}</div></div>
        <div class="stat"><div class="k">Approved → ready</div><div class="v">${STAT.approved}</div></div>
        <div class="stat"><div class="k">Monthly plan</div><div class="v">$${(STAT.budget || 0).toLocaleString()}<small> · CPL ≤ $${STAT.cpl}</small></div></div>
      </div>
      <div class="gate">Human gate (D-04): the studio proposes — it never publishes to Meta or spends. Approving marks a set ready; a human pushes it live.</div>
      <div class="qa-row">
        <div class="qa"><div class="t">Generate creatives</div><div class="s">Run the engine across angles → finished ads</div></div>
        <div class="qa"><div class="t">Mine winning ads</div><div class="s">Swipe-file → patterns feed the next batch</div></div>
        <div class="qa"><div class="t">Review &amp; approve</div><div class="s">${STAT.awaiting} creatives waiting on you</div></div>
      </div>
      <div class="sec"><h2>Pipeline</h2></div>
      <div class="pipe">
        <div class="pl"><div class="n">${STAT.queue}</div><div class="l">Generated</div></div>
        <div class="pl"><div class="n">${STAT.queue}</div><div class="l">QA passed</div></div>
        <div class="pl"><div class="n">${STAT.approved}</div><div class="l">Approved</div></div>
        <div class="pl live"><div class="n">—</div><div class="l">Live (human-launched)</div></div>
      </div>
      <div class="sec"><h2>Recent creatives</h2><span class="link">Open review queue →</span></div>
      <div class="grid">${galleryHtml || '<div class="g-meta">No creatives yet — hit “New run”.</div>'}</div>
      <div class="sec"><h2>Top performers <span style="font-size:11px;color:var(--amber);border:1px solid var(--amber);padding:2px 8px;border-radius:3px;vertical-align:middle">Phase 2</span></h2></div>
      <div class="gate">Live CPL / CPC / CPA per creative activates once spend is live + the Meta Ads MCP (read-only) is wired. The loop proposes winners; a human scales them.</div>
    </div>
    <div class="foot">Revarity Ads Studio · mockup · brand.json v${brand.version} · proposes, never publishes (D-04)</div>
  </main>
</div></body></html>`;

fs.writeFileSync(path.join(OUT, "studio-home.html"), html);
console.log(`studio home mockup → creative-engine/output/studio-home.html (${total} creatives in gallery)`);
