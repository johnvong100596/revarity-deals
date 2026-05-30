"use client";
import { useState } from "react";

const TYPES = [
  { id: "image", label: "Image ad" },
  { id: "copy", label: "Copy only" },
  { id: "video", label: "Video (b-roll)" },
];

export default function CreateClient({ angles, formats }) {
  const [type, setType] = useState("image");
  const [angleId, setAngleId] = useState("");
  const [spec, setSpec] = useState(formats[0]?.name || "meta_feed_square");
  const [brief, setBrief] = useState("");
  const [reference, setReference] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [includeRef, setIncludeRef] = useState(true);
  const [finalRender, setFinalRender] = useState(false);

  const [pattern, setPattern] = useState(null);
  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]);

  function refForGen() {
    if (!includeRef) return "";
    if (pattern) return `Hook: ${pattern.hook}. Angle: ${pattern.angle}. Framework: ${pattern.framework}. ${pattern.suggested_brief || ""}`;
    return reference;
  }

  async function research() {
    setErr(""); setResearching(true); setPattern(null);
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: reference, url: refUrl }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "research failed");
      setPattern(data.pattern);
      if (!brief.trim() && data.pattern.suggested_brief) setBrief(data.pattern.suggested_brief);
    } catch (e) { setErr(String(e.message || e)); }
    finally { setResearching(false); }
  }

  async function pollVideo(jobId, key) {
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const res = await fetch(`/api/generate/${jobId}`, { cache: "no-store" });
        if (!res.ok) { update(key, { status: "failed", error: `poll failed (${res.status})` }); return; }
        const { job } = await res.json();
        if (job?.status === "done") { update(key, { status: "done", result_url: job.result_url }); return; }
        if (job?.status === "failed") { update(key, { status: "failed", error: job.error || "render failed" }); return; }
      } catch {}
    }
    update(key, { status: "failed", error: "timed out" });
  }
  const update = (key, patch) => setResults((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function generate() {
    setErr(""); setGenerating(true);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const body = { type, angleId, brief, reference: refForGen(), spec, final: finalRender };
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "generation failed");
      if (type === "copy") {
        const items = (data.variants || []).map((v, i) => ({ key: `${key}-${i}`, type: "copy", ...v }));
        setResults((rs) => [...items, ...rs]);
      } else if (type === "image") {
        setResults((rs) => [{ key, type: "image", id: data.id, headline: data.headline, body: data.body, cta: data.cta, pricing_flag: data.pricing_flag, ad_url: `/api/image?id=${encodeURIComponent(data.id)}&v=ad` }, ...rs]);
      } else if (type === "video") {
        setResults((rs) => [{ key, type: "video", status: "rendering", headline: brief.slice(0, 60) }, ...rs]);
        pollVideo(data.jobId, key);
      }
    } catch (e) { setErr(String(e.message || e)); }
    finally { setGenerating(false); }
  }

  return (
    <>
      <div className="eyebrow">— Create a run —</div>
      <h1>Spin up <em>creatives</em></h1>
      <p className="lead">Describe what you want, optionally paste an ad you like, and generate as many as you need until one clicks. Everything lands in the Review queue — the engine never publishes or spends (D-04).</p>
      <div className="gate warn"><span><b>Generate freely.</b> Each creative is a proposal. Nothing goes live until a human approves it in Review and launches it in Meta.</span></div>

      <div className="two">
        <div>
          <label className="l">What do you want? (brief / what's wrong with the current ones)</label>
          <textarea rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Make a calmer, more premium income-estimate ad for Toronto condos — show a revenue range, not one number." />
          <div className="row" style={{ marginTop: 14 }}>
            <div className="fld" style={{ maxWidth: 170 }}><label className="l">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            </div>
            <div className="fld"><label className="l">Angle</label>
              <select value={angleId} onChange={(e) => setAngleId(e.target.value)}>
                <option value="">Custom (use my brief)</option>
                {angles.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
              </select>
            </div>
            <div className="fld"><label className="l">Format</label>
              <select value={spec} onChange={(e) => setSpec(e.target.value)} disabled={type === "copy"}>
                {formats.map((f) => <option key={f.name} value={f.name}>{f.name} · {f.dims}</option>)}
              </select>
            </div>
          </div>
          {type === "image" && (
            <label className="cbx"><input type="checkbox" checked={finalRender} onChange={(e) => setFinalRender(e.target.checked)} /> Final render (slower, sharper text — use when in-image text must read cleanly)</label>
          )}
        </div>

        <div className="drop">
          <label className="l">Inspiration drop-bar — paste an ad you like</label>
          <textarea rows={4} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Paste a competitor / swipe ad's copy here. We learn the framework and make an ORIGINAL one — never a copy." />
          <input style={{ marginTop: 8 }} value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="optional source URL" />
          <div className="row" style={{ margin: "10px 0 0", alignItems: "center" }}>
            <button className="btn ghost" onClick={research} disabled={researching || (!reference.trim() && !refUrl.trim())}>{researching ? "Researching…" : "Research & mimic →"}</button>
            <label className="cbx" style={{ margin: 0 }}><input type="checkbox" checked={includeRef} onChange={(e) => setIncludeRef(e.target.checked)} /> use as inspiration</label>
          </div>
          {pattern && (
            <div className="pattern">
              <div><span className="tag">match {pattern.icp_match?.score ?? "—"}</span> {pattern.icp_match?.why}</div>
              <div><b>Hook</b> {pattern.hook}</div>
              <div><b>Angle</b> {pattern.angle}</div>
              <div><b>Framework</b> {pattern.framework}</div>
            </div>
          )}
        </div>
      </div>

      <div className="bar" style={{ position: "static", marginTop: 18 }}>
        <div className="tally">Generated this session <b>{results.length}</b> · <a className="link" href="/review">Open review queue →</a></div>
        <button className="btn" onClick={generate} disabled={generating}>{generating ? "Generating…" : `Generate ${type === "copy" ? "copy" : type === "video" ? "video" : "ad"} →`}</button>
      </div>
      {err && <div className="log" style={{ color: "var(--red)" }}>{err}</div>}

      {results.length > 0 && (
        <div className="rgrid">
          {results.map((r) => (
            <div className="rcard" key={r.key}>
              {r.type === "image" && r.ad_url && <div className="thumb"><img src={r.ad_url} alt={r.headline} /></div>}
              {r.type === "video" && (
                <div className="thumb">
                  {r.status === "rendering" ? <div className="rendering">Rendering video…</div> : r.status === "failed" ? <div className="rendering bad">Failed: {r.error}</div> : <video src={r.result_url} muted loop autoPlay playsInline />}
                </div>
              )}
              <div className="rbody">
                {r.headline && <div className="rh">{r.headline}</div>}
                {r.body && <div className="rt">{r.body}</div>}
                {r.cta && <div className="rcta">{r.cta} →</div>}
                <div className="rmeta">
                  <span className="tag">{r.type}</span>
                  {r.pricing_flag && <span className="tag flag">{r.pricing_flag}</span>}
                  {r.type !== "copy" && <a className="link" href="/review">review →</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
