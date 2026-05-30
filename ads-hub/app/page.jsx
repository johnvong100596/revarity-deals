import Link from "next/link";
import { loadConfig } from "@/lib/config";
import { readQueue, readApprovals } from "@/lib/store";
import WeeklySummary from "@/app/components/WeeklySummary";

export const dynamic = "force-dynamic";

// Cinematic hero scenes (stills in /public/hero; video drops in later). Crossfade is pure CSS.
const SCENES = ["01-bedroom-city", "02-over-city", "03-sky", "04-tulum-aerial", "05-villa-door", "06-ski-resort", "07-cottage-fire", "08-highrise-night"];
const HERO_DUR = SCENES.length * 5;

export default async function Studio() {
  const cfg = await loadConfig();
  const [queue, approvals] = await Promise.all([readQueue(), readApprovals()]);
  const dec = approvals.decisions || {};
  const pass = queue.filter((c) => c.qa === "pass").length;
  const approved = Object.values(dec).filter((v) => v === "approve").length;
  const awaiting = queue.filter((c) => !dec[c.id]).length;
  const gallery = queue.slice(0, 12);
  const src = (c) => c.ad_url || c.image_url || `/api/image?id=${encodeURIComponent(c.id)}&v=ad`;

  return (
    <>
      <header className="hero" style={{ "--herodur": `${HERO_DUR}s` }}>
        {SCENES.map((n, i) => (
          <div key={n} className="scene" style={{ backgroundImage: `url(/hero/${n}.png)`, animationDelay: `${(-HERO_DUR + i * 5).toFixed(0)}s` }} />
        ))}
        <div className="hero-grad" />
        <div className="hero-in">
          <div className="k"><span className="d" /> Your creative studio</div>
          <h1>Turn rooms into <em>income</em>.</h1>
          <p>Generate brand-locked ads, screen them, approve before a dollar is spent — you&apos;re always in control.</p>
        </div>
      </header>

      <div className="grid cards4">
        <div className="stat"><div className="k">In review queue</div><div className="v">{queue.length}</div><div className="sub">finished ads</div></div>
        <div className="stat"><div className="k">Awaiting approval</div><div className="v good">{awaiting}</div><div className="sub">need your eyes</div></div>
        <div className="stat"><div className="k">Approved → ready</div><div className="v">{approved}</div><div className="sub">to hand to David</div></div>
        <div className="stat"><div className="k">Monthly plan</div><div className="v">${(cfg.budgetMonthly || 0).toLocaleString()}<small> · CPL ≤ ${cfg.kpi.cpl_usd_max}</small></div><div className="sub">$375/mo offer · no rev share</div></div>
      </div>

      <div className="gate warn"><span><b>Human gate (D-04).</b> The studio proposes — it never publishes to Meta or spends. Approving marks a set ready; a human pushes it live.</span></div>

      <div className="qa-row">
        <Link className="qa" href="/create"><div className="t">Generate creatives</div><div className="s">Run the engine across angles → finished ads</div></Link>
        <Link className="qa" href="/review"><div className="t">Review &amp; approve</div><div className="s">{awaiting} creatives waiting on you</div></Link>
        <Link className="qa" href="/budget"><div className="t">Plan budget</div><div className="s">Test / scale split · target leads</div></Link>
      </div>

      <div className="sec"><h2>Pipeline</h2></div>
      <div className="pipe">
        <div className="pl"><div className="n">{queue.length}</div><div className="l">Generated</div></div>
        <div className="pl"><div className="n">{pass}</div><div className="l">QA passed</div></div>
        <div className="pl"><div className="n">{approved}</div><div className="l">Approved</div></div>
        <div className="pl live"><div className="n">—</div><div className="l">Live (human-launched)</div></div>
      </div>

      <div className="sec"><h2>Recent creatives</h2><Link className="link" href="/review">Open review queue →</Link></div>
      {gallery.length === 0 ? (
        <div className="gate"><span>Queue is empty — generate a run to populate the studio.</span></div>
      ) : (
        <div className="sgrid">
          {gallery.map((c) => {
            const badge = c.qa === "pass" ? "ok" : c.qa === "fail" ? "bad" : "warn";
            return (
              <Link key={c.id} className="sg-card" href="/review">
                <div className={`sg-frame ${c.vertical ? "v" : "sq"}`}>
                  <img src={src(c)} alt={c.headline} />
                  <div className="sg-badges"><span className={`chip ${badge}`}>QA {c.qa}</span>{c.pricing_flag && <span className="chip warn">{c.pricing_flag}</span>}</div>
                </div>
                <div className="sg-cap"><div className="sg-h">{(c.headline || "").slice(0, 48)}</div><div className="sg-m">{c.angle_id} · {c.spec}</div></div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="sec"><h2>This week</h2><a className="link" href="/api/summary">Raw data →</a></div>
      <WeeklySummary />

      <div className="sec"><h2>Top performers <span className="ph">Phase 2</span></h2></div>
      <div className="gate"><span>Live CPL / CPC / CPA per creative activates once spend is live + the Meta Ads connection is wired. The loop proposes winners; a human scales them.</span></div>
    </>
  );
}
