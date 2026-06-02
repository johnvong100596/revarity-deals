import { loadConfig } from "@/lib/config";
import PerformancePanel from "@/app/components/PerformancePanel";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const { kpi } = await loadConfig();
  return (
    <>
      <div className="eyebrow">— Monitor —</div>
      <h1>How your ads are <em>doing</em> <span className="ph">Turns on with live ads</span></h1>
      <p className="lead">Once your ads are running, this is where you see how each one is performing — what you’re paying for a click, for a lead, and for a booked call — next to the goals you set. The studio points out the winners and quietly makes more like them, and flags the weak ones so you can switch them off. It only ever suggests; every spending decision stays yours.</p>
      <div className="gate"><span><b>Nothing to show yet.</b> This page wakes up once your ads are live and connected to your Facebook / Instagram (Meta) account. The numbers below are the goals from your <b>Settings</b> — real results will fill in next to them.</span></div>
      <div className="grid cards4">
        <div className="stat"><div className="k">Cost per click</div><div className="v">${kpi.cpc_usd_max}<small> or less</small></div><div className="sub muted">— no data yet —</div></div>
        <div className="stat"><div className="k">Cost per lead</div><div className="v">${kpi.cpl_usd_max}<small> or less</small></div><div className="sub muted">— no data yet —</div></div>
        <div className="stat"><div className="k">Cost per booked call</div><div className="v">${(kpi.cpa_usd_max).toLocaleString()}<small> or less</small></div><div className="sub muted">— no data yet —</div></div>
        <div className="stat"><div className="k">Calls booked / month</div><div className="v">{kpi.calls_booked_monthly_min}<small> or more</small></div><div className="sub muted">— no data yet —</div></div>
      </div>
      <div className="sec-h">How each ad is doing</div>
      <div className="gate"><span>Every ad gets its own line here once results start coming in. We’ll suggest <b>switching off</b> any ad that costs more than <b>${kpi.kill_creative_cpl_usd_over}</b> per lead after <b>{kpi.kill_creative_after_impressions.toLocaleString()}</b> views, and <b>spending more</b> on any ad under <b>${kpi.scale_creative_cpl_usd_under}</b> per lead — you approve every change.</span></div>

      <div className="sec"><h2>Winners — and making more of them</h2></div>
      <PerformancePanel />
    </>
  );
}
