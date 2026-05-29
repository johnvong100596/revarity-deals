#!/usr/bin/env node
/**
 * Revarity — ads.revarity.com operator hub (PROTOTYPE).
 * Single self-contained dashboard for Malcolm & David: Overview · Create · Review+Approve
 * · Budget · Monitor. Brand-locked, wired to the live Creative Engine output.
 *
 * PROTOTYPE SCOPE: read-only against the engine's file output + interactive approve/reject
 * with JSON export. It does NOT publish, spend, or persist server-side — those need the
 * backend (see the production notes printed at build time). D-04: the hub proposes; a human
 * disposes. D-01: no pricing shown. D-02: operator surface under *.revarity.com, not SaaS.
 *
 *   node creative-engine/dashboard.mjs   →   output/ads-dashboard.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "output");
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "brand-kit/brand.json"), "utf8"));
const anglesCfg = JSON.parse(fs.readFileSync(path.join(ROOT, "creative-engine/ad-angles.json"), "utf8"));
const p = brand.palette;

function queue() {
  const cards = [];
  if (!fs.existsSync(OUT)) return cards;
  for (const angle of fs.readdirSync(OUT).sort()) {
    const dir = path.join(OUT, angle);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || angle === "_parked") continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const png = path.join(dir, f.replace(/\.json$/, ".png"));
      const img = fs.existsSync(png) ? `data:image/png;base64,${fs.readFileSync(png).toString("base64")}` : "";
      cards.push({
        id: `${angle}/${f.replace(/\.json$/, "")}`, angle_id: rec.angle_id, variant: rec.variant,
        spec: rec.spec, dimensions: rec.dimensions, headline: rec.headline, body: rec.body, cta: rec.cta,
        pricing_flag: rec.pricing_flag || null, qa: rec.qa?.image_layer_verdict || "—", img,
        vertical: (rec.spec || "").includes("story") || (rec.spec || "").includes("vertical"),
      });
    }
  }
  return cards;
}

const DATA = {
  generatedAt: process.env.BUILD_STAMP || "",
  budgetMonthly: anglesCfg.campaign_budget_monthly_usd,
  kpi: anglesCfg.kpi_targets,
  angles: anglesCfg.angles.map((a) => ({ id: a.id, type: a.type, audience: a.audience, lead_magnet: a.lead_magnet || "", variants: (a.variants || []).length })),
  formats: Object.entries(brand.creative_specs).map(([k, v]) => ({ name: k, dims: `${v.w}x${v.h}`, use: v.use })),
  queue: queue(),
};
const passN = DATA.queue.filter((c) => c.qa === "pass").length;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ads.revarity.com · Operator Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${brand.typography.google_fonts_import}" rel="stylesheet">
<style>
:root{--ink:${p.ink};--ink-soft:${p.ink_soft};--cream:${p.cream};--cream-soft:${p.cream_soft};--paper:${p.paper};--gold:${p.gold};--gold-bright:${p.gold_bright};--gold-deep:${p.gold_deep};--muted:${p.muted};--muted-dark:${p.muted_dark};--line:${p.line};--line-dark:${p.line_dark};--green:${p.green};--red:${p.red};--amber:${p.amber}}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--cream);font-family:'Manrope',sans-serif;letter-spacing:-.005em}
a{color:inherit}
.shell{display:flex;min-height:100vh}
/* sidebar */
.side{width:228px;flex:0 0 228px;background:var(--ink-soft);border-right:1px solid var(--line-dark);padding:26px 18px;position:sticky;top:0;height:100vh}
.brand{font-family:'Fraunces',serif;font-size:22px;font-weight:500;margin:0 0 2px}
.brand em{font-style:italic;font-weight:300;color:var(--gold)}
.brand-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin-bottom:30px}
.nav{display:flex;flex-direction:column;gap:3px}
.nav button{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:3px;font-size:13.5px;color:rgba(245,241,232,.72);transition:.15s}
.nav button:hover{background:rgba(201,169,97,.06);color:var(--cream)}
.nav button.on{background:rgba(201,169,97,.12);color:var(--cream);box-shadow:inset 2px 0 0 var(--gold)}
.nav .dot{width:6px;height:6px;border-radius:50%;background:var(--muted)}
.nav button.on .dot{background:var(--gold-bright)}
.side-foot{position:absolute;bottom:22px;left:18px;right:18px;font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-dark);line-height:1.7}
/* main */
.main{flex:1;padding:34px 40px 70px;max-width:1180px}
.page{display:none}.page.on{display:block}
h1{font-family:'Fraunces',serif;font-weight:400;font-size:32px;margin:0 0 6px}
h1 em{font-style:italic;font-weight:300;color:var(--gold)}
.lead{color:rgba(245,241,232,.6);font-size:14px;margin:0 0 26px;max-width:680px;line-height:1.5}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-bright);margin-bottom:12px}
/* banners */
.gate{display:flex;gap:10px;align-items:flex-start;padding:12px 15px;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:2px;font-size:12.5px;color:rgba(245,241,232,.82);margin-bottom:24px;background:rgba(201,169,97,.04)}
.gate.warn{border-left-color:var(--amber)}
/* stat cards */
.grid{display:grid;gap:16px}
.cards4{grid-template-columns:repeat(4,1fr)}.cards3{grid-template-columns:repeat(3,1fr)}.cards2{grid-template-columns:repeat(2,1fr)}
.stat{background:var(--ink-soft);border:1px solid var(--line-dark);border-radius:4px;padding:18px 18px 16px}
.stat .k{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}
.stat .v{font-family:'Fraunces',serif;font-size:30px;line-height:1}
.stat .v small{font-size:14px;color:var(--muted)}
.stat .sub{font-size:11.5px;color:var(--muted);margin-top:7px}
.v.good{color:var(--gold)}
/* table */
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--line-dark)}
th{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:500}
/* review queue */
.q{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px;margin-top:8px}
.qc{background:var(--ink-soft);border:1px solid var(--line-dark);border-radius:5px;overflow:hidden;transition:.15s}
.qc.appr{box-shadow:0 0 0 2px var(--green)}.qc.rej{box-shadow:0 0 0 2px var(--red);opacity:.6}.qc.hold{box-shadow:0 0 0 2px var(--amber)}
.qframe{position:relative;background:#000}
.qframe img{display:block;width:100%;height:100%;object-fit:cover}
.qframe.sq img{aspect-ratio:1/1}.qframe.v img{aspect-ratio:9/16}
.qov{position:absolute;left:0;right:0;padding:18px;pointer-events:none}
.qov.top{top:0;background:linear-gradient(180deg,rgba(10,10,11,.55),transparent)}
.qov.bot{bottom:0;background:linear-gradient(0deg,rgba(10,10,11,.62),transparent)}
.qov .h{font-family:'Fraunces',serif;font-weight:500;font-size:19px;line-height:1.13;text-shadow:0 1px 16px rgba(0,0,0,.5)}
.qbadge{position:absolute;top:10px;right:10px;font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;padding:3px 7px;border-radius:2px;background:var(--green);color:#0a0a0b}
.qbody{padding:14px 16px}
.qmeta{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}
.tag{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line-dark);padding:2px 6px;border-radius:2px}
.tag.flag{color:var(--amber);border-color:var(--amber)}
.qtext{font-size:12.5px;line-height:1.5;color:rgba(245,241,232,.8);margin:0 0 13px}
.acts{display:flex;gap:7px}
.acts button{all:unset;cursor:pointer;flex:1;text-align:center;font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:8px 0;border-radius:2px;border:1px solid var(--line)}
.acts .ap:hover,.acts .ap.on{background:var(--green);color:#0a0a0b;border-color:var(--green)}
.acts .hd:hover,.acts .hd.on{background:var(--amber);color:#0a0a0b;border-color:var(--amber)}
.acts .rj:hover,.acts .rj.on{background:var(--red);color:#fff;border-color:var(--red)}
/* bar */
.bar{display:flex;align-items:center;justify-content:space-between;background:var(--ink-soft);border:1px solid var(--line);border-radius:4px;padding:14px 18px;margin:18px 0 24px;position:sticky;top:16px;z-index:5;backdrop-filter:blur(6px)}
.bar .tally{font-size:13px}.bar .tally b{color:var(--gold)}
.btn{all:unset;cursor:pointer;font-family:'Manrope';font-weight:600;font-size:13px;background:var(--gold);color:var(--ink);padding:10px 18px;border-radius:2px}
.btn:hover{background:var(--gold-bright)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--cream)}
.muted{color:var(--muted)}
.row{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px}
.fld{flex:1;min-width:180px}
label.l{display:block;font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
select,input{width:100%;background:rgba(245,241,232,.04);border:1px solid var(--line);color:var(--cream);font-family:'Manrope';font-size:14px;padding:11px 12px;border-radius:2px}
code{font-family:'JetBrains Mono',monospace;font-size:12px;background:rgba(245,241,232,.06);padding:2px 7px;border-radius:2px;color:var(--gold-bright)}
.cmd{display:block;background:#000;border:1px solid var(--line-dark);border-radius:3px;padding:14px 16px;margin-top:10px;font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--gold-bright);white-space:pre-wrap}
.ph{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);border:1px solid var(--amber);padding:3px 8px;border-radius:2px}
.sec-h{font-family:'Fraunces',serif;font-size:20px;margin:30px 0 12px}
</style></head><body>
<div class="shell">
  <aside class="side">
    <div class="brand">Revarity <em>Ads</em></div>
    <div class="brand-sub">ads.revarity.com · operator hub</div>
    <nav class="nav" id="nav">
      <button data-t="overview" class="on"><span class="dot"></span>Overview</button>
      <button data-t="create"><span class="dot"></span>Create</button>
      <button data-t="review"><span class="dot"></span>Review &amp; Approve</button>
      <button data-t="budget"><span class="dot"></span>Budget</button>
      <button data-t="monitor"><span class="dot"></span>Monitor</button>
    </nav>
    <div class="side-foot">Prototype · wired to live engine output · no publish, no spend (D-04) · for Malcolm &amp; David</div>
  </aside>
  <main class="main">

    <section class="page on" data-p="overview">
      <div class="eyebrow">— Operator Overview —</div>
      <h1>The funnel's <em>engine room</em></h1>
      <p class="lead">Everything the marketing engine produces flows through here: create a run, generate brand-locked creatives, approve before spend, set budget, and (Phase 2) monitor performance. The engine generates and QAs; the spend decision stays human.</p>
      <div class="gate warn"><span>⚑</span><span><b>Human gate (D-04).</b> This hub proposes — it never publishes to Meta or spends. Approving a set marks it ready; a human still pushes it live. Pricing stays out of all copy while D-01 is open.</span></div>
      <div class="grid cards4">
        <div class="stat"><div class="k">In review queue</div><div class="v">${DATA.queue.length}</div><div class="sub">creatives generated</div></div>
        <div class="stat"><div class="k">Passed auto-QA</div><div class="v good">${passN}<small> / ${DATA.queue.length}</small></div><div class="sub">brand + garble + banned-content screen</div></div>
        <div class="stat"><div class="k">Monthly budget plan</div><div class="v">$${(DATA.budgetMonthly || 0).toLocaleString()}</div><div class="sub">human-set · not yet committed</div></div>
        <div class="stat"><div class="k">Target CPL</div><div class="v">$${DATA.kpi.cpl_usd_max}<small> max</small></div><div class="sub">kill &gt; $${DATA.kpi.kill_creative_cpl_usd_over} · scale &lt; $${DATA.kpi.scale_creative_cpl_usd_under}</div></div>
      </div>
      <div class="sec-h">Angles configured</div>
      <table><thead><tr><th>Angle</th><th>Type</th><th>Audience</th><th>Lead magnet</th><th>Variants</th></tr></thead><tbody id="angleRows"></tbody></table>
    </section>

    <section class="page" data-p="create">
      <div class="eyebrow">— Create a run —</div>
      <h1>Spin up <em>creatives</em></h1>
      <p class="lead">Pick the angles, variant count, and formats. In production this triggers the pipeline on the server; in this prototype it shows you the exact command the engine runs.</p>
      <div class="row">
        <div class="fld"><label class="l">Angles</label><select id="cAngles" multiple size="5"></select></div>
        <div class="fld" style="max-width:160px"><label class="l">Variants / angle</label><input id="cVar" type="number" value="3" min="1" max="6"></div>
        <div class="fld"><label class="l">Formats</label><select id="cFmt" multiple size="5"></select></div>
        <div class="fld" style="max-width:160px"><label class="l">Mode</label><select id="cMode"><option>cold</option><option>content</option><option>refresh</option></select></div>
      </div>
      <button class="btn" data-act="buildcmd">Show generate command →</button>
      <code class="cmd" id="cmdOut">node creative-engine/pipeline.mjs --clean</code>
      <div class="gate"><span>ℹ</span><span>Production wiring: this button calls a backend job that runs <code>pipeline.mjs</code> (generate → render → QA → regen → review). Output lands in the Review queue automatically.</span></div>
    </section>

    <section class="page" data-p="review">
      <div class="eyebrow">— Review &amp; approve —</div>
      <h1>The approval <em>gate</em></h1>
      <p class="lead">Every creative, headline composited over the reserved zone, with its copy and auto-QA verdict. Approve / hold / reject. Approving marks a set ready to push — it does not spend (D-04).</p>
      <div class="bar">
        <div class="tally">Approved <b id="tAp">0</b> · Hold <b id="tHd">0</b> · Reject <b id="tRj">0</b> · <span class="muted">of ${DATA.queue.length}</span></div>
        <div style="display:flex;gap:9px"><button class="btn ghost" data-act="approveall">Approve all QA-pass</button><button class="btn" data-act="export">Export approved set ↓</button></div>
      </div>
      <div class="q" id="queue"></div>
    </section>

    <section class="page" data-p="budget">
      <div class="eyebrow">— Budget —</div>
      <h1>Plan the <em>spend</em></h1>
      <p class="lead">Set the monthly plan and split it across angles. The hub computes target leads from your CPL ceiling — it does not move money. Committing spend is a human action in Meta.</p>
      <div class="gate warn"><span>⚑</span><span><b>D-04.</b> These are planning numbers only. Nothing here launches or pauses an ad or moves budget.</span></div>
      <div class="row">
        <div class="fld" style="max-width:240px"><label class="l">Monthly budget (USD)</label><input id="bTotal" type="number" value="${DATA.budgetMonthly || 7000}"></div>
        <div class="fld" style="max-width:200px"><label class="l">Target CPL ceiling</label><input id="bCpl" type="number" value="${DATA.kpi.cpl_usd_max}"></div>
        <div class="fld" style="max-width:200px"><label class="l">Target cost / call</label><input id="bCall" type="number" value="${DATA.kpi.cost_per_call_usd_max}"></div>
      </div>
      <div class="grid cards3" id="bProj"></div>
      <div class="sec-h">Allocation by angle</div>
      <table><thead><tr><th>Angle</th><th>Share</th><th>Spend</th><th>Est. leads @ CPL</th></tr></thead><tbody id="allocRows"></tbody></table>
    </section>

    <section class="page" data-p="monitor">
      <div class="eyebrow">— Monitor —</div>
      <h1>Performance <em>loop</em> <span class="ph">Phase 2</span></h1>
      <p class="lead">Live CPL / CPC / CPA / CTR per creative, pulled read-only from Meta Ads Manager, scored against your targets. Winners feed <code>refresh</code> mode; losers are flagged for a human to pause. The loop proposes; the human disposes (D-04).</p>
      <div class="gate"><span>ℹ</span><span><b>Awaiting live data.</b> This panel activates after spend goes live and the Meta Ads MCP (read-only) is wired (PLAN Stream E). Targets below are from <code>ad-angles.json</code>.</span></div>
      <div class="grid cards4">
        <div class="stat"><div class="k">CPC target</div><div class="v">$${DATA.kpi.cpc_usd_max}<small> max</small></div><div class="sub muted">— awaiting data —</div></div>
        <div class="stat"><div class="k">CPL target</div><div class="v">$${DATA.kpi.cpl_usd_max}<small> max</small></div><div class="sub muted">— awaiting data —</div></div>
        <div class="stat"><div class="k">CPA target</div><div class="v">$${(DATA.kpi.cpa_usd_max).toLocaleString()}<small> max</small></div><div class="sub muted">— awaiting data —</div></div>
        <div class="stat"><div class="k">Calls booked / mo</div><div class="v">${DATA.kpi.calls_booked_monthly_min}<small> min</small></div><div class="sub muted">— awaiting data —</div></div>
      </div>
    </section>

  </main>
</div>
<script>
const DATA = ${JSON.stringify(DATA)};
const $ = (s)=>document.querySelector(s); const $$=(s)=>[...document.querySelectorAll(s)];
// nav (function; invoked from the single delegated listener below — no inline handlers)
function showTab(t){
  $$('#nav button').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
  $$('.page').forEach(pg=>pg.classList.toggle('on',pg.dataset.p===t));
}
// overview angles
$('#angleRows').innerHTML = DATA.angles.map(a=>\`<tr><td><code>\${a.id}</code></td><td>\${a.type}</td><td>\${a.audience||''}</td><td>\${a.lead_magnet||'—'}</td><td>\${a.variants}</td></tr>\`).join('');
// create selects
$('#cAngles').innerHTML = DATA.angles.map((a,i)=>\`<option \${i<2?'selected':''}>\${a.id}</option>\`).join('');
$('#cFmt').innerHTML = DATA.formats.map((f,i)=>\`<option \${i<2?'selected':''}>\${f.name}</option>\`).join('');
function buildCmd(){
  const ang=[...$('#cAngles').selectedOptions].map(o=>o.value);
  const fmt=[...$('#cFmt').selectedOptions].map(o=>o.value);
  $('#cmdOut').textContent='# edit RUN in engine.mjs → angles=['+ang.join(', ')+'] variants='+$('#cVar').value+' formats=['+fmt.join(', ')+'] mode='+$('#cMode').value+'\\nnode creative-engine/pipeline.mjs --clean';
}
// review queue
const state={};
function renderQueue(){
  $('#queue').innerHTML = DATA.queue.map(c=>{
    const st=state[c.id]||'';
    return \`<figure class="qc \${st==='approve'?'appr':st==='reject'?'rej':st==='hold'?'hold':''}" id="c-\${c.id.replace(/[^a-z0-9]/gi,'_')}">
      <div class="qframe \${c.vertical?'v':'sq'}"><img src="\${c.img}"/>
        <div class="qov \${c.vertical?'bot':'top'}"><div class="h">\${esc(c.headline)}</div></div>
        <span class="qbadge">QA \${c.qa}</span></div>
      <div class="qbody">
        <div class="qmeta"><span class="tag">\${c.angle_id}</span><span class="tag">VAR \${c.variant}</span><span class="tag">\${c.spec}</span>\${c.pricing_flag?'<span class="tag flag">'+c.pricing_flag+'</span>':''}</div>
        <p class="qtext">\${esc(c.body)} <b>· \${esc(c.cta)} →</b></p>
        <div class="acts"><button class="ap \${st==='approve'?'on':''}" data-act="set" data-id="\${encodeURIComponent(c.id)}" data-s="approve">Approve</button><button class="hd \${st==='hold'?'on':''}" data-act="set" data-id="\${encodeURIComponent(c.id)}" data-s="hold">Hold</button><button class="rj \${st==='reject'?'on':''}" data-act="set" data-id="\${encodeURIComponent(c.id)}" data-s="reject">Reject</button></div>
      </div></figure>\`;
  }).join('');
  tally();
}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function setSt(id,s){state[id]=state[id]===s?'':s;renderQueue();}
function approveAllPass(){DATA.queue.forEach(c=>{if(c.qa==='pass')state[c.id]='approve';});renderQueue();}
function tally(){const v=Object.values(state);$('#tAp').textContent=v.filter(x=>x==='approve').length;$('#tHd').textContent=v.filter(x=>x==='hold').length;$('#tRj').textContent=v.filter(x=>x==='reject').length;}
function exportApprovals(){
  const approved=DATA.queue.filter(c=>state[c.id]==='approve').map(c=>({id:c.id,angle:c.angle_id,variant:c.variant,spec:c.spec,headline:c.headline,cta:c.cta}));
  const blob=new Blob([JSON.stringify({approved_at_local:new Date().toString(),count:approved.length,note:'Approved for spend. Pushing live is a human action (D-04).',approved},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='approved-set.json';a.click();
}
// budget
function renderBudget(){
  const total=+$('#bTotal').value||0, cpl=+$('#bCpl').value||1, call=+$('#bCall').value||1;
  const leads=Math.floor(total/cpl), calls=Math.floor(total/call);
  $('#bProj').innerHTML=\`
    <div class="stat"><div class="k">Est. leads / mo</div><div class="v good">\${leads}</div><div class="sub">at $\${cpl} CPL</div></div>
    <div class="stat"><div class="k">Est. calls / mo</div><div class="v">\${calls}</div><div class="sub">at $\${call} / call · target ≥ \${DATA.kpi.calls_booked_monthly_min}</div></div>
    <div class="stat"><div class="k">Monthly plan</div><div class="v">$\${total.toLocaleString()}</div><div class="sub">not committed — planning only</div></div>\`;
  const per=DATA.angles.length?100/DATA.angles.length:0;
  $('#allocRows').innerHTML=DATA.angles.map(a=>{const spend=total*per/100;return \`<tr><td><code>\${a.id}</code></td><td>\${per.toFixed(0)}%</td><td>$\${Math.round(spend).toLocaleString()}</td><td>\${Math.floor(spend/cpl)}</td></tr>\`;}).join('');
}
// ONE delegated click listener — robust even if a viewer strips on* attributes
document.addEventListener('click',(e)=>{
  const nav=e.target.closest('#nav button'); if(nav){showTab(nav.dataset.t);return;}
  const b=e.target.closest('[data-act]'); if(!b)return;
  const a=b.dataset.act;
  if(a==='buildcmd')buildCmd();
  else if(a==='approveall')approveAllPass();
  else if(a==='export')exportApprovals();
  else if(a==='set')setSt(decodeURIComponent(b.dataset.id),b.dataset.s);
});
['#bTotal','#bCpl','#bCall'].forEach(s=>{const el=$(s);if(el)el.addEventListener('input',renderBudget);});
renderQueue();renderBudget();
</script>
</body></html>`;

const dest = path.join(OUT, "ads-dashboard.html");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(dest, html);
console.log(`ads.revarity.com prototype → creative-engine/output/ads-dashboard.html`);
console.log(`  queue: ${DATA.queue.length} creatives (${passN} QA-pass) · budget plan $${(DATA.budgetMonthly || 0).toLocaleString()}`);
console.log(`\nProduction notes (to make it the real hub):`);
console.log(`  • Backend to (a) trigger pipeline runs from Create, (b) persist approvals, (c) serve the queue.`);
console.log(`  • GHL pull for lead counts; Meta Ads MCP (read-only) for the Monitor panel (Phase 2 / Stream E,F).`);
console.log(`  • Auth for Malcolm/David. Publish/spend stays a human action outside this hub (D-04).`);
