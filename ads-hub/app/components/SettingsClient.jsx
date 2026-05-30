"use client";
import { useState } from "react";

const KPI_FIELDS = [
  ["cpl_usd_max", "Target CPL ceiling ($)"],
  ["cpc_usd_max", "Target CPC max ($)"],
  ["cost_per_call_usd_max", "Cost per call max ($)"],
  ["cpa_usd_max", "CPA max ($)"],
  ["calls_booked_monthly_min", "Calls booked / mo (min)"],
  ["kill_creative_cpl_usd_over", "Kill creative if CPL over ($)"],
  ["kill_creative_after_impressions", "…after impressions"],
  ["scale_creative_cpl_usd_under", "Scale creative if CPL under ($)"],
];

export default function SettingsClient({ config, keys, models }) {
  const [budget, setBudget] = useState(config.budgetMonthly || 0);
  const [kpi, setKpi] = useState({ ...config.kpi });
  const [saved, setSaved] = useState(config.settingsUpdatedAt ? `Last saved ${new Date(config.settingsUpdatedAt).toLocaleString()}` : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budgetMonthly: budget, kpi }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "save failed");
      setSaved(`Saved ${new Date(d.saved.updatedAt).toLocaleTimeString()}`);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  const Key = ({ on, label, hint }) => (
    <div className="keyrow"><span className={`kdot ${on ? "on" : "off"}`} /><b>{label}</b> <span className="muted">{on ? "connected" : hint}</span></div>
  );

  return (
    <>
      <div className="eyebrow">— Settings —</div>
      <h1>Engine <em>settings</em></h1>
      <p className="lead">Budget and KPI targets the hub uses for planning and the (Phase-2) performance loop. Connections and models are shown for transparency. Changing money or launching ads is still a human action (D-04).</p>

      <div className="sec"><h2>Connections</h2></div>
      <div className="grid cards3">
        <div className="stat"><div className="k">Copy model</div><div className="v" style={{ fontSize: 16 }}>{models.copy}</div><Key on={keys.copy} label="Anthropic" hint="set ANTHROPIC_API_KEY" /></div>
        <div className="stat"><div className="k">Image model</div><div className="v" style={{ fontSize: 16 }}>{models.image}</div><Key on={keys.image} label="Gemini / Nano Banana" hint="set GEMINI_API_KEY" /></div>
        <div className="stat"><div className="k">Video model</div><div className="v" style={{ fontSize: 16 }}>{models.video}</div><Key on={keys.video} label="Higgsfield" hint="set HIGGSFIELD_ACCESS_TOKEN" /></div>
      </div>
      <div className="gate" style={{ marginTop: 14 }}><span>Meta performance is intentionally off for now — Monitor + weekly ROI light up when a Meta token + live spend exist.</span></div>

      <div className="sec"><h2>Budget &amp; targets</h2>{saved && <span className="muted" style={{ fontSize: 12 }}>{saved}</span>}</div>
      <div className="row">
        <div className="fld" style={{ maxWidth: 220 }}><label className="l">Monthly budget (USD)</label><input type="number" value={budget} onChange={(e) => setBudget(+e.target.value || 0)} /></div>
      </div>
      <div className="grid cards4">
        {KPI_FIELDS.map(([k, label]) => (
          <div className="fld" key={k}><label className="l">{label}</label><input type="number" value={kpi[k] ?? ""} onChange={(e) => setKpi((p) => ({ ...p, [k]: +e.target.value || 0 }))} /></div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
      </div>
      {err && <div className="log" style={{ color: "var(--red)" }}>{err}</div>}

      <div className="sec"><h2>Angles &amp; formats</h2><a className="link" href="/create">Generate →</a></div>
      <table>
        <thead><tr><th>Angle</th><th>Audience</th><th>Lead magnet</th><th>Variants</th></tr></thead>
        <tbody>{config.angles.map((a) => <tr key={a.id}><td><code>{a.id}</code></td><td>{a.audience}</td><td>{a.lead_magnet || "—"}</td><td>{a.variants}</td></tr>)}</tbody>
      </table>
    </>
  );
}
