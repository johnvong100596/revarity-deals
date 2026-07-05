"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Schedule = the launch calendar (D-16: the calendar is the screen's job).
 * D-18 workspace channel POOL: one shared rack of connected channels — each shows its owner;
 * owners control "team can post here" and the per-channel autopilot opt-in. Posting is
 * multi-select across the channels you're allowed to hit; every send is logged as member +
 * channel. Only APPROVED ads can be queued — channel choice never bypasses review (D-04).
 */
const CH_LEGACY = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "meta_ads", label: "Meta Ads" },
];

export default function ScheduleClient() {
  const sp = useSearchParams();
  const [me, setMe] = useState(null);
  const [channels, setChannels] = useState([]);
  const [conns, setConns] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [postLog, setPostLog] = useState([]);
  const [autopilot, setAutopilot] = useState({ enabled: false });
  const [approved, setApproved] = useState([]);
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(() => sp.get("connect_error") || "");
  const [draft, setDraft] = useState({}); // creativeId -> { channelIds: {id:true}, postAt }
  const [pending, setPending] = useState(null); // OAuth picker payload
  const [pickSel, setPickSel] = useState({}); // pageId -> { fb, ig, company }

  const load = useCallback(async () => {
    const pick = sp.get("pick");
    const [s, q, ch] = await Promise.all([
      fetch("/api/social", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/queue", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/meta/channels${pick ? `?pick=${encodeURIComponent(pick)}` : ""}`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setConns(s.connections || {}); setSchedule(s.schedule || []); setAutopilot(s.autopilot || { enabled: false });
    setPostLog((s.postLog || []).slice(-20).reverse());
    setMe(ch.me || null); setChannels(ch.channels || []);
    if (ch.pending) { setPending(ch.pending); setPickSel(Object.fromEntries(ch.pending.pages.map((p) => [p.pageId, { fb: true, ig: !!p.ig, company: false }]))); }
    if (ch.pendingError) setErr(ch.pendingError);
    const dec = q.decisions || {};
    setApproved((q.queue || []).filter((c) => dec[c.id] === "approve"));
  }, [sp]);
  useEffect(() => { load(); }, [load]);

  const isOwner = (c) => me && c.owner?.id === me.id;
  const canPost = (c) => isOwner(c) || c.teamCanPost;
  const postable = channels.filter(canPost);

  async function social(body, label) {
    setErr(""); setBusy(label);
    try {
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (!d.ok) throw new Error(d.error || "failed");
      setConns(d.connections || {}); setSchedule(d.schedule || []); setAutopilot(d.autopilot || { enabled: false });
      if (Array.isArray(d.channels)) setChannels(d.channels);
      setPostLog((d.postLog || []).slice(-20).reverse());
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  }

  async function channelApi(method, body, label) {
    setErr(""); setBusy(label);
    try {
      const r = await fetch("/api/meta/channels", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (!d.ok) throw new Error(d.error || "failed");
      setChannels(d.channels || []);
      return d;
    } catch (e) { setErr(String(e.message || e)); return null; } finally { setBusy(""); }
  }

  async function finalizePick() {
    const selections = Object.entries(pickSel)
      .filter(([, v]) => v.fb || v.ig)
      .map(([pageId, v]) => ({ pageId, asFacebook: v.fb, asInstagram: v.ig, company: v.company }));
    const d = await channelApi("POST", { pick: pending.pick, selections }, "finalize");
    if (d) { setPending(null); try { window.history.replaceState(null, "", "/schedule"); } catch {} }
  }

  async function getPlan() {
    setErr(""); setBusy("rec");
    try { const d = await fetch("/api/recommend", { cache: "no-store" }).then((r) => r.json()); if (!d.ok) throw new Error(d.error || "failed"); setRec(d.recommendations); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  }

  function addToSchedule(c) {
    const d = draft[c.id] || {};
    const channelIds = Object.entries(d.channelIds || {}).filter(([, on]) => on).map(([id]) => id);
    if (!channelIds.length) { setErr("Pick at least one channel for that ad."); return; }
    social({ action: "schedule", items: [{ creativeId: c.id, channelIds, postAt: d.postAt || "" }] }, `s-${c.id}`);
    setDraft((p) => { const n = { ...p }; delete n[c.id]; return n; });
  }

  const chLabel = (x) => x.channelId ? (channels.find((c) => c.id === x.channelId)?.label || x.account || x.channel) : (CH_LEGACY.find((c) => c.id === x.channel)?.label || x.channel);
  const legacyConnected = Object.values(conns).some((c) => c?.connected);

  return (
    <>
      <div className="eyebrow">— Schedule —</div>
      <h1>Push to <em>channels</em></h1>
      <p className="lead">One shared rack of channels — connect yours once, choose whether the team can post to it, and queue approved ads to any channels you're allowed to hit. Every send is logged with who sent it.</p>

      {pending && (
        <>
          <div className="sec"><h2>Finish connecting</h2></div>
          <div className="stat">
            <div className="sub" style={{ marginBottom: 10 }}>Pick which of your pages join the workspace rack. Mark company pages — those open to the team by default (you can flip any of this later).</div>
            {pending.pages.map((p) => {
              const v = pickSel[p.pageId] || {};
              return (
                <div key={p.pageId} className="keyrow" style={{ gap: 14, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <b style={{ minWidth: 180 }}>{p.name}</b>
                  <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={!!v.fb} onChange={() => setPickSel((s) => ({ ...s, [p.pageId]: { ...v, fb: !v.fb } }))} /> Facebook page</label>
                  {p.ig ? <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={!!v.ig} onChange={() => setPickSel((s) => ({ ...s, [p.pageId]: { ...v, ig: !v.ig } }))} /> Instagram (@{p.ig.username || "linked"})</label> : <span className="muted" style={{ fontSize: 11.5 }}>no linked IG</span>}
                  <label style={{ fontSize: 12.5 }} title="Company pages open to the whole team by default; personal stays yours-only until you flip the toggle."><input type="checkbox" checked={!!v.company} onChange={() => setPickSel((s) => ({ ...s, [p.pageId]: { ...v, company: !v.company } }))} /> company page</label>
                </div>
              );
            })}
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={finalizePick} disabled={busy === "finalize"}>{busy === "finalize" ? "Adding…" : "Add to the rack →"}</button>
            </div>
          </div>
        </>
      )}

      <div className="sec"><h2>Channel rack <span className="muted" style={{ fontSize: 12 }}>· whole workspace sees this</span></h2><a className="btn ghost" href="/api/meta/connect">Connect your Meta channels</a></div>
      {channels.length === 0 ? (
        <div className="gate"><span>No channels in the rack yet. <b>Connect your Meta channels</b> signs you into Meta once (John's app — team members are testers on it) and your pages appear here for the whole workspace. You stay in control of who can post to them.</span></div>
      ) : (
        <div className="grid cards3">
          {channels.map((c) => (
            <div className="stat" key={c.id}>
              <div className="k">{c.kind === "instagram" ? "Instagram" : "Facebook"}{c.company ? " · company" : ""}</div>
              <div className="keyrow"><span className="kdot on" /><b>{c.label}</b></div>
              <div className="sub" style={{ marginTop: 6 }}>connected by {c.owner?.name || "—"}{isOwner(c) ? " (you)" : ""}</div>
              <div className="sub" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <label title={isOwner(c) ? "Let anyone on the team queue posts to this channel." : "Only the owner can change this."} style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="checkbox" checked={!!c.teamCanPost} disabled={!isOwner(c) || busy === `t-${c.id}`} onChange={() => channelApi("PATCH", { channelId: c.id, teamCanPost: !c.teamCanPost }, `t-${c.id}`)} />
                  team can post here
                </label>
                <label title={isOwner(c) ? "Let autopilot publish the due, approved queue to this channel. Off = this channel's posts wait even when autopilot runs." : "Only the owner can change this."} style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="checkbox" checked={!!c.autopilot} disabled={!isOwner(c) || busy === `a-${c.id}`} onChange={() => channelApi("PATCH", { channelId: c.id, autopilot: !c.autopilot }, `a-${c.id}`)} />
                  autopilot may post
                </label>
              </div>
              {isOwner(c) && (
                <div style={{ marginTop: 10 }}>
                  <button className="btn ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={busy === `d-${c.id}`} onClick={() => { if (window.confirm(`Disconnect ${c.label}? Queued posts for it are dropped.`)) channelApi("DELETE", { channelId: c.id }, `d-${c.id}`); }}>Disconnect</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {legacyConnected && <div className="gate" style={{ marginTop: 12 }}><span>A legacy env-configured channel is also active (pre-pool setup) — it keeps working until the same page joins the rack.</span></div>}

      <div className="sec"><h2>Autopilot <span className="muted" style={{ fontSize: 12 }}>· post → track → make more of winners</span></h2></div>
      <div className="stat" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <div className="keyrow"><span className={`kdot ${autopilot.enabled ? "on" : "off"}`} /><b>{autopilot.enabled ? "Autopilot is ON" : "Autopilot is off"}</b></div>
          <div className="sub" style={{ marginTop: 6, maxWidth: 580 }}>Master switch. Even when on, autopilot only posts to channels whose <b>owner</b> ticked "autopilot may post" — it never touches a personal feed without that toggle. Winners it drafts land back in Review for your OK.</div>
        </div>
        <button className="btn" disabled={busy === "ap" || (channels.length === 0 && !legacyConnected)} onClick={() => social({ action: "autopilot", enabled: !autopilot.enabled }, "ap")}>{busy === "ap" ? "…" : autopilot.enabled ? "Turn off" : "Enable autopilot"}</button>
      </div>

      <div className="sec"><h2>AI plan <span className="muted" style={{ fontSize: 12 }}>· when + which to post</span></h2><button className="btn ghost" onClick={getPlan} disabled={busy === "rec"}>{busy === "rec" ? "Thinking…" : "Get AI plan"}</button></div>
      {rec ? (
        <div className="summary">
          <div className="summary-head"><span>Ads-expert recommendation</span></div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div><b style={{ color: "var(--cyan)" }}>Cadence:</b> {rec.cadence}</div>
            <div><b style={{ color: "var(--cyan)" }}>Best times:</b> {(rec.best_times || []).join(" · ")}</div>
            {(rec.priority || []).length > 0 && <div style={{ marginTop: 8 }}><b style={{ color: "var(--cyan)" }}>Push first:</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{rec.priority.slice(0, 8).map((p, i) => <li key={i}>{String(p.creativeId).slice(0, 40)} — {p.why} {p.when ? `(${p.when})` : ""}</li>)}</ul></div>}
            {(rec.notes || []).length > 0 && <div className="muted" style={{ marginTop: 8 }}>{rec.notes.join(" · ")}</div>}
          </div>
        </div>
      ) : null}
      {err && <div className="log" style={{ color: "var(--coral)" }}>{err}</div>}

      <div className="sec"><h2>Approved — queue a post</h2><a className="link" href="/review">Approve more →</a></div>
      {approved.length === 0 ? <div className="gate"><span>Nothing approved yet. Approve ads in <b>Review</b> to schedule them.</span></div> : postable.length === 0 && !legacyConnected ? <div className="gate"><span>No channels you can post to yet — connect your own above, or ask an owner to flip "team can post here".</span></div> : (
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
                  <div className="fld" style={{ marginBottom: 8 }}>
                    <label className="l">Channels — pick any you're allowed to hit</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {postable.map((ch) => (
                        <label key={ch.id} style={{ fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
                          <input type="checkbox" checked={!!d.channelIds?.[ch.id]} onChange={() => setDraft((p) => ({ ...p, [c.id]: { ...d, channelIds: { ...(d.channelIds || {}), [ch.id]: !d.channelIds?.[ch.id] } } }))} />
                          {ch.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="fld" style={{ marginBottom: 8, maxWidth: 220 }}>
                    <label className="l">Post at</label>
                    <input type="datetime-local" value={d.postAt || ""} onChange={(e) => setDraft((p) => ({ ...p, [c.id]: { ...d, postAt: e.target.value } }))} />
                  </div>
                  <button className="btn" onClick={() => addToSchedule(c)} disabled={busy === `s-${c.id}`}>{busy === `s-${c.id}` ? "Queuing…" : "Queue to selected →"}</button>
                </div>
              </figure>
            );
          })}
        </div>
      )}

      <div className="sec"><h2>Scheduled <span className="muted" style={{ fontSize: 12 }}>· {schedule.length}</span></h2></div>
      {schedule.length === 0 ? <div className="gate"><span>No posts queued yet.</span></div> : (
        <table>
          <thead><tr><th>Ad</th><th>Channel</th><th>When</th><th>Queued by</th><th>Status</th><th /></tr></thead>
          <tbody>
            {schedule.map((x) => (
              <tr key={x.id}>
                <td><code>{String(x.creativeId).slice(0, 28)}</code></td>
                <td>{chLabel(x)}</td>
                <td>{x.postAt || "—"}</td>
                <td>{(x.by || "—").split(" (")[0]}</td>
                <td>{x.status}</td>
                <td><button className="btn ghost" style={{ padding: "4px 10px", fontSize: 11 }} title="remove" onClick={() => social({ action: "unschedule", id: x.id }, `u-${x.id}`)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {postLog.length > 0 && (
        <>
          <div className="sec"><h2>Recent sends <span className="muted" style={{ fontSize: 12 }}>· who posted what, where</span></h2></div>
          <table>
            <thead><tr><th>When</th><th>By</th><th>Channel</th><th>Ad</th></tr></thead>
            <tbody>
              {postLog.map((l, i) => (
                <tr key={i}><td>{new Date(l.at).toLocaleString()}</td><td>{(l.by || "—").split(" (")[0]}</td><td>{l.channelLabel}</td><td><code>{String(l.creativeId).slice(0, 28)}</code></td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
