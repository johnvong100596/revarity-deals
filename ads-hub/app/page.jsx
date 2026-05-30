import Link from "next/link";
import { getConfig } from "@/lib/config";
import { readQueue, readApprovals } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Studio() {
  const cfg = getConfig();
  const [queue, approvals] = await Promise.all([readQueue(), readApprovals()]);
  const dec = approvals.decisions || {};
  const pass = queue.filter((c) => c.qa === "pass").length;
  const approved = Object.values(dec).filter((v) => v === "approve").length;
  const awaiting = queue.filter((c) => !dec[c.id]).length;
  const gallery = queue.slice(0, 12);
  const src = (c) => c.ad_url || c.image_url || `/api/image?id=${encodeURIComponent(c.id)}&v=ad`;

  return (
    <>
      <div className="eyebrow">— Studio · creative-ops command center —</div>
      <h1>The funnel's <em>engine room</em></h1>
      <p className="lead">Generate brand-locked creatives, screen them, approve before spend. The engine proposes; you dispose.</p>

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

      <div className="sec"><h2>Top performers <span className="ph">Phase 2</span></h2></div>
      <div className="gate"><span>Live CPL / CPC / CPA per creative activates once spend is live + the Meta Ads MCP (read-only) is wired. The loop proposes winners; a human scales them.</span></div>
    </>
  );
}
