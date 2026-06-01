"use client";
import { useEffect, useState, useCallback } from "react";

// Predictive Creative Score (AI estimate). Hook/Viral/Response are higher-is-better; Retention risk is
// higher-is-WORSE (shown coral). The "why" is exposed on hover. Estimates, not guarantees — calibrate
// against real Meta insights once posts go live.
function ScoreStrip({ s }) {
  if (!s) return null;
  const Bar = ({ label, axis, risk }) => {
    const v = typeof axis?.score === "number" ? axis.score : null;
    if (v === null) return null;
    return (
      <div className={`score ${risk ? "risk" : ""}`} title={axis.why || ""}>
        <span className="sl">{label}</span>
        <span className="sbar"><i style={{ width: `${v}%` }} /></span>
        <span className="sv">{v}</span>
      </div>
    );
  };
  const tier = s.overall >= 70 ? "good" : s.overall >= 45 ? "mid" : "low";
  return (
    <div className="scores" aria-label="AI creative score">
      <div className="score-head">
        <span className="score-cap">AI score <span className="muted">· estimate</span></span>
        {typeof s.overall === "number" && <span className={`score-pill ${tier}`}>{s.overall}</span>}
      </div>
      <Bar label="Hook" axis={s.hook} />
      <Bar label="Viral" axis={s.virality} />
      <Bar label="Response" axis={s.response} />
      <Bar label="Retention risk" axis={s.retentionRisk} risk />
    </div>
  );
}

export default function ReviewClient() {
  const [queue, setQueue] = useState([]);
  const [state, setState] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");
  const [mode, setMode] = useState("ink"); // ink | photo backdrop

  const adSrc = (c) => {
    const bg = c.image_url || `/api/image?id=${encodeURIComponent(c.id)}`;
    return mode === "photo" ? (c.ad_photo_url || c.ad_url || bg) : (c.ad_url || c.ad_photo_url || bg);
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
        <div className="q">
          {queue.map((c) => {
            const st = state[c.id];
            const badge = c.qa === "pass" ? "" : c.qa === "fail" ? "bad" : "warn";
            return (
              <figure key={c.id} className={`qc ${st === "approve" ? "appr" : st === "reject" ? "rej" : st === "hold" ? "hold" : ""}`}>
                <div className={`qframe ${c.vertical ? "v" : "sq"}`}>
                  {c.video_url
                    ? <video src={c.video_url} muted loop autoPlay playsInline />
                    : <img src={adSrc(c)} alt={c.headline} />}
                  <span className={`qbadge ${badge}`}>QA {c.qa}</span>
                </div>
                <div className="qbody">
                  <div className="qmeta">
                    <span className="tag">{c.angle_id}</span><span className="tag">VAR {c.variant}</span><span className="tag">{c.spec}</span>
                    {c.pricing_flag && <span className="tag flag">{c.pricing_flag}</span>}
                  </div>
                  <p className="qtext">{c.body} <b>· {c.cta} →</b></p>
                  <ScoreStrip s={c.scores} />
                  <div className="acts">
                    <button className={`ap ${st === "approve" ? "on" : ""}`} onClick={() => set(c.id, "approve")}>Approve</button>
                    <button className={`hd ${st === "hold" ? "on" : ""}`} onClick={() => set(c.id, "hold")}>Hold</button>
                    <button className={`rj ${st === "reject" ? "on" : ""}`} onClick={() => set(c.id, "reject")}>Reject</button>
                  </div>
                </div>
              </figure>
            );
          })}
        </div>
      )}
    </>
  );
}
