import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function MonitorPage() {
  const { kpi } = getConfig();
  return (
    <>
      <div className="eyebrow">— Monitor —</div>
      <h1>Performance <em>loop</em> <span className="ph">Phase 2</span></h1>
      <p className="lead">Live CPL / CPC / CPA / CTR per creative, pulled read-only from Meta Ads Manager, scored against your targets. Winners feed <code>refresh</code> mode; losers are flagged for a human to pause. The loop proposes; the human disposes (D-04).</p>
      <div className="gate"><span>ℹ</span><span><b>Awaiting live data.</b> Activates after spend goes live and the Meta Ads MCP (read-only) is wired (PLAN Stream E). Targets below come from <code>ad-angles.json</code>.</span></div>
      <div className="grid cards4">
        <div className="stat"><div className="k">CPC target</div><div className="v">${kpi.cpc_usd_max}<small> max</small></div><div className="sub muted">— awaiting data —</div></div>
        <div className="stat"><div className="k">CPL target</div><div className="v">${kpi.cpl_usd_max}<small> max</small></div><div className="sub muted">— awaiting data —</div></div>
        <div className="stat"><div className="k">CPA target</div><div className="v">${(kpi.cpa_usd_max).toLocaleString()}<small> max</small></div><div className="sub muted">— awaiting data —</div></div>
        <div className="stat"><div className="k">Calls booked / mo</div><div className="v">{kpi.calls_booked_monthly_min}<small> min</small></div><div className="sub muted">— awaiting data —</div></div>
      </div>
      <div className="sec-h">Per-creative performance</div>
      <div className="gate"><span>◷</span><span>Table populates from <code>/api/metrics</code> once Meta data flows. Kill rule: CPL &gt; ${kpi.kill_creative_cpl_usd_over} after {kpi.kill_creative_after_impressions} impressions. Scale rule: CPL &lt; ${kpi.scale_creative_cpl_usd_under}.</span></div>
    </>
  );
}
