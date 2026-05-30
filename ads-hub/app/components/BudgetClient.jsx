"use client";
import { useState } from "react";

export default function BudgetClient({ budgetMonthly, kpi, angles }) {
  const [total, setTotal] = useState(budgetMonthly || 7000);
  const [cpl, setCpl] = useState(kpi.cpl_usd_max);
  const [call, setCall] = useState(kpi.cost_per_call_usd_max);
  const leads = cpl > 0 ? Math.floor(total / cpl) : 0;
  const calls = call > 0 ? Math.floor(total / call) : 0;
  const per = angles.length ? 100 / angles.length : 0;

  return (
    <>
      <div className="eyebrow">— Budget —</div>
      <h1>Plan the <em>spend</em></h1>
      <p className="lead">Set the monthly plan and split it across angles. The hub computes target leads from your CPL ceiling — planning numbers only.</p>
      <div className="row">
        <div className="fld" style={{ maxWidth: 240 }}><label className="l">Monthly budget (USD)</label><input type="number" value={total} onChange={(e) => setTotal(+e.target.value || 0)} /></div>
        <div className="fld" style={{ maxWidth: 200 }}><label className="l">Target CPL ceiling</label><input type="number" value={cpl} onChange={(e) => setCpl(+e.target.value || 0)} /></div>
        <div className="fld" style={{ maxWidth: 200 }}><label className="l">Target cost / call</label><input type="number" value={call} onChange={(e) => setCall(+e.target.value || 0)} /></div>
      </div>
      <div className="grid cards3">
        <div className="stat"><div className="k">Est. leads / mo</div><div className="v good">{leads}</div><div className="sub">at ${cpl} CPL</div></div>
        <div className="stat"><div className="k">Est. calls / mo</div><div className="v">{calls}</div><div className="sub">at ${call}/call · target ≥ {kpi.calls_booked_monthly_min}</div></div>
        <div className="stat"><div className="k">Monthly plan</div><div className="v">${total.toLocaleString()}</div><div className="sub">not committed — planning only</div></div>
      </div>
      <div className="sec-h">Allocation by angle</div>
      <table>
        <thead><tr><th>Angle</th><th>Share</th><th>Spend</th><th>Est. leads @ CPL</th></tr></thead>
        <tbody>
          {angles.map((a) => {
            const spend = (total * per) / 100;
            return <tr key={a.id}><td><code>{a.id}</code></td><td>{per.toFixed(0)}%</td><td>${Math.round(spend).toLocaleString()}</td><td>{cpl > 0 ? Math.floor(spend / cpl) : 0}</td></tr>;
          })}
        </tbody>
      </table>
    </>
  );
}
