"use client";
import { useEffect, useState, useCallback } from "react";

export default function ReviewClient() {
  const [queue, setQueue] = useState([]);
  const [state, setState] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");

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
    const res = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisions: state }) });
    const data = await res.json();
    setSaved(`Saved ${Object.values(data.decisions || {}).length} decisions at ${new Date(data.updatedAt).toLocaleTimeString()}`);
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
      <p className="lead">Every creative with its headline over the reserved zone, copy, and auto-QA verdict. Approve / hold / reject. Approving marks a set ready to push — it does not spend (D-04).</p>
      <div className="bar">
        <div className="tally">Approved <b>{tally("approve")}</b> · Hold <b>{tally("hold")}</b> · Reject <b>{tally("reject")}</b> · <span className="muted">of {queue.length}</span>{saved && <span className="muted"> — {saved}</span>}</div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn ghost" onClick={approveAllPass}>Approve all QA-pass</button>
          <button className="btn ghost" onClick={save}>Save decisions</button>
          <button className="btn" onClick={exportSet}>Export approved ↓</button>
        </div>
      </div>
      {loading ? <p className="muted">Loading queue…</p> : queue.length === 0 ? (
        <div className="gate"><span>ℹ</span><span>Queue is empty. Run the pipeline from <b>Create</b> to generate creatives.</span></div>
      ) : (
        <div className="q">
          {queue.map((c) => {
            const st = state[c.id];
            const badge = c.qa === "pass" ? "" : c.qa === "fail" ? "bad" : "warn";
            return (
              <figure key={c.id} className={`qc ${st === "approve" ? "appr" : st === "reject" ? "rej" : st === "hold" ? "hold" : ""}`}>
                <div className={`qframe ${c.vertical ? "v" : "sq"}`}>
                  {c.hasImg && <img src={`/api/image?id=${encodeURIComponent(c.id)}`} alt={c.headline} />}
                  <div className={`qov ${c.vertical ? "bot" : "top"}`}><div className="h">{c.headline}</div></div>
                  <span className={`qbadge ${badge}`}>QA {c.qa}</span>
                </div>
                <div className="qbody">
                  <div className="qmeta">
                    <span className="tag">{c.angle_id}</span><span className="tag">VAR {c.variant}</span><span className="tag">{c.spec}</span>
                    {c.pricing_flag && <span className="tag flag">{c.pricing_flag}</span>}
                  </div>
                  <p className="qtext">{c.body} <b>· {c.cta} →</b></p>
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
