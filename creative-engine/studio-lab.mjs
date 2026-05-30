#!/usr/bin/env node
/**
 * Revarity Studio "Lab" — redesigned dashboard mockup. New aurora/midnight palette (no gold-black),
 * cinematic looping hero (the property journey), animated/glassy effects, plain-English labels.
 * Internal-tool look per COO direction; ad creative stays on the brand kit.
 *   node creative-engine/studio-lab.mjs   →   output/studio-lab.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output");
const CIN = path.join(OUT, "cinematic");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const uri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;

// journey scenes (order = the camera loop). Each scene has a still; if a matching .mp4 exists
// (made by video.mjs via Higgsfield image→video) the hero plays real motion instead of a still.
const sceneNames = ["01-bedroom-city", "02-over-city", "03-sky", "04-tulum-aerial", "05-villa-door", "06-ski-resort", "07-cottage-fire", "08-highrise-night"];
const scenes = sceneNames
  .map((n) => ({ name: n, png: path.join(CIN, `${n}.png`), mp4: path.join(CIN, `${n}.mp4`) }))
  .filter((s) => fs.existsSync(s.png));
const videoMode = scenes.length > 0 && scenes.every((s) => fs.existsSync(s.mp4));
const N = scenes.length, DUR = N * 5; // ~5s per scene (still-mode CSS timer)

// a few finished ads for the gallery
function ads() {
  const out = [];
  const dir = path.join(OUT, "CONCEPTS");
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) {
    if (f.endsWith(".ad.png")) { out.push(uri(path.join(dir, f))); if (out.length >= 6) break; }
  }
  return out;
}
const gallery = ads();

const sceneLayers = videoMode
  ? scenes.map((s, i) =>
      `<video class="scene${i === 0 ? " on" : ""}" muted playsinline preload="auto" poster="${uri(s.png)}"><source src="cinematic/${s.name}.mp4" type="video/mp4"></video>`).join("")
  : scenes.map((s, i) =>
      `<div class="scene" style="background-image:url('${uri(s.png)}');animation-delay:${(-DUR + i * 5).toFixed(2)}s"></div>`).join("");
const galleryCards = gallery.map((g) => `<div class="g"><img src="${g}" alt=""/></div>`).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Revarity Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#070b14;--bg2:#0b1120;--glass:rgba(255,255,255,.05);--line:rgba(255,255,255,.10);
--violet:#7c5cff;--indigo:#5b8def;--cyan:#22d3ee;--coral:#ff6a9c;--mint:#36e0b0;
--txt:#eaf0ff;--mut:#94a3c4}
*{margin:0;box-sizing:border-box}html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--txt);font-family:'Manrope',sans-serif;overflow-x:hidden}
@keyframes cycle{0%{opacity:0;transform:scale(1.06)}3%{opacity:1}13%{opacity:1}16%{opacity:0}100%{opacity:0;transform:scale(1.16)}}
@keyframes floaty{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}}
@keyframes rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
/* animated aurora background */
.aurora{position:fixed;inset:-20%;z-index:0;filter:blur(80px);opacity:.55;pointer-events:none}
.aurora b{position:absolute;border-radius:50%;animation:floaty 18s ease-in-out infinite}
.aurora .b1{width:46vw;height:46vw;left:-6vw;top:-8vw;background:radial-gradient(circle,var(--violet),transparent 60%)}
.aurora .b2{width:40vw;height:40vw;right:-6vw;top:6vw;background:radial-gradient(circle,var(--cyan),transparent 60%);animation-duration:22s}
.aurora .b3{width:38vw;height:38vw;left:30vw;bottom:-12vw;background:radial-gradient(circle,var(--coral),transparent 60%);animation-duration:26s}
.wrap{position:relative;z-index:1}
/* nav */
nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:20px;padding:16px 32px;
background:rgba(7,11,20,.55);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.logo{font-family:'Sora';font-weight:800;font-size:20px;letter-spacing:-.5px}
.logo span{background:linear-gradient(90deg,var(--violet),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
.navlinks{display:flex;gap:6px;margin-left:18px}
.navlinks a{color:var(--mut);text-decoration:none;font-size:14px;padding:8px 14px;border-radius:10px;transition:.2s}
.navlinks a:hover,.navlinks a.on{color:var(--txt);background:var(--glass)}
.spacer{flex:1}
.avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--coral));display:grid;place-items:center;font-weight:700}
/* hero */
.hero{position:relative;height:62vh;min-height:460px;overflow:hidden;display:flex;align-items:flex-end}
.scene{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;
animation:cycle ${DUR}s linear infinite;will-change:opacity,transform}
/* video mode: JS sequences the clips; crossfade on opacity, no CSS Ken-Burns (the clip carries the motion) */
.hero.video .scene{animation:none;object-fit:cover;width:100%;height:100%;opacity:0;transform:scale(1.04);transition:opacity 1.15s ease}
.hero.video .scene.on{opacity:1}
.hero-grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,11,20,.25) 0%,rgba(7,11,20,.1) 40%,rgba(7,11,20,.92) 100%)}
.hero-in{position:relative;z-index:2;padding:0 40px 46px;max-width:900px;animation:rise .9s ease both}
.kicker{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--txt);background:var(--glass);
border:1px solid var(--line);padding:7px 14px;border-radius:999px;margin-bottom:18px}
.kicker .dot{width:7px;height:7px;border-radius:50%;background:var(--mint);animation:pulse 2s infinite}
h1{font-family:'Sora';font-weight:800;font-size:clamp(38px,5vw,68px);line-height:1.02;letter-spacing:-1.5px}
h1 .g{background:linear-gradient(90deg,var(--cyan),var(--violet),var(--coral));background-size:200% auto;
-webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 6s linear infinite}
.sub{color:#cdd6ee;font-size:18px;margin:16px 0 26px;max-width:560px;line-height:1.5}
.row{display:flex;gap:14px;flex-wrap:wrap}
.btn{font-family:'Manrope';font-weight:700;font-size:16px;padding:15px 26px;border-radius:14px;border:none;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:9px;transition:.2s}
.btn.primary{color:#0a0e1a;background:linear-gradient(90deg,var(--cyan),var(--violet));background-size:200% auto;box-shadow:0 8px 30px rgba(124,92,255,.4)}
.btn.primary:hover{background-position:100% 0;transform:translateY(-2px)}
.btn.glass{color:var(--txt);background:var(--glass);border:1px solid var(--line)}
.btn.glass:hover{border-color:var(--violet);transform:translateY(-2px)}
/* content */
.main{padding:34px 40px 70px;max-width:1240px;margin:0 auto}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:14px}
.card{background:var(--glass);border:1px solid var(--line);border-radius:18px;padding:20px;backdrop-filter:blur(10px);animation:rise .7s ease both}
.card .k{font-size:13px;color:var(--mut);margin-bottom:10px}
.card .v{font-family:'Sora';font-weight:700;font-size:34px;line-height:1}
.card .v.c1{color:var(--cyan)}.card .v.c2{color:var(--coral)}.card .v.c3{color:var(--mint)}
.card .s{font-size:12.5px;color:var(--mut);margin-top:8px}
.note{background:linear-gradient(90deg,rgba(124,92,255,.12),rgba(34,211,238,.06));border:1px solid var(--line);
border-radius:14px;padding:14px 18px;font-size:13.5px;color:#cdd6ee;margin:8px 0 30px}
.h2{font-family:'Sora';font-weight:700;font-size:24px;margin:30px 0 16px;display:flex;align-items:center;justify-content:space-between}
.h2 .a{font-size:14px;color:var(--cyan);text-decoration:none;font-family:'Manrope';font-weight:600}
.acts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.act{position:relative;overflow:hidden;border-radius:18px;padding:26px;text-decoration:none;color:var(--txt);border:1px solid var(--line);transition:.25s;min-height:140px;display:flex;flex-direction:column;justify-content:flex-end}
.act:hover{transform:translateY(-4px)}
.act.a1{background:linear-gradient(140deg,rgba(124,92,255,.35),rgba(124,92,255,.05))}
.act.a2{background:linear-gradient(140deg,rgba(255,106,156,.32),rgba(255,106,156,.05))}
.act.a3{background:linear-gradient(140deg,rgba(54,224,176,.30),rgba(54,224,176,.05))}
.act .t{font-family:'Sora';font-weight:700;font-size:21px;margin-bottom:5px}.act .d{font-size:13.5px;color:#cdd6ee}
.act .arrow{position:absolute;top:22px;right:24px;font-size:22px;opacity:.7;transition:.25s}.act:hover .arrow{transform:translate(4px,-4px);opacity:1}
.flow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:var(--glass);border:1px solid var(--line);border-radius:18px;padding:20px;backdrop-filter:blur(10px)}
.step{flex:1;min-width:120px;text-align:center}.step .n{font-family:'Sora';font-weight:700;font-size:28px}
.step .l{font-size:12px;color:var(--mut);margin-top:4px}
.sep{color:var(--mut);font-size:22px;opacity:.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}
.g{border-radius:14px;overflow:hidden;border:1px solid var(--line);aspect-ratio:9/16;transition:.25s;background:#000}
.g:hover{transform:translateY(-4px) scale(1.02);border-color:var(--violet)}
.g img{width:100%;height:100%;object-fit:cover}
.foot{padding:26px 40px;color:var(--mut);font-size:12px;text-align:center}
</style></head>
<body>
<div class="aurora"><b class="b1"></b><b class="b2"></b><b class="b3"></b></div>
<div class="wrap">
  <nav>
    <div class="logo">Revarity <span>Studio</span></div>
    <div class="navlinks"><a class="on">Home</a><a>Make ads</a><a>Review</a><a>Budget</a><a>What's working</a></div>
    <div class="spacer"></div>
    <a class="btn glass" style="padding:10px 16px;font-size:14px">+ New batch</a>
    <div class="avatar">M</div>
  </nav>

  <header class="hero${videoMode ? " video" : ""}">
    ${sceneLayers}
    <div class="hero-grad"></div>
    <div class="hero-in">
      <div class="kicker"><span class="dot"></span> Your creative studio</div>
      <h1>Turn rooms into <span class="g">income</span>.</h1>
      <p class="sub">Make beautiful ads in minutes, see what's working, and approve before a dollar is spent. You're always in control.</p>
      <div class="row"><a class="btn primary" href="#">Make new ads →</a><a class="btn glass" href="#">See what's waiting</a></div>
    </div>
  </header>

  <main class="main">
    <div class="stats">
      <div class="card"><div class="k">Your ads</div><div class="v">${gallery.length ? "28" : "0"}</div><div class="s">made and ready to look at</div></div>
      <div class="card" style="animation-delay:.06s"><div class="k">Waiting for your OK</div><div class="v c2">28</div><div class="s">a quick yes / no</div></div>
      <div class="card" style="animation-delay:.12s"><div class="k">Ready to launch</div><div class="v c3">0</div><div class="s">approved by you</div></div>
      <div class="card" style="animation-delay:.18s"><div class="k">This month</div><div class="v c1">$7,000</div><div class="s">your plan · $375/mo offer</div></div>
    </div>
    <div class="note">You're the boss: the studio makes and checks the ads, but <b>nothing goes live until you say so</b>. No surprise spending.</div>

    <div class="acts">
      <a class="act a1" href="#"><span class="arrow">↗</span><div class="t">Make new ads</div><div class="d">Pick an idea, get finished ads back in minutes.</div></a>
      <a class="act a2" href="#"><span class="arrow">↗</span><div class="t">Review &amp; approve</div><div class="d">28 ads waiting for a thumbs up.</div></a>
      <a class="act a3" href="#"><span class="arrow">↗</span><div class="t">Plan the budget</div><div class="d">Decide what to test and what to scale.</div></a>
    </div>

    <div class="h2">From idea to live</div>
    <div class="flow">
      <div class="step"><div class="n">28</div><div class="l">Made</div></div><span class="sep">→</span>
      <div class="step"><div class="n">28</div><div class="l">Checked</div></div><span class="sep">→</span>
      <div class="step"><div class="n">0</div><div class="l">You approved</div></div><span class="sep">→</span>
      <div class="step"><div class="n">—</div><div class="l">Live</div></div>
    </div>

    <div class="h2">Your latest ads <a class="a" href="#">See all →</a></div>
    <div class="grid">${galleryCards || '<div class="card">No ads yet — hit "Make new ads".</div>'}</div>

    <div class="h2">What's working <span style="font-size:12px;color:var(--mut);font-family:Manrope;font-weight:600;background:var(--glass);border:1px solid var(--line);padding:4px 10px;border-radius:999px">soon</span></div>
    <div class="note">Once your ads are live, this shows which ones get the cheapest leads — so you can put more behind the winners. (Turns on after launch.)</div>
  </main>
  <div class="foot">Revarity Studio · concept · the studio proposes, you approve before any spend</div>
</div>
<script>
/* Hero video sequencer: play one clip at a time, crossfade to the next on 'ended', loop forever.
   Keeps at most ~2 decoders active (vs 8 autoplaying) and syncs to the real clip length. */
(function(){
  var vids=[].slice.call(document.querySelectorAll('.hero.video .scene'));
  if(!vids.length) return;
  var i=0, timer=null;
  function show(n){
    for(var k=0;k<vids.length;k++) vids[k].classList.toggle('on', k===n);
    var v=vids[n];
    try{ v.currentTime=0; }catch(e){}
    var p=v.play(); if(p&&p.catch) p.catch(function(){});
    clearTimeout(timer); timer=setTimeout(advance, 9000); /* fallback if 'ended' never fires */
  }
  function advance(){ i=(i+1)%vids.length; show(i); }
  for(var k=0;k<vids.length;k++) vids[k].addEventListener('ended', advance);
  show(0);
})();
</script>
</body></html>`;

fs.writeFileSync(path.join(OUT, "studio-lab.html"), html);
console.log(`studio-lab → output/studio-lab.html (${scenes.length} cinematic scenes, ${gallery.length} ads)`);
