"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

const OUTPUTS = [
  { id: "auto", label: "Auto — studio decides" },
  { id: "presenter", label: "Presenter commercial" },
  { id: "video", label: "Video b-roll" },
  { id: "image", label: "Image" },
  { id: "copy", label: "Copy only" },
];
const FORMAT_LABELS = {
  meta_feed_square: "Feed · Square 1:1",
  meta_feed_portrait: "Feed · Portrait 4:5",
  meta_story_vertical: "Reels / Stories 9:16",
  meta_landscape: "Landscape 16:9",
  before_after_split: "Before / After",
};
const ENGINE_LABEL = {
  "veo-presenter": "Veo · presenter", "veo-broll": "Veo · b-roll", kling: "Kling",
  "kling-turbo": "Kling Turbo", higgsfield: "Higgsfield", nano: "Nano image", arcads: "Arcads UGC",
};
const LENGTHS = [["auto", "Auto length"], ["8", "~8s"], ["15", "~15s"], ["30", "~30s"], ["60", "~45–60s"]];

export default function CreateClient({ angles, formats }) {
  const sp = useSearchParams();
  const [idea, setIdea] = useState(() => sp.get("brief") || "");
  const [output, setOutput] = useState(() => sp.get("output") || "auto");
  const [format, setFormat] = useState(() => sp.get("spec") || "auto");
  const [angleId, setAngleId] = useState(() => sp.get("angle") || "");
  const [duration, setDuration] = useState("auto");

  const [showInsp, setShowInsp] = useState(false);
  const [reference, setReference] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [refVideo, setRefVideo] = useState("");
  const [wantVoice, setWantVoice] = useState(false);
  const [voScript, setVoScript] = useState("");
  const [wantMusic, setWantMusic] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");

  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planErr, setPlanErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]);

  const inspirationText = () =>
    [reference.trim(), refUrl.trim() && `Source URL: ${refUrl.trim()}`, refVideo.trim() && `Reference video: ${refVideo.trim()}`]
      .filter(Boolean).join("\n");

  const addResult = (r) => setResults((rs) => [r, ...rs]);
  const update = (key, patch) => setResults((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

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

  // Core: POST one generate request and track its result. Returns when the request is accepted
  // (video keeps polling in the background). Sequential callers avoid the queue.json append race.
  async function runGenerate(body, label) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "generation failed");
      if (body.type === "copy") {
        (data.variants || []).forEach((v, i) => addResult({ key: `${key}-${i}`, type: "copy", label, ...v }));
      } else if (body.type === "image") {
        addResult({ key, type: "image", label, id: data.id, headline: data.headline, body: data.body, cta: data.cta, pricing_flag: data.pricing_flag, scores: data.scores, ad_url: `/api/image?id=${encodeURIComponent(data.id)}&v=ad` });
      } else {
        addResult({ key, type: "video", label, status: "rendering", headline: label || body.headline || "" });
        pollVideo(data.jobId, key);
      }
    } catch (e) {
      addResult({ key, type: body.type === "image" ? "image" : "video", label, status: "failed", error: String(e.message || e), headline: label || "" });
    }
  }

  async function makeAudio(kind, payload, label) {
    const key = `${Date.now()}-${kind}`;
    addResult({ key, type: kind, label, status: "rendering" });
    try {
      const res = await fetch(`/api/${kind === "voice" ? "voiceover" : "music"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `${kind} failed`);
      update(key, { status: "done", url: data.url });
    } catch (e) { update(key, { status: "failed", error: String(e.message || e) }); }
  }

  // Map a director shot to a /api/generate body.
  function shotBody(shot) {
    const base = { spec: shot.spec || format, directorPrompt: shot.prompt, headline: shot.headline, spokenLine: shot.spokenLine, angleId, targetSeconds: shot.durationSec || undefined };
    if (shot.kind === "image") return { ...base, type: "image" };
    if (shot.kind === "presenter") return { ...base, type: "video", mode: "presenter", engine: "veo" };
    if (shot.kind === "ugc") return { ...base, type: "video", engine: "arcads" };
    const e = shot.engine === "veo-broll" ? "veo" : shot.engine;
    const engine = ["veo", "kling", "kling-turbo", "higgsfield"].includes(e) ? e : "kling";
    return { ...base, type: "video", mode: "broll", engine };
  }

  async function planIt() {
    setBusy(true); setPlanErr(""); setPlan(null); setErr("");
    try {
      const res = await fetch("/api/director", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, inspiration: inspirationText(), wantVoice, wantMusic, output, format, angleId, targetSeconds: duration === "auto" ? null : Number(duration) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "planning failed");
      setPlan(data.plan);
    } catch (e) { setPlanErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  async function generateAll() {
    if (!plan) return;
    setGenerating(true); setErr("");
    try {
      for (const shot of plan.shots) await runGenerate(shotBody(shot), shot.label); // sequential — avoids queue race
      if (plan.voice?.include) await makeAudio("voice", { text: plan.voice.script || idea }, "Voiceover");
      if (plan.music?.include) await makeAudio("music", { prompt: plan.music.prompt }, "Music");
    } finally { setGenerating(false); }
  }

  // Forced single output (no director): generate directly from the idea.
  async function directGenerate() {
    setBusy(true); setErr("");
    try {
      const base = { spec: format, brief: idea, reference: inspirationText(), angleId, targetSeconds: duration === "auto" ? null : Number(duration) };
      if (output === "copy") await runGenerate({ ...base, type: "copy", n: 3 }, "Copy");
      else if (output === "image") await runGenerate({ ...base, type: "image" }, "Image");
      else if (output === "presenter") await runGenerate({ ...base, type: "video", mode: "presenter", engine: "veo" }, "Presenter");
      else await runGenerate({ ...base, type: "video", mode: "broll", engine: "kling" }, "Video");
      if (wantVoice) await makeAudio("voice", { text: voScript || idea }, "Voiceover");
      if (wantMusic && musicPrompt.trim()) await makeAudio("music", { prompt: musicPrompt }, "Music");
    } finally { setBusy(false); }
  }

  const spinUp = () => (output === "auto" ? planIt() : directGenerate());

  return (
    <>
      <div className="eyebrow">— Spin up a creative —</div>
      <h1>The <em>studio</em></h1>
      <p className="lead">Describe the ad you want — or paste a full script (hook, scenes, lines, b-roll). The studio routes each shot to the engine that does it best, then drops everything in Review for your yes.</p>

      <div className="composer">
        <textarea className="idea" rows={6} value={idea} onChange={(e) => setIdea(e.target.value)}
          placeholder={'e.g. "A confident host walks through a Tulum penthouse and explains how we build Airbnbs for serious investors…" — or paste a full script with hook, scenes, lines, and a b-roll shot list.'} />

        <div className="chips">
          <button className={`chip ${showInsp ? "on" : ""}`} onClick={() => setShowInsp((v) => !v)}>+ Inspiration{showInsp && <span className="x">×</span>}</button>
          <button className={`chip ${wantVoice ? "on" : ""}`} onClick={() => setWantVoice((v) => !v)}>+ Voice{wantVoice && <span className="x">×</span>}</button>
          <button className={`chip ${wantMusic ? "on" : ""}`} onClick={() => setWantMusic((v) => !v)}>+ Music{wantMusic && <span className="x">×</span>}</button>
          <span className="chip-sel">Output <select value={output} onChange={(e) => setOutput(e.target.value)}>{OUTPUTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></span>
          <span className="chip-sel">Format <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="auto">Auto — studio picks</option>
            {formats.map((f) => <option key={f.name} value={f.name}>{FORMAT_LABELS[f.name] || f.name} · {f.dims}</option>)}
          </select></span>
          <span className="chip-sel">Angle <select value={angleId} onChange={(e) => setAngleId(e.target.value)}>
            <option value="">Auto</option>{angles.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select></span>
          <span className="chip-sel">Length <select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {LENGTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></span>
        </div>

        {showInsp && (
          <div className="chip-panel">
            <label className="l">Inspiration — copy from others, or drop a URL / video link</label>
            <textarea rows={3} value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Paste a competitor / swipe ad's copy. We learn the framework and make an ORIGINAL — never a copy." />
            <input style={{ marginTop: 8 }} value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="optional source URL" />
            <input style={{ marginTop: 8 }} value={refVideo} onChange={(e) => setRefVideo(e.target.value)} placeholder="…or a reference VIDEO link (Dropbox / Drive / YouTube) — we mimic its structure, not its footage" />
          </div>
        )}
        {wantVoice && (
          <div className="chip-panel">
            <label className="l">Voice (ElevenLabs) — optional script (blank = the studio writes it from your idea)</label>
            <textarea rows={2} value={voScript} onChange={(e) => setVoScript(e.target.value)} placeholder="Narration to speak over the b-roll cut." />
          </div>
        )}
        {wantMusic && (
          <div className="chip-panel">
            <label className="l">Music (Lyria) — mood & instruments, no vocals</label>
            <input value={musicPrompt} onChange={(e) => setMusicPrompt(e.target.value)} placeholder="e.g. warm cinematic piano + soft strings, calm and aspirational, ~30s bed" />
          </div>
        )}

        <div className="composer-foot">
          <span className="hint">{output === "auto" ? "Auto: the studio plans the shots and routes engines — you approve before anything posts (D-04)." : "Forced output — generates directly into Review."}</span>
          <button className="btn" onClick={spinUp} disabled={busy || !idea.trim()}>{busy ? "Working…" : output === "auto" ? "Plan it →" : "Spin up →"}</button>
        </div>
      </div>

      {planErr && <div className="log" style={{ color: "var(--red)" }}>{planErr}</div>}

      {plan && (
        <div className="plan">
          <div className="plan-h">
            <div className="t">{plan.title}</div>
            <button className="btn" onClick={generateAll} disabled={generating}>{generating ? "Generating…" : "Generate all →"}</button>
          </div>
          {plan.summary && <p className="why">{plan.summary}</p>}
          <div className="shots">
            {plan.shots.map((s) => (
              <div className="shot" key={s.n}>
                <span className="n">{s.n}</span>
                <div>
                  <div className="sh">{s.label}{s.disclosure && <span className="flag"> · AI presenter (label on post)</span>}</div>
                  <div className="sd">{s.prompt}{s.spokenLine && <> — <em>“{s.spokenLine}”</em></>}</div>
                  {s.engineWhy && <div className="sd" style={{ opacity: 0.7 }}>↳ {s.engineWhy}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <span className="eng">{ENGINE_LABEL[s.engine] || s.engine}</span>
                  <button className="btn ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => runGenerate(shotBody(s), s.label)} disabled={generating}>Generate</button>
                </div>
              </div>
            ))}
          </div>
          {plan.voice && <div className="sd" style={{ marginTop: 10 }}>+ Voiceover: <em>“{plan.voice.script.slice(0, 90)}…”</em></div>}
          {plan.music && <div className="sd">+ Music: {plan.music.prompt}</div>}
          {plan.guardrailFlags?.length > 0 && <div className="gflags">⚠ Guardrails: {plan.guardrailFlags.join(" · ")}</div>}
        </div>
      )}

      <div className="bar" style={{ position: "static", marginTop: 4 }}>
        <div className="tally">Generated this session <b>{results.length}</b> · <a className="link" href="/review">Open review queue →</a></div>
      </div>
      {err && <div className="log" style={{ color: "var(--red)" }}>{err}</div>}

      {results.length > 0 && (
        <div className="rgrid">
          {results.map((r) => (
            <div className="rcard" key={r.key}>
              {r.type === "image" && r.ad_url && <div className="thumb"><img src={r.ad_url} alt={r.headline} /></div>}
              {r.type === "video" && (
                <div className="thumb">
                  {r.status === "rendering" ? <div className="rendering">Rendering…</div> : r.status === "failed" ? <div className="rendering bad">Failed: {r.error}</div> : <video src={r.result_url} muted loop autoPlay playsInline controls />}
                </div>
              )}
              {(r.type === "voice" || r.type === "music") && (
                <div className="thumb" style={{ display: "grid", placeItems: "center", minHeight: 90 }}>
                  {r.status === "rendering" ? <div className="rendering">{r.type === "voice" ? "Voicing…" : "Composing…"}</div> : r.status === "failed" ? <div className="rendering bad">Failed: {r.error}</div> : <audio src={r.url} controls />}
                </div>
              )}
              <div className="rbody">
                {(r.headline || r.label) && <div className="rh">{r.headline || r.label}</div>}
                {r.body && <div className="rt">{r.body}</div>}
                {r.cta && <div className="rcta">{r.cta} →</div>}
                <div className="rmeta">
                  <span className="tag">{r.type}</span>
                  {r.pricing_flag && <span className="tag flag">{r.pricing_flag}</span>}
                  {(r.type === "voice" || r.type === "music") && r.url && <a className="link" href={r.url} download>download</a>}
                  {(r.type === "image" || r.type === "video") && <a className="link" href="/review">review →</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
