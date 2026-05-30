"use client";
import { useEffect, useState } from "react";

export default function PerformancePanel() {
  const [p, setP] = useState(null);
  useEffect(() => { fetch("/api/performance", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setP(d)).catch(() => {}); }, []);
  if (!p) return <div className="gate"><span>Loading…</span></div>;

  return (
    <>
      <div className="gate"><span>{p.note}{p.connected.length ? ` Connected: ${p.connected.join(", ")}.` : ""}</span></div>
      {p.hasData ? (
        <div className="q">
          {p.winners.map((w, i) => (
            <figure className="qc" key={i}>
              <div className="qbody">
                <div className="qmeta"><span className="tag">#{i + 1}</span><span className="tag">{w.channel}</span></div>
                <p className="qtext">{String(w.creativeId || "").slice(0, 60)}</p>
                <div className="rmeta"><span className="tag">{(w.views || 0).toLocaleString()} views</span><a className="link" href="/create">make more like this →</a></div>
              </div>
            </figure>
          ))}
        </div>
      ) : (
        <div className="qa-row">
          <div className="qa"><div className="t">1 · Connect</div><div className="s">Hook up a channel on the Schedule page — one button.</div></div>
          <div className="qa"><div className="t">2 · Post the queue</div><div className="s">Your approved ads go out on the schedule you set.</div></div>
          <div className="qa"><div className="t">3 · Double down</div><div className="s">Whatever gets the most views, the studio makes more of — automatically.</div></div>
        </div>
      )}
    </>
  );
}
