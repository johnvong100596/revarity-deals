"use client";
import { useEffect, useState, useCallback, useRef } from "react";

// Predictive Creative Score (AI estimate). Hook/Viral/Response are higher-is-better; Retention risk is
// higher-is-WORSE (coral). Each axis shows the model's one-line reason inline. Estimates, not guarantees
// — meant to be calibrated against real reach/saves once posts go live.
function ScoreStrip({ s }) {
  if (!s) return null;
  const Bar = ({ label, axis, risk }) => {
    const v = typeof axis?.score === "number" ? axis.score : null;
    if (v === null) return null;
    return (
      <div className={`score ${risk ? "risk" : ""}`}>
        <div className="score-top">
          <span className="sl">{label}</span>
          <span className="sbar"><i style={{ width: `${v}%` }} /></span>
          <span className="sv">{v}</span>
        </div>
        {axis.why && <span className="swhy">{axis.why}</span>}
      </div>
    );
  };
  const tier = s.overall >= 70 ? "good" : s.overall >= 45 ? "mid" : "low";
  return (
    <div className="scores" aria-label="AI creative score">
      <div className="score-head">
        <span className="score-cap">AI score <span className="muted">· estimate</span></span>
        {typeof s.overall === "number" && <span className={`score-pill ${tier}`} title="Blend of the four axes (retention risk inverted). Higher = stronger.">{s.overall}<span style={{ opacity: 0.6, fontSize: 9 }}>/100</span></span>}
      </div>
      <Bar label="Hook" axis={s.hook} />
      <Bar label="Viral" axis={s.virality} />
      <Bar label="Response" axis={s.response} />
      <Bar label="Retention risk" axis={s.retentionRisk} risk />
      <div className="score-legend">
        <b>Hook</b> first-3-sec scroll-stop · <b>Viral</b> shareability · <b>Response</b> predicted click/DM rate · <b>Retention risk</b> drop-off risk (higher = worse). <b>Overall</b> blends all four. Model estimate{s.model ? ` (${s.model})` : ""} — calibrate against real reach/saves once live.
      </div>
    </div>
  );
}

// Queue video previews stay FROZEN on their first frame until you hover (or tap on touch). With 50+
// clips on screen, autoplaying every one at once pegged the browser and made the page crawl — this
// decodes/plays only the clip under the cursor, and parks the rest on a still poster frame.
function PreviewVideo({ src }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  // #t=0.1 nudges the browser to paint the first frame as a poster (instead of black) while paused.
  const frozenSrc = src && src.includes("#") ? src : `${src}#t=0.1`;
  const play = () => { const v = ref.current; if (v) v.play().then(() => setPlaying(true)).catch(() => {}); };
  const stop = () => { const v = ref.current; if (!v) return; v.pause(); try { v.currentTime = 0.1; } catch {} setPlaying(false); };
  return (
    <div className="vprev" onMouseEnter={play} onMouseLeave={stop} onClick={() => (playing ? stop() : play())}>
      <video ref={ref} src={frozenSrc} muted loop playsInline preload="metadata" tabIndex={-1} />
      {!playing && <span className="vprev-play" aria-hidden="true">▶</span>}
    </div>
  );
}

export default function ReviewClient() {
  const [queue, setQueue] = useState([]);
  const [state, setState] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");
  const [mode, setMode] = useState("ink"); // ink | photo backdrop
  const [showRejected, setShowRejected] = useState(false);

  const adSrc = (c) => {
    const bg = c.image_url || `/api/image?id=${encodeURIComponent(c.id)}`;
    return mode === "photo" ? (c.ad_photo_url || c.ad_url || bg) : (c.ad_url || c.ad_photo_url || bg);
  };

  // Send a creative back to the studio composer prefilled, so the operator can edit + re-spin it.
  const remakeHref = (c) => {
    const brief = [c.headline, c.body, c.script].filter(Boolean).join(" — ").slice(0, 600);
    const output = c.video_url ? (c.disclosure === "ai-presenter" ? "presenter" : "video") : "image";
    const p = new URLSearchParams({ brief, angle: c.angle_id || "", spec: c.spec || "auto", output });
    return `/create?${p.toString()}`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/queue", { cache: "no-store" });
    const data = await res.json();
    setQueue(data.queue || []);
    setState(data.decisions || {});
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (id, s) => setState((p) => ({ ...p, [id]: p[id] === s ? undefined : s }));
  const approveAllPass = () => setState((p) => { const n = { ...p }; queue.forEach((c) => { if (c.qa === "pass") n[c.id] = "approve"; }); return n; });
  const tally = (s) => Object.values(state).filter((v) => v === s).length;
  // Reject HIDES from the gate (kept, recoverable); the Rejected section can Restore or permanently Delete.
  const rejected = queue.filter((c) => state[c.id] === "reject");
  const active = queue.filter((c) => state[c.id] !== "reject");
  const restore = (id) => setState((p) => ({ ...p, [id]: undefined }));
  async function removeCreative(id) {
    try {
      const res = await fetch("/api/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) return;
      setQueue((q) => q.filter((c) => c.id !== id));
      setState((p) => { const n = { ...p }; delete n[id]; return n; });
    } catch {}
  }

  async function save() {
    try {
      const res = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisions: state }) });
      if (!res.ok) { setSaved("Save failed"); setTimeout(() => setSaved(""), 4000); return; }
      const data = await res.json();
      const when = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "now";
      setSaved(`Saved ${Object.values(data.decisions || {}).length} decisions at ${when}`);
    } catch { setSaved("Save failed"); }
    setTimeout(() => setSaved(""), 4000);
  }
  function exportSet() {
    const approved = queue.filter((c) => state[c.id] === "approve").map((c) => ({ id: c.id, angle: c.angle_id, variant: c.variant, spec: c.spec, headline: c.headline, cta: c.cta }));
    const blob = new Blob([JSON.stringify({ count: approved.length, note: "Approved for spend. Pushing live is a human action (D-04).", approved }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "approved-set.json"; a.click();
  }

  return (
    <>
      <div className="eyebrow">— Review &amp; approve —</div>
      <h1>The approval <em>gate</em></h1>
      <p className="lead">Every creative with its copy and auto-QA verdict. Approve, hold, or reject.</p>
      <div className="bar">
        <div className="tally">Approved <b>{tally("approve")}</b> · Hold <b>{tally("hold")}</b> · Reject <b>{tally("reject")}</b> · <span className="muted">of {queue.length}</span>{saved && <span className="muted"> — {saved}</span>}</div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn ghost" onClick={() => setMode((m) => (m === "ink" ? "photo" : "ink"))}>Backdrop: {mode === "ink" ? "Ink" : "Photo"} ⇄</button>
          <button className="btn ghost" onClick={approveAllPass}>Approve all QA-pass</button>
          <button className="btn ghost" onClick={save}>Save decisions</button>
          <button className="btn" onClick={exportSet}>Export approved ↓</button>
        </div>
      </div>
      {loading ? <p className="muted">Loading queue…</p> : queue.length === 0 ? (
        <div className="gate"><span>Queue is empty. Run the pipeline from <b>Create</b> to generate creatives.</span></div>
      ) : (
        <>
        {active.length === 0 ? (
          <div className="gate"><span>No active concepts — everything is in <b>Rejected</b> below. Restore or delete them there.</span></div>
        ) : (
        <div className="q">
          {active.map((c) => {
            const st = state[c.id];
            const badge = c.qa === "pass" ? "" : c.qa === "fail" ? "bad" : "warn";
            return (
              <figure key={c.id} className={`qc ${st === "approve" ? "appr" : st === "reject" ? "rej" : st === "hold" ? "hold" : ""}`}>
                <div className={`qframe ${c.vertical ? "v" : "sq"}`}>
                  {c.video_url
                    ? <PreviewVideo src={c.video_url} />
                    : <img src={adSrc(c)} alt={c.headline} />}
                  <span className={`qbadge ${badge}`}>QA {c.qa}</span>
                </div>
                <div className="qbody">
                  <div className="qmeta">
                    <span className="tag">{c.angle_id}</span><span className="tag">VAR {c.variant}</span><span className="tag">{c.spec}</span>
                    {c.pricing_flag && <span className="tag flag">{c.pricing_flag}</span>}
                    {c.disclosure === "ai-presenter" && <span className="tag flag" title="AI presenter — not a real client. Apply the platform's AI-generated label when posting; no implied client, no return claims.">AI presenter · label on post</span>}
                  </div>
                  <p className="qtext">{c.body} <b>· {c.cta} →</b></p>
                  {c.script && <p className="qscript" title="What the presenter says on camera (Veo renders this as synced audio).">🎙 <em>“{c.script}”</em></p>}
                  <ScoreStrip s={c.scores} />
                  <div className="acts">
                    <button className={`ap ${st === "approve" ? "on" : ""}`} onClick={() => set(c.id, "approve")}>Approve</button>
                    <button className={`hd ${st === "hold" ? "on" : ""}`} onClick={() => set(c.id, "hold")}>Hold</button>
                    <button className={`rj ${st === "reject" ? "on" : ""}`} onClick={() => set(c.id, "reject")}>Reject</button>
                  </div>
                  <a className="link remake-link" href={remakeHref(c)} title="Open this in the studio with its idea prefilled — tweak and regenerate to perfect it.">✎ Edit &amp; remake</a>
                  {st === "reject" && <div className="rej-note">Rejected — still here, not deleted. Click Reject again to undo.</div>}
                </div>
              </figure>
            );
          })}
        </div>
        )}
        {rejected.length > 0 && (
          <div className="rejected-wrap">
            <button className="btn ghost" onClick={() => setShowRejected((v) => !v)}>Rejected ({rejected.length}) {showRejected ? "▲" : "▼"}</button>
            <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>kept out of the gate — not deleted until you click Delete</span>
            {showRejected && (
              <div className="q rejected-q">
                {rejected.map((c) => (
                  <figure key={c.id} className="qc rej">
                    <div className={`qframe ${c.vertical ? "v" : "sq"}`}>
                      {c.video_url ? <PreviewVideo src={c.video_url} /> : <img src={adSrc(c)} alt={c.headline} />}
                    </div>
                    <div className="qbody">
                      <div className="qmeta"><span className="tag">{c.angle_id}</span><span className="tag">{c.spec}</span></div>
                      <p className="qtext">{c.headline || c.body}</p>
                      <div className="acts">
                        <button className="hd" onClick={() => restore(c.id)}>Restore</button>
                        <button className="rj" onClick={() => removeCreative(c.id)}>Delete ✕</button>
                      </div>
                    </div>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}
        </>
      )}
    </>
  );
}
