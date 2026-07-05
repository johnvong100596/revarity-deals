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
      <p className="lead">Set the monthly plan and split it across themes. We work out your target leads from your cost per lead ceiling — planning numbers only.</p>
      <div className="row">
        <div className="fld" style={{ maxWidth: 240 }}><label className="l">Monthly budget (USD)</label><input type="number" value={total} onChange={(e) => setTotal(+e.target.value || 0)} /></div>
        <div className="fld" style={{ maxWidth: 200 }}><label className="l">Target cost per lead ceiling</label><input type="number" value={cpl} onChange={(e) => setCpl(+e.target.value || 0)} /></div>
        <div className="fld" style={{ maxWidth: 200 }}><label className="l">Target cost per call</label><input type="number" value={call} onChange={(e) => setCall(+e.target.value || 0)} /></div>
      </div>
      <div className="grid cards3">
        <div className="stat"><div className="k">Estimated leads per month</div><div className="v good">{leads}</div><div className="sub">at ${cpl} per lead</div></div>
        <div className="stat"><div className="k">Estimated calls per month</div><div className="v">{calls}</div><div className="sub">at ${call} per call · target ≥ {kpi.calls_booked_monthly_min}</div></div>
        <div className="stat"><div className="k">Monthly plan</div><div className="v">${total.toLocaleString()}</div><div className="sub">not committed — planning only</div></div>
      </div>
      <div className="sec-h">Allocation by theme</div>
      <table>
        <thead><tr><th>Theme</th><th>Share</th><th>Spend</th><th>Estimated leads</th></tr></thead>
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
