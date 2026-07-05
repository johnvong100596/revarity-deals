"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { estimateCredits, estimatePlan } from "@/lib/computeCost";

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
  const [nIdeas, setNIdeas] = useState(5); // batch size for variations / auto-concepts (1–10)

  const [showInsp, setShowInsp] = useState(() => !!sp.get("insp"));
  const [reference, setReference] = useState(() => sp.get("insp") || ""); // mine-winners → Create handoff
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

  // The promise split (UX14): what's on paper goes in the ad; the rest stays in DMs.
  const [claimsVerified, setClaimsVerified] = useState("");
  const [claimsNot, setClaimsNot] = useState("");
  // Nothing renders without an explicit OK (engine-audit P0-1a + UX16).
  const [confirm, setConfirm] = useState(null); // { label, credits, run }
  // The running compute meter (P0-1c).
  const [meter, setMeter] = useState(null);
  const refreshMeter = useCallback(async () => {
    try { const r = await fetch("/api/compute", { cache: "no-store" }); const d = await r.json(); if (d.ok) setMeter(d); } catch {}
  }, []);
  useEffect(() => { refreshMeter(); }, [refreshMeter]);
  const askConfirm = (label, credits, run) => setConfirm({ label, credits, run });
  const confirmRun = async () => { const c = confirm; setConfirm(null); if (c) { await c.run(); refreshMeter(); } };

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

  // Map a director shot to a /api/generate body. Claims fields ride EVERY generate so the
  // server-side claims lock sees the promise split no matter which path fired the shot.
  function shotBody(shot) {
    const base = { spec: shot.spec || format, directorPrompt: shot.prompt, headline: shot.headline, spokenLine: shot.spokenLine, angleId, targetSeconds: shot.durationSec || undefined, claimsVerified, claimsNot };
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
        body: JSON.stringify({ idea, inspiration: inspirationText(), wantVoice, wantMusic, output, format, angleId, targetSeconds: duration === "auto" ? null : Number(duration), claimsVerified, claimsNot }),
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
    } finally { setGenerating(false); refreshMeter(); }
  }

  // Forced single output (no director): generate directly from the idea.
  async function directGenerate() {
    setBusy(true); setErr("");
    try {
      const base = { spec: format, brief: idea, reference: inspirationText(), angleId, targetSeconds: duration === "auto" ? null : Number(duration), claimsVerified, claimsNot };
      if (output === "copy") await runGenerate({ ...base, type: "copy", n: 3 }, "Copy");
      else if (output === "image") await runGenerate({ ...base, type: "image" }, "Image");
      else if (output === "presenter") await runGenerate({ ...base, type: "video", mode: "presenter", engine: "veo" }, "Presenter");
      else await runGenerate({ ...base, type: "video", mode: "broll", engine: "veo" }, "Video"); // veo = top realism
      if (wantVoice) await makeAudio("voice", { text: voScript || idea }, "Voiceover");
      if (wantMusic && musicPrompt.trim()) await makeAudio("music", { prompt: musicPrompt }, "Music");
    } finally { setBusy(false); refreshMeter(); }
  }

  // Credit estimate for the forced-output path (the silent-spend click from the audit).
  function directEstimate() {
    let est = output === "copy" ? estimateCredits("copy") : output === "image" ? estimateCredits("image") : estimateCredits("veo");
    if (wantVoice) est += estimateCredits("voice");
    if (wantMusic && musicPrompt.trim()) est += estimateCredits("music");
    return Math.round(est * 10) / 10;
  }

  // Batch: up to 10 VARIATIONS of the current idea (similar script + background, varied hook).
  async function makeVariations() {
    setBusy(true); setPlanErr(""); setPlan(null); setErr("");
    try {
      const res = await fetch("/api/variations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, inspiration: inspirationText(), n: nIdeas, output, format, angleId, targetSeconds: duration === "auto" ? null : Number(duration) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "variations failed");
      setPlan(data.plan);
    } catch (e) { setPlanErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  // Batch: auto-generate up to 10 NEW concepts from the selected angle + recent designs.
  async function autoFromAngle() {
    setBusy(true); setPlanErr(""); setPlan(null); setErr("");
    try {
      const res = await fetch("/api/concepts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angleId, n: nIdeas, output, format }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "concept generation failed");
      setPlan(data.plan);
    } catch (e) { setPlanErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  // Auto = plan first (free, nothing renders). Forced output = confirm with the cost, THEN render.
  const spinUp = () =>
    output === "auto"
      ? planIt()
      : askConfirm(output === "copy" ? "Write 3 copy variants" : `Create 1 ${output}`, directEstimate(), directGenerate);

  return (
    <>
      <div className="eyebrow">— Spin up a creative —</div>
      <h1>The <em>studio</em></h1>
      <p className="lead">Describe the ad you want — or paste a full script (hook, scenes, lines, b-roll). The studio routes each shot to the engine that does it best, then drops everything in Review for your yes.</p>

      <div className="composer">
        <textarea className="idea" rows={6} value={idea} onChange={(e) => setIdea(e.target.value)}
          placeholder={'e.g. "A confident host walks through a Tulum penthouse and explains how we build Airbnbs for serious investors…" — or paste a full script with hook, scenes, lines, and a b-roll shot list.'} />

        <div className="promise-split">
          <div className="promise-col">
            <label className="l">Promises you can back up in writing</label>
            <textarea rows={2} value={claimsVerified} onChange={(e) => setClaimsVerified(e.target.value)}
              placeholder={'e.g. $0 down for qualified properties'} />
            <span className="helper">These can go in the ad.</span>
          </div>
          <div className="promise-col">
            <label className="l">Not confirmed yet</label>
            <textarea rows={2} value={claimsNot} onChange={(e) => setClaimsNot(e.target.value)}
              placeholder={'e.g. 0% APR available'} />
            <span className="helper">We&rsquo;ll keep these out of the video and mention them in your DMs instead. This protects you from ad bans and refund fights. Move them over once you have it on paper.</span>
          </div>
        </div>

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
          <span className="hint">{output === "auto" ? "Auto: the studio plans the shots and routes engines — planning is free; you approve before anything renders or posts (D-04)." : "Forced output — you'll see the cost and confirm before anything renders."}</span>
          {meter && <span className="meter" title={`Render-compute estimates this month by engine: ${Object.entries(meter.byKind || {}).map(([k, v]) => `${k} ~${v}`).join(" · ") || "nothing yet"}. Estimates, not an invoice.`}>Compute: ~{meter.month} cr this month · ~{meter.today} today</span>}
          <button className="btn" onClick={spinUp} disabled={busy || !idea.trim()}>{busy ? "Working…" : output === "auto" ? "Plan it →" : "Spin up →"}</button>
        </div>

        {confirm && (
          <div className="confirm-bar">
            <span><b>{confirm.label}.</b> This will use about <b>{confirm.credits} credits</b>. Nothing runs without your OK.</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={confirmRun}>OK — create it →</button>
              <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
            </span>
          </div>
        )}

        <div className="batch-foot">
          <span className="hint">Batch — up to 10 ideas at once, into Review (you still approve each):</span>
          <span className="chip-sel">Count <select value={nIdeas} onChange={(e) => setNIdeas(Math.min(10, Math.max(1, Number(e.target.value) || 5)))}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((nn) => <option key={nn} value={nn}>{nn}</option>)}
          </select></span>
          <button className="btn ghost" onClick={makeVariations} disabled={busy || !idea.trim()} title="Up to 10 variations of this concept — similar script & background, varied hook. Nothing posts; you review each.">✨ {nIdeas} variations</button>
          <button className="btn ghost" onClick={autoFromAngle} disabled={busy} title="Up to 10 fresh concepts from the selected angle + your recent designs. Nothing posts; you review each.">⚡ Auto: {nIdeas} from angle</button>
        </div>
      </div>

      {planErr && <div className="log" style={{ color: "var(--red)" }}>{planErr}</div>}

      {plan && (
        <div className="plan">
          <div className="plan-h">
            <div className="t">{plan.title}</div>
            <button className="btn" onClick={() => askConfirm(`Create all ${plan.shots.length} shots`, estimatePlan(plan), generateAll)} disabled={generating}>{generating ? "Generating…" : "Generate all →"}</button>
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
                  <button className="btn ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => askConfirm(`Create shot ${s.n} (${s.label})`, estimatePlan({ shots: [s] }), async () => { await runGenerate(shotBody(s), s.label); })} disabled={generating}>Generate</button>
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
