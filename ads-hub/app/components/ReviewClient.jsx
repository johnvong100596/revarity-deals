"use client";
import { useEffect, useState, useCallback, useRef } from "react";

// Human-readable names for internal spec keys (display only — the keys stay internal).
const SPEC_LABEL = {
  meta_story_vertical: "Reels / Stories",
  meta_feed_portrait: "Feed portrait",
  meta_feed_square: "Feed square",
  meta_landscape: "Landscape",
  before_after_split: "Before / After",
};
// Plain wording for the automatic-check badge (c.qa values stay internal).
const QA_LABEL = { pass: "pass", fail: "needs a look" };

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
    <div className="scores" aria-label="AI ad score">
      <div className="score-head">
        <span className="score-cap">AI score <span className="muted">· estimate</span></span>
        {typeof s.overall === "number" && <span className={`score-pill ${tier}`} title="Blend of the four scores (scroll-past risk counts against). Higher = stronger.">{s.overall}<span style={{ opacity: 0.6, fontSize: 9 }}>/100</span></span>}
      </div>
      <Bar label="Opening" axis={s.hook} />
      <Bar label="Share appeal" axis={s.virality} />
      <Bar label="Reply pull" axis={s.response} />
      <Bar label="Scroll-past risk" axis={s.retentionRisk} risk />
      <div className="score-legend">
        <b>Opening</b> the first 3 seconds · <b>Share appeal</b> how likely people share it · <b>Reply pull</b> how likely people click or message · <b>Scroll-past risk</b> how likely people scroll past (higher = worse). <b>Overall</b> blends all four. Model estimate{s.model ? ` (${s.model})` : ""} — compare it with real results once ads are live.
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
  const [varN, setVarN] = useState(5); // variations-per-card count (1–10)
  const [varBusy, setVarBusy] = useState(null); // id of the card currently spinning variations
  const [varMsg, setVarMsg] = useState("");

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

  // ── Spin N variations off an existing creative (same script + background, varied hook) ──
  // Maps a variation shot from /api/variations to a /api/generate body, seeded by the source creative.
  function varShotBody(shot, base) {
    const spec = shot.spec && shot.spec !== "auto" ? shot.spec : (base.spec || "meta_feed_square");
    const b = { spec, directorPrompt: shot.prompt, headline: shot.headline || base.headline || "", spokenLine: shot.spokenLine || "", angleId: base.angle_id || "" };
    if (shot.kind === "image") return { ...b, type: "image" };
    if (shot.kind === "presenter") return { ...b, type: "video", mode: "presenter", engine: "veo" };
    if (shot.kind === "ugc") return { ...b, type: "video", engine: "arcads" };
    const e = shot.engine === "veo-broll" ? "veo" : shot.engine;
    const engine = ["veo", "kling", "kling-turbo", "higgsfield"].includes(e) ? e : "kling";
    return { ...b, type: "video", mode: "broll", engine };
  }
  async function pollVarJob(jobId) { // a finished video appends to the queue on completion — refresh when it lands
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try { const res = await fetch(`/api/generate/${jobId}`, { cache: "no-store" }); if (!res.ok) continue; const { job } = await res.json(); if (job?.status === "done" || job?.status === "failed") { await load(); return; } } catch {}
    }
  }
  async function spinVariations(c) {
    if (varBusy) return;
    setVarBusy(c.id); setVarMsg("");
    try {
      const idea = [c.headline, c.body, c.script].filter(Boolean).join(" — ");
      const isVid = !!c.video_url;
      const output = isVid ? (c.disclosure === "ai-presenter" ? "presenter" : "video") : "image";
      const res = await fetch("/api/variations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea, n: varN, output, format: c.spec || "auto", angleId: c.angle_id || "" }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "variations failed");
      const shots = data.plan?.shots || [];
      if (!shots.length) throw new Error("no variations returned");
      let made = 0;
      for (const shot of shots) { // sequential — avoids the queue append race
        setVarMsg(`Creating ${made + 1}/${shots.length}…`);
        try {
          const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(varShotBody(shot, c)) });
          const d = await r.json();
          if (d.ok) { made++; if (d.jobId) pollVarJob(d.jobId); }
        } catch {}
      }
      await load();
      setVarMsg(`${made} version${made === 1 ? "" : "s"} off ${c.angle_id || "this ad"} — ${isVid ? "the videos are being created and will appear as they finish" : "added to the queue below"}.`);
    } catch (e) { setVarMsg(`Couldn't make versions — ${String(e.message || e)}`); }
    finally { setVarBusy(null); setTimeout(() => setVarMsg(""), 7000); }
  }

  return (
    <>
      <div className="eyebrow">— Review &amp; approve —</div>
      <h1>Your <em>approvals</em></h1>
      <p className="lead">Every ad with its copy and our automatic check. Approve, hold, or reject.</p>
      <div className="bar">
        <div className="tally">Approved <b>{tally("approve")}</b> · Hold <b>{tally("hold")}</b> · Reject <b>{tally("reject")}</b> · <span className="muted">of {queue.length}</span>{saved && <span className="muted"> — {saved}</span>}{varMsg && <span className="muted"> — {varMsg}</span>}</div>
        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <span className="chip-sel" title="Versions per card">✨ <select value={varN} onChange={(e) => setVarN(Math.min(10, Math.max(1, Number(e.target.value) || 5)))}>{Array.from({ length: 10 }, (_, i) => i + 1).map((nn) => <option key={nn} value={nn}>{nn}</option>)}</select></span>
          <button className="btn ghost" onClick={() => setMode((m) => (m === "ink" ? "photo" : "ink"))}>Backdrop: {mode === "ink" ? "Ink" : "Photo"} ⇄</button>
          <button className="btn ghost" onClick={approveAllPass}>Approve all that passed</button>
          <button className="btn ghost" onClick={save}>Save decisions</button>
          <button className="btn" onClick={exportSet}>Export approved ↓</button>
        </div>
      </div>
      {loading ? <p className="muted">Loading queue…</p> : queue.length === 0 ? (
        <div className="gate"><span>Queue is empty. Go to <b>Create</b> to make ads.</span></div>
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
                  <span className={`qbadge ${badge}`} title={c.qa !== "pass" && c.qa_reasons?.length ? c.qa_reasons[0] : undefined}>Check: {QA_LABEL[c.qa] || c.qa}</span>
                </div>
                <div className="qbody">
                  <div className="qmeta">
                    <span className="tag">{c.angle_id}</span>{c.variant && c.variant !== "HUB" && <span className="tag">VAR {c.variant}</span>}<span className="tag">{SPEC_LABEL[c.spec] || c.spec}</span>
                    {c.pricing_flag && <span className="tag flag">{c.pricing_flag}</span>}
                    {c.disclosure === "ai-presenter" && <span className="tag flag" title="AI presenter — not a real client. Apply the platform's AI-generated label when posting; no implied client, no return claims.">AI presenter · label on post</span>}
                  </div>
                  <p className="qtext">{c.body} <b>· {c.cta} →</b></p>
                  {c.script && <p className="qscript" title="What the presenter says on camera (Veo turns this into synced audio).">🎙 <em>“{c.script}”</em></p>}
                  <ScoreStrip s={c.scores} />
                  <div className="acts">
                    <button className={`ap ${st === "approve" ? "on" : ""}`} onClick={() => set(c.id, "approve")}>Approve</button>
                    <button className={`hd ${st === "hold" ? "on" : ""}`} onClick={() => set(c.id, "hold")}>Hold</button>
                    <button className={`rj ${st === "reject" ? "on" : ""}`} onClick={() => set(c.id, "reject")}>Reject</button>
                  </div>
                  <div className="card-foot">
                    <a className="link remake-link" href={remakeHref(c)} title="Open this in the studio with its idea prefilled — tweak and regenerate to perfect it.">✎ Edit &amp; remake</a>
                    <button className="link var-spin" onClick={() => spinVariations(c)} disabled={!!varBusy} title={`Make ${varN} versions of this ad — same script and background, different openings. They land in your approvals for review.`}>{varBusy === c.id ? "Creating…" : `✨ Make ${varN} versions`}</button>
                  </div>
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
            <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>kept out of your approvals — not deleted until you click Delete</span>
            {showRejected && (
              <div className="q rejected-q">
                {rejected.map((c) => (
                  <figure key={c.id} className="qc rej">
                    <div className={`qframe ${c.vertical ? "v" : "sq"}`}>
                      {c.video_url ? <PreviewVideo src={c.video_url} /> : <img src={adSrc(c)} alt={c.headline} />}
                    </div>
                    <div className="qbody">
                      <div className="qmeta"><span className="tag">{c.angle_id}</span><span className="tag">{SPEC_LABEL[c.spec] || c.spec}</span></div>
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
