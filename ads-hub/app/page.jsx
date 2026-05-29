import { getConfig } from "@/lib/config";
import { readQueue } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const cfg = getConfig();
  const queue = await readQueue();
  const pass = queue.filter((c) => c.qa === "pass").length;
  return (
    <>
      <div className="eyebrow">— Operator Overview —</div>
      <h1>The funnel's <em>engine room</em></h1>
      <p className="lead">Everything the marketing engine produces flows through here: create a run, generate brand-locked creatives, approve before spend, plan budget, and (Phase 2) monitor performance. The engine generates and QAs; the spend decision stays human.</p>
      <div className="gate warn"><span><b>Human gate (D-04).</b> This hub proposes — it never publishes to Meta or spends. Approving a set marks it ready; a human still pushes it live. Pricing stays out of all copy while D-01 is open.</span></div>
      <div className="grid cards4">
        <div className="stat"><div className="k">In review queue</div><div className="v">{queue.length}</div><div className="sub">creatives generated</div></div>
        <div className="stat"><div className="k">Passed auto-QA</div><div className="v good">{pass}<small> / {queue.length}</small></div><div className="sub">brand + garble + banned-content</div></div>
        <div className="stat"><div className="k">Monthly budget plan</div><div className="v">${(cfg.budgetMonthly || 0).toLocaleString()}</div><div className="sub">human-set · not committed</div></div>
        <div className="stat"><div className="k">Target CPL</div><div className="v">${cfg.kpi.cpl_usd_max}<small> max</small></div><div className="sub">kill &gt; ${cfg.kpi.kill_creative_cpl_usd_over} · scale &lt; ${cfg.kpi.scale_creative_cpl_usd_under}</div></div>
      </div>
      <div className="sec-h">Angles configured</div>
      <table>
        <thead><tr><th>Angle</th><th>Type</th><th>Audience</th><th>Lead magnet</th><th>Variants</th></tr></thead>
        <tbody>
          {cfg.angles.map((a) => (
            <tr key={a.id}><td><code>{a.id}</code></td><td>{a.type}</td><td>{a.audience || ""}</td><td>{a.lead_magnet || "—"}</td><td>{a.variants}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
