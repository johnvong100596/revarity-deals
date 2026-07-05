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

const ANGLE_TYPES = ["lead_magnet", "direct_offer", "awareness", "custom"];

function ModelRow({ m }) {
  return (
    <div className="mrow">
      <span className={`kdot ${m.on ? "on" : "off"}`} />
      <div className="mrow-main">
        <div className="mrow-t">{m.label} <code>{m.model}</code></div>
        <div className="mrow-s">{m.provider} · <span className={m.on ? "ok" : "muted"}>{m.on ? "connected" : m.hint}</span></div>
      </div>
    </div>
  );
}

export default function SettingsClient({ config, copyModel, imageModels = [], videoModels = [] }) {
  const [budget, setBudget] = useState(config.budgetMonthly || 0);
  const [kpi, setKpi] = useState({ ...config.kpi });
  const [saved, setSaved] = useState(config.settingsUpdatedAt ? `Last saved ${new Date(config.settingsUpdatedAt).toLocaleString()}` : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // ── Angle library (editable; persists as an override over the read-only base ad-angles.json) ──
  const [angles, setAngles] = useState(() => (config.anglesFull || []).map((a) => ({ ...a })));
  const [editing, setEditing] = useState(null); // index being edited
  const [dirty, setDirty] = useState(false);
  const [angBusy, setAngBusy] = useState(false);
  const [angMsg, setAngMsg] = useState(config.anglesCustomized ? "Custom angle set" : "Using default angles");
  const [showRestoreHelp, setShowRestoreHelp] = useState(false); // parked-mode "Restore library…" affordance
  const [angErr, setAngErr] = useState("");
  const [genBrief, setGenBrief] = useState("");

  // ── Format library (editable; overrides brand.json creative_specs) ──
  const [formats, setFormats] = useState(() => (config.formatsFull || []).map((f) => ({ ...f })));
  const [fmtEditing, setFmtEditing] = useState(null);
  const [fmtDirty, setFmtDirty] = useState(false);
  const [fmtBusy, setFmtBusy] = useState(false);
  const [fmtMsg, setFmtMsg] = useState(config.formatsCustomized ? "Custom format set" : "Using default formats");
  const [fmtErr, setFmtErr] = useState("");

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

  async function reloadAngles() {
    const r = await fetch("/api/settings", { cache: "no-store" });
    const d = await r.json();
    setAngles((d.config?.anglesFull || []).map((a) => ({ ...a })));
    setAngMsg(d.config?.anglesCustomized ? "Custom angle set saved" : "Reset to default angles");
    setDirty(false); setEditing(null);
  }

  const patchAngle = (i, patch) => { setAngles((p) => p.map((a, idx) => (idx === i ? { ...a, ...patch } : a))); setDirty(true); };
  const removeAngle = (i) => { setAngles((p) => p.filter((_, idx) => idx !== i)); setEditing(null); setDirty(true); };
  const addBlank = () => { setAngles((p) => [...p, { id: "NEW_ANGLE", type: "custom", audience: "", lead_magnet: "", visual_direction: "", variants: [] }]); setEditing(angles.length); setDirty(true); };

  async function genNewAngle() {
    setAngErr(""); setAngBusy(true);
    try {
      const r = await fetch("/api/angle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: genBrief, existing: angles.map((a) => ({ id: a.id })) }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "could not generate angle");
      setAngles((p) => [...p, { variants: [], ...d.angle }]);
      setEditing(angles.length); setDirty(true); setGenBrief("");
    } catch (e) { setAngErr(String(e.message || e)); }
    finally { setAngBusy(false); }
  }

  async function saveAngles() {
    setAngErr(""); setAngBusy(true);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ angles }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "save failed");
      await reloadAngles();
    } catch (e) { setAngErr(String(e.message || e)); }
    finally { setAngBusy(false); }
  }

  async function resetAngles() {
    setAngErr(""); setAngBusy(true);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ angles: [] }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "reset failed");
      await reloadAngles();
    } catch (e) { setAngErr(String(e.message || e)); }
    finally { setAngBusy(false); }
  }

  const patchFormat = (i, patch) => { setFormats((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f))); setFmtDirty(true); };
  const removeFormat = (i) => { setFormats((p) => p.filter((_, idx) => idx !== i)); setFmtEditing(null); setFmtDirty(true); };
  const addFormat = () => { setFormats((p) => [...p, { name: "custom_format", w: 1080, h: 1080, use: "" }]); setFmtEditing(formats.length); setFmtDirty(true); };

  async function reloadFormats() {
    const r = await fetch("/api/settings", { cache: "no-store" });
    const d = await r.json();
    setFormats((d.config?.formatsFull || []).map((f) => ({ ...f })));
    setFmtMsg(d.config?.formatsCustomized ? "Custom format set saved" : "Reset to default formats");
    setFmtDirty(false); setFmtEditing(null);
  }
  async function saveFormats() {
    setFmtErr(""); setFmtBusy(true);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formats }) });
      const d = await r.json(); if (!d.ok) throw new Error(d.error || "save failed");
      await reloadFormats();
    } catch (e) { setFmtErr(String(e.message || e)); } finally { setFmtBusy(false); }
  }
  async function resetFormats() {
    setFmtErr(""); setFmtBusy(true);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formats: [] }) });
      const d = await r.json(); if (!d.ok) throw new Error(d.error || "reset failed");
      await reloadFormats();
    } catch (e) { setFmtErr(String(e.message || e)); } finally { setFmtBusy(false); }
  }

  return (
    <>
      <div className="eyebrow">— Settings —</div>
      <h1>Engine <em>settings</em></h1>
      <p className="lead">Your connected models, the budget and goals the hub plans against, and the ad angles it builds from. Changing money or launching ads is still a human action (D-04).</p>

      <div className="sec"><h2>Connections &amp; models</h2></div>
      <div className="subh">Marketing brain</div>
      <div className="mlist">{copyModel && <ModelRow m={copyModel} />}</div>
      <div className="subh">Image models</div>
      <div className="mlist">{imageModels.map((m) => <ModelRow key={m.model} m={m} />)}</div>
      <div className="subh">Video models</div>
      <div className="mlist">{videoModels.map((m) => <ModelRow key={m.model + m.label} m={m} />)}</div>
      <div className="gate" style={{ marginTop: 14 }}><span>Meta performance is intentionally off for now — Monitor + weekly ROI light up when a Meta token + live spend exist. Models connect via environment keys (shown above); nothing here ever publishes or spends.</span></div>

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

      <div className="sec"><h2>Angles</h2>{config.anglesEnabled && <span className="muted" style={{ fontSize: 12 }}>{dirty ? "Unsaved changes" : angMsg}</span>}</div>
      {/* D-16: while parked, the editor doesn't render at all — buttons that do nothing don't
          earn pixels. The approved base file is untouched; ANGLES_ENABLED=1 brings it all back. */}
      {!config.anglesEnabled ? (
        <div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px", maxWidth: 720 }}>Angles are parked — the studio builds each ad straight from your prompt.</p>
          <button className="btn ghost sm" onClick={() => setShowRestoreHelp((v) => !v)}>Restore library…</button>
          {showRestoreHelp && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10, maxWidth: 640 }}>
              To bring the preset angles back, set <code>ANGLES_ENABLED=1</code> in Vercel and redeploy. The approved base file was never touched, so nothing is lost — the full library and this editor return with the flag.
            </p>
          )}
        </div>
      ) : (
      <>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px", maxWidth: 720 }}>The angles the studio builds ads from. Edit the targeting/direction, generate a fresh angle, or remove one — changes are local until you press <b>Save angles</b>, and only override your working set (the approved base file is never touched). Approved variant copy is preserved, not edited here.</p>

      <div className="angle-bar">
        <input className="angle-brief" placeholder="Optional: theme for a new angle (e.g. 'tax benefits for first-time hosts')" value={genBrief} onChange={(e) => setGenBrief(e.target.value)} />
        <button className="btn ghost sm" onClick={genNewAngle} disabled={angBusy}>{angBusy ? "Working…" : "✨ Generate new angle"}</button>
        <button className="btn ghost sm" onClick={addBlank} disabled={angBusy}>+ Add blank</button>
        <button className="btn sm" onClick={saveAngles} disabled={angBusy || !dirty}>Save angles</button>
        <button className="btn ghost sm" onClick={resetAngles} disabled={angBusy} title="Discard the override and return to the approved default angles">Reset to defaults</button>
      </div>
      {angErr && <div className="log" style={{ color: "var(--red)" }}>{angErr}</div>}

      <div className="angle-list">
        {angles.length === 0 && <div className="gate"><span>No angles — generate one, add a blank, or reset to defaults.</span></div>}
        {angles.map((a, i) => (
          <div className="angle-card" key={i}>
            <div className="angle-head">
              <code>{a.id || "—"}</code>
              <span className="tag">{a.type || "custom"}</span>
              <span className="muted" style={{ fontSize: 11 }}>{(a.variants || []).length} variant{(a.variants || []).length === 1 ? "" : "s"} · copy preserved</span>
              <div className="angle-acts">
                <button className="btn ghost sm" onClick={() => setEditing(editing === i ? null : i)}>{editing === i ? "Close" : "Edit"}</button>
                <button className="btn ghost sm danger" onClick={() => removeAngle(i)}>Remove</button>
              </div>
            </div>
            {editing === i ? (
              <div className="angle-edit">
                <div className="row" style={{ marginBottom: 0 }}>
                  <div className="fld"><label className="l">ID</label><input value={a.id} onChange={(e) => patchAngle(i, { id: e.target.value })} /></div>
                  <div className="fld" style={{ maxWidth: 200 }}><label className="l">Type</label>
                    <select value={a.type || "custom"} onChange={(e) => patchAngle(i, { type: e.target.value })}>{ANGLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                  </div>
                </div>
                <div className="fld"><label className="l">Audience</label><input value={a.audience || ""} onChange={(e) => patchAngle(i, { audience: e.target.value })} /></div>
                <div className="fld"><label className="l">Lead magnet (free thing offered)</label><input value={a.lead_magnet || ""} onChange={(e) => patchAngle(i, { lead_magnet: e.target.value })} /></div>
                <div className="fld"><label className="l">Visual direction</label><textarea rows={2} value={a.visual_direction || ""} onChange={(e) => patchAngle(i, { visual_direction: e.target.value })} /></div>
              </div>
            ) : (
              <div className="angle-meta">
                <div><b>Audience</b> {a.audience || "—"}</div>
                <div><b>Lead magnet</b> {a.lead_magnet || "—"}</div>
                <div><b>Visual</b> {a.visual_direction || "—"}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      </>
      )}

      <div className="sec"><h2>Formats</h2><span className="muted" style={{ fontSize: 12 }}>{fmtDirty ? "Unsaved changes" : fmtMsg}</span></div>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px", maxWidth: 720 }}>The placement sizes the studio renders to. Add a size, edit dimensions, or remove one — changes are local until you press <b>Save formats</b>, and only override your working set (the brand file is never touched).</p>
      <div className="angle-bar">
        <button className="btn ghost sm" onClick={addFormat} disabled={fmtBusy}>+ Add format</button>
        <button className="btn sm" onClick={saveFormats} disabled={fmtBusy || !fmtDirty}>Save formats</button>
        <button className="btn ghost sm" onClick={resetFormats} disabled={fmtBusy} title="Discard the override and return to the default formats">Reset to defaults</button>
      </div>
      {fmtErr && <div className="log" style={{ color: "var(--red)" }}>{fmtErr}</div>}
      <div className="angle-list">
        {formats.length === 0 && <div className="gate"><span>No formats — add one or reset to defaults.</span></div>}
        {formats.map((f, i) => (
          <div className="angle-card" key={i}>
            <div className="angle-head">
              <code>{f.name || "—"}</code>
              <span className="tag">{f.w}×{f.h}</span>
              <div className="angle-acts">
                <button className="btn ghost sm" onClick={() => setFmtEditing(fmtEditing === i ? null : i)}>{fmtEditing === i ? "Close" : "Edit"}</button>
                <button className="btn ghost sm danger" onClick={() => removeFormat(i)}>Remove</button>
              </div>
            </div>
            {fmtEditing === i ? (
              <div className="angle-edit">
                <div className="fld"><label className="l">Name (slug)</label><input value={f.name} onChange={(e) => patchFormat(i, { name: e.target.value })} /></div>
                <div className="row" style={{ marginBottom: 0 }}>
                  <div className="fld"><label className="l">Width (px)</label><input type="number" value={f.w} onChange={(e) => patchFormat(i, { w: +e.target.value || 0 })} /></div>
                  <div className="fld"><label className="l">Height (px)</label><input type="number" value={f.h} onChange={(e) => patchFormat(i, { h: +e.target.value || 0 })} /></div>
                </div>
                <div className="fld"><label className="l">Use</label><input value={f.use || ""} onChange={(e) => patchFormat(i, { use: e.target.value })} /></div>
              </div>
            ) : (
              <div className="angle-meta">
                <div><b>Use</b> {f.use || "—"}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
