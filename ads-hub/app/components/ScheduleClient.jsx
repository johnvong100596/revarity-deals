"use client";
import { useEffect, useState, useCallback } from "react";

const CH = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "meta_ads", label: "Meta Ads" },
];

export default function ScheduleClient() {
  const [conns, setConns] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [autopilot, setAutopilot] = useState({ enabled: false });
  const [approved, setApproved] = useState([]);
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState({}); // creativeId -> {channel, postAt}

  const load = useCallback(async () => {
    const [s, q] = await Promise.all([
      fetch("/api/social", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/queue", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setConns(s.connections || {}); setSchedule(s.schedule || []); setAutopilot(s.autopilot || { enabled: false });
    const dec = q.decisions || {};
    setApproved((q.queue || []).filter((c) => dec[c.id] === "approve"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function social(body, label) {
    setErr(""); setBusy(label);
    try {
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (!d.ok) throw new Error(d.error || "failed");
      setConns(d.connections || {}); setSchedule(d.schedule || []); setAutopilot(d.autopilot || { enabled: false });
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  }
  function connect(ch) {
    const account = window.prompt(`Connect ${ch.label}: enter the account handle/name this will post to`, "");
    if (account === null) return;
    social({ action: "connect", channel: ch.id, account }, `c-${ch.id}`);
  }
  async function getPlan() {
    setErr(""); setBusy("rec");
    try { const d = await fetch("/api/recommend", { cache: "no-store" }).then((r) => r.json()); if (!d.ok) throw new Error(d.error || "failed"); setRec(d.recommendations); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  }
  function addToSchedule(c) {
    const d = draft[c.id] || {};
    social({ action: "schedule", items: [{ creativeId: c.id, channel: d.channel || "instagram", postAt: d.postAt || "" }] }, `s-${c.id}`);
    setDraft((p) => { const n = { ...p }; delete n[c.id]; return n; });
  }
  const chLabel = (id) => CH.find((c) => c.id === id)?.label || id;

  return (
    <>
      <div className="eyebrow">— Schedule —</div>
      <h1>Push to <em>channels</em></h1>
      <p className="lead">Connect each account, queue approved creatives, and let the AI ads-expert recommend when to post and which winners to push. Posts go live once a channel is connected — until then they sit queued for your OK.</p>

      <div className="sec"><h2>Connections</h2></div>
      <div className="grid cards3">
        {CH.map((ch) => {
          const c = conns[ch.id] || {};
          return (
            <div className="stat" key={ch.id}>
              <div className="k">{ch.label}</div>
              <div className="keyrow"><span className={`kdot ${c.connected ? "on" : "off"}`} /><b>{c.connected ? "Connected" : "Not connected"}</b></div>
              {c.connected && c.account ? <div className="sub" style={{ marginTop: 6 }}>→ {c.account}</div> : null}
              <div style={{ marginTop: 12 }}>
                {c.connected
                  ? <button className="btn ghost" onClick={() => social({ action: "disconnect", channel: ch.id }, `d-${ch.id}`)} disabled={busy === `d-${ch.id}`}>Disconnect</button>
                  : <button className="btn" onClick={() => connect(ch)} disabled={busy === `c-${ch.id}`}>{busy === `c-${ch.id}` ? "Connecting…" : "Connect"}</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="gate"><span>Connect uses your own account; you choose which approved ads flow to it. Live publishing + view tracking activate on connect — until then everything here is a safe queue.</span></div>

      <div className="sec"><h2>Autopilot <span className="muted" style={{ fontSize: 12 }}>· post → track → make more of winners</span></h2></div>
      <div className="stat" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <div className="keyrow"><span className={`kdot ${autopilot.enabled ? "on" : "off"}`} /><b>{autopilot.enabled ? "Autopilot is ON" : "Autopilot is off"}</b></div>
          <div className="sub" style={{ marginTop: 6, maxWidth: 580 }}>{Object.values(conns).some((c) => c?.connected) ? "Posts your approved, scheduled ads, tracks their views, and automatically drafts more like the winners (they land in Review for your OK)." : "Connect a channel above to switch this on."}</div>
        </div>
        <button className="btn" disabled={busy === "ap" || !Object.values(conns).some((c) => c?.connected)} onClick={() => social({ action: "autopilot", enabled: !autopilot.enabled }, "ap")}>{busy === "ap" ? "…" : autopilot.enabled ? "Turn off" : "Enable autopilot"}</button>
      </div>

      <div className="sec"><h2>AI plan <span className="muted" style={{ fontSize: 12 }}>· when + which to post</span></h2><button className="btn ghost" onClick={getPlan} disabled={busy === "rec"}>{busy === "rec" ? "Thinking…" : "Get AI plan"}</button></div>
      {rec ? (
        <div className="summary">
          <div className="summary-head"><span>Ads-expert recommendation</span></div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div><b style={{ color: "var(--cyan)" }}>Cadence:</b> {rec.cadence}</div>
            <div><b style={{ color: "var(--cyan)" }}>Best times:</b> {(rec.best_times || []).join(" · ")}</div>
            {(rec.priority || []).length > 0 && <div style={{ marginTop: 8 }}><b style={{ color: "var(--cyan)" }}>Push first:</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{rec.priority.slice(0, 8).map((p, i) => <li key={i}>{chLabel(p.channel)} · {String(p.creativeId).slice(0, 40)} — {p.why} {p.when ? `(${p.when})` : ""}</li>)}</ul></div>}
            {(rec.notes || []).length > 0 && <div className="muted" style={{ marginTop: 8 }}>{rec.notes.join(" · ")}</div>}
          </div>
        </div>
      ) : <div className="gate"><span>Hit <b>Get AI plan</b> for a posting cadence, best times, and which approved creatives to push first (doubles down on winners once views are flowing).</span></div>}
      {err && <div className="log" style={{ color: "var(--coral)" }}>{err}</div>}

      <div className="sec"><h2>Approved — queue a post</h2><a className="link" href="/review">Approve more →</a></div>
      {approved.length === 0 ? <div className="gate"><span>Nothing approved yet. Approve creatives in <b>Review</b> to schedule them.</span></div> : (
        <div className="q">
          {approved.map((c) => {
            const d = draft[c.id] || {};
            const src = c.ad_url || c.image_url || `/api/image?id=${encodeURIComponent(c.id)}&v=ad`;
            return (
              <figure className="qc" key={c.id}>
                <div className={`qframe ${c.vertical ? "v" : "sq"}`}><img src={src} alt={c.headline} /></div>
                <div className="qbody">
                  <div className="qmeta"><span className="tag">{c.angle_id}</span><span className="tag">{c.spec}</span></div>
                  <p className="qtext">{(c.headline || "").slice(0, 70)}</p>
                  <div className="row" style={{ margin: "0 0 8px" }}>
                    <div className="fld" style={{ minWidth: 120 }}><label className="l">Channel</label>
                      <select value={d.channel || "instagram"} onChange={(e) => setDraft((p) => ({ ...p, [c.id]: { ...d, channel: e.target.value } }))}>{CH.map((ch) => <option key={ch.id} value={ch.id}>{ch.label}</option>)}</select>
                    </div>
                    <div className="fld" style={{ minWidth: 150 }}><label className="l">Post at</label>
                      <input type="datetime-local" value={d.postAt || ""} onChange={(e) => setDraft((p) => ({ ...p, [c.id]: { ...d, postAt: e.target.value } }))} />
                    </div>
                  </div>
                  <button className="btn" onClick={() => addToSchedule(c)} disabled={busy === `s-${c.id}`}>{busy === `s-${c.id}` ? "Queuing…" : "Add to schedule"}</button>
                </div>
              </figure>
            );
          })}
        </div>
      )}

      <div className="sec"><h2>Scheduled <span className="muted" style={{ fontSize: 12 }}>· {schedule.length}</span></h2></div>
      {schedule.length === 0 ? <div className="gate"><span>No posts queued yet.</span></div> : (
        <table>
          <thead><tr><th>Creative</th><th>Channel</th><th>When</th><th>Status</th><th /></tr></thead>
          <tbody>
            {schedule.map((x) => (
              <tr key={x.id}>
                <td><code>{String(x.creativeId).slice(0, 28)}</code></td>
                <td>{chLabel(x.channel)}{conns[x.channel]?.connected ? "" : " (not connected)"}</td>
                <td>{x.postAt || "—"}</td>
                <td>{x.status}</td>
                <td><button className="btn ghost" style={{ padding: "4px 10px", fontSize: 11 }} title="remove" onClick={() => social({ action: "unschedule", id: x.id }, `u-${x.id}`)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
