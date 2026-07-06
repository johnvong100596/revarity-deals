"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { claimViolationsFor, getBrand } from "@/lib/brands";
import { estimateCredits } from "@/lib/computeCost";

// The claims lock at the APPROVE gate (engine-audit P0-3), BRAND-ROUTED (D-19): each card is checked
// by ITS brand's regime — an ATD card by the ATD lock (ROI/income/APR/DM-CTA), a Revarity card by the
// money-arc lock. Client-side env flags read locked (server-only), which is the safe default.
function claimsBlock(c) {
  const brand = c.brand || "revarity";
  const text = [c.headline, c.body, c.cta, c.script, c.caption].filter(Boolean).join("\n");
  const hits = claimViolationsFor(brand, text);
  if (hits.length) return `Claims lock (${getBrand(brand).label}): ${[...new Set(hits.map((h) => h.kind))].join(", ")} — this can't ship. Rebuild it clean before approving.`;
  if (brand === "revarity" && /\b(\$\s?0|zero)[\s-]*down\b/i.test(text) && !c.disclaimer) return "This ad makes the $0-down offer but has no disclaimer end card — route it through the money-arc pipeline, which burns the disclaimer in.";
  return null;
}
const BRAND_BADGE = { revarity: "Revarity", atd: "AnalyzeTheDeal" };

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

// Meta Ads Manager deep-link for an APPROVED money-arc draft. A link, never an API call —
// uploading, picking the Messages objective and declaring AI-generated media stay human (D-04).
const META_ACT = process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID || "";
const metaCreateHref = () => `https://adsmanager.facebook.com/adsmanager/creation${META_ACT ? `?act=${META_ACT}` : ""}`;

// The playbook's two QC gates, as human ticks on a money-arc card. Gate 2 shows the
// machine precheck (from the render batch) but the tick itself is the reviewer's.
function QcGates({ c, g, onTick }) {
  if (!c.qc) return null;
  const checks = c.qc.gate2?.checks || {};
  const rows = [
    ["onlyVerifiedClaim", "only the verified claim in VO/on-screen"],
    ["disclaimerOnEndCard", "disclaimer on the end card"],
    ["dmKeyword", `DM keyword present`],
    ["captionsInSafeZones", "captions in safe zones"],
    ["lengthInWindow", `15–20s (this one: ${checks.durationSec ?? "?"}s)`],
  ];
  return (
    <div className="qc-gates">
      <label className="qc-gate" title="Gate 1 of 2 — play the ad: does Zoe's read land for this register? (calm/expensive for brand, natural for UGC)">
        <input type="checkbox" checked={!!g.voice} onChange={() => onTick("voice")} />
        <span><b>Voice read</b>{c.qc.gate1?.voPending ? " — ⚠️ VO pending, captions only (check caption timing instead)" : c.qc.gate1?.voProvider ? ` — VO: ${c.qc.gate1.voProvider}` : ""}</span>
      </label>
      <label className="qc-gate" title="Gate 2 of 2 — final claims check. The ticks below are the machine precheck; confirm them with your own eyes before checking this box.">
        <input type="checkbox" checked={!!g.claims} onChange={() => onTick("claims")} />
        <span><b>Final claims check</b></span>
      </label>
      <ul className="qc-checks">
        {rows.map(([k, label]) => (
          <li key={k} className={checks[k] ? "ok" : "bad"}>{checks[k] ? "✓" : "✗"} {label}</li>
        ))}
      </ul>
    </div>
  );
}

// Every deliverable for one money-arc draft — both placements + both carousel sets.
// Local files always (playbook): download, then upload to Meta by hand.
function DownloadRow({ c }) {
  if (!c.qc) return null;
  return (
    <div className="dl-row">
      <span className="muted">Files:</span>
      {c.video_url && <a className="link" href={c.video_url} download>Reels 9:16 ↓</a>}
      {c.video_url_feed && <a className="link" href={c.video_url_feed} download>Feed 4:5 ↓</a>}
      {Array.isArray(c.carousel_ig) && c.carousel_ig.length > 0 && (
        <span>IG carousel: {c.carousel_ig.map((u, i) => <a key={u} className="link" href={u} download>{i + 1}</a>).reduce((acc, x) => acc === null ? [x] : [...acc, " · ", x], null)}</span>
      )}
      {Array.isArray(c.carousel_tt) && c.carousel_tt.length > 0 && (
        <span>TT photo set: {c.carousel_tt.map((u, i) => <a key={u} className="link" href={u} download>{i + 1}</a>).reduce((acc, x) => acc === null ? [x] : [...acc, " · ", x], null)}</span>
      )}
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
  const [gates, setGates] = useState({}); // { id: { voice: bool, claims: bool } } — QC ticks per money-arc card
  const [reasons, setReasons] = useState({}); // { id: "why rejected" } — saved to the reject-reason log
  const [trash, setTrash] = useState([]); // soft-removed items (30-day recoverable)
  const [showTrash, setShowTrash] = useState(false);
  const [selecting, setSelecting] = useState(false); // bulk-select mode for clearing backlog
  const [selected, setSelected] = useState({}); // { id: true }
  const [barMore, setBarMore] = useState(false); // D-16: secondary tools recede into one ⋯ menu
  // deep link from the command menu: /review#trash opens straight into Trash
  useEffect(() => { try { if (window.location.hash === "#trash") setShowTrash(true); } catch {} }, []);

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
    setTrash(data.trash || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Remove → 30-day trash (soft delete; excluded from queue/gallery/counts/ranking) ──
  async function removeToTrash(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    const msg = list.length === 1
      ? "Remove this ad? It disappears from everywhere. (You can bring it back from Trash for 30 days.)"
      : `Remove these ${list.length} ads? They disappear from everywhere. (You can bring them back from Trash for 30 days.)`;
    if (!window.confirm(msg)) return;
    // A failed remove must FAIL LOUDLY — a silent return here reads as a dead button.
    const fail = (why) => { setSaved(`Remove failed — ${why}. Nothing changed; try again or refresh.`); setTimeout(() => setSaved(""), 7000); };
    try {
      const res = await fetch("/api/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: list }) });
      if (!res.ok) return fail(`server said ${res.status}`);
      setSelected({}); setSelecting(false);
      setSaved(`Removed ${list.length} — recoverable in Trash for 30 days.`); setTimeout(() => setSaved(""), 5000);
      await load();
    } catch (e) { fail(String(e?.message || e)); }
  }
  async function restoreFromTrash(id) {
    try {
      const res = await fetch("/api/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id], restore: true }) });
      if (!res.ok) { setSaved(`Restore failed — server said ${res.status}.`); setTimeout(() => setSaved(""), 6000); return; }
      await load();
    } catch (e) { setSaved(`Restore failed — ${String(e?.message || e)}.`); setTimeout(() => setSaved(""), 6000); }
  }
  const toggleSelect = (id) => setSelected((p) => ({ ...p, [id]: !p[id] }));
  const selectedIds = () => Object.keys(selected).filter((id) => selected[id]);

  const set = (id, s) => setState((p) => ({ ...p, [id]: p[id] === s ? undefined : s }));
  const tickGate = (id, key) => setGates((p) => ({ ...p, [id]: { ...p[id], [key]: !p[id]?.[key] } }));
  const gatesPassed = (id) => !!(gates[id]?.voice && gates[id]?.claims);
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
      const res = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisions: state, reasons }) });
      if (!res.ok) { setSaved("Save failed"); setTimeout(() => setSaved(""), 4000); return; }
      const data = await res.json();
      const when = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "now";
      setSaved(`Saved ${Object.values(data.decisions || {}).length} decisions at ${when}`);
    } catch { setSaved("Save failed"); }
    setTimeout(() => setSaved(""), 4000);
  }
  function exportSet() {
    const approved = queue.filter((c) => state[c.id] === "approve").map((c) => ({
      id: c.id, angle: c.angle_id, variant: c.variant, spec: c.spec, headline: c.headline, cta: c.cta,
      // money-arc drafts carry every placement (Phase-1b) — include them so the export is the full upload set
      ...(c.qc ? { video_reels: c.video_url, video_feed: c.video_url_feed, carousel_ig: c.carousel_ig, carousel_tt: c.carousel_tt, post_caption: c.caption, disclaimer: c.disclaimer } : {}),
    }));
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
    // Nothing renders without an explicit OK (engine-audit P0-1a / UX16).
    const isVideo = !!c.video_url;
    const est = Math.round(estimateCredits(isVideo ? "veo" : "image", varN) * 10) / 10;
    if (!window.confirm(`Create ${varN} variation${varN === 1 ? "" : "s"} of this ad? This will use about ${est} credits. Nothing runs without your OK.`)) return;
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
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          {selecting ? (
            <>
              <button className="btn ghost" onClick={() => setSelected(Object.fromEntries(active.map((c) => [c.id, true])))}>Select all</button>
              <button className="btn" onClick={() => removeToTrash(selectedIds())} disabled={!selectedIds().length}>Remove selected ({selectedIds().length})</button>
              <button className="btn ghost" onClick={() => { setSelecting(false); setSelected({}); }}>Cancel</button>
            </>
          ) : (
            <>
              {/* D-16: approve/remove on the cards is the screen's primary action; Save commits it.
                  Every other tool recedes into one ⋯ menu. */}
              <button className="btn" onClick={save}>Save decisions</button>
              <span className="bar-more-wrap">
                <button className="btn ghost" onClick={() => setBarMore((v) => !v)} aria-expanded={barMore} aria-haspopup="menu">⋯ More</button>
                {barMore && (
                  <span className="bar-menu" role="menu">
                    <button role="menuitem" onClick={() => { setBarMore(false); approveAllPass(); }}>Approve all that passed</button>
                    <button role="menuitem" onClick={() => { setBarMore(false); setSelecting(true); }} title="Pick several ads, then remove them all at once — they go to a 30-day Trash, not gone forever.">Select for bulk remove…</button>
                    <button role="menuitem" onClick={() => { setBarMore(false); exportSet(); }}>Export approved ↓</button>
                    <button role="menuitem" onClick={() => { setBarMore(false); setMode((m) => (m === "ink" ? "photo" : "ink")); }}>Backdrop: {mode === "ink" ? "Ink" : "Photo"} ⇄</button>
                    <span className="bar-menu-row">Versions per card <select value={varN} onChange={(e) => setVarN(Math.min(10, Math.max(1, Number(e.target.value) || 5)))}>{Array.from({ length: 10 }, (_, i) => i + 1).map((nn) => <option key={nn} value={nn}>{nn}</option>)}</select></span>
                  </span>
                )}
              </span>
              {barMore && <span className="bar-menu-scrim" onClick={() => setBarMore(false)} />}
            </>
          )}
        </div>
      </div>
      {loading ? <p className="muted">Loading queue…</p> : queue.length === 0 ? (
        <div className="empty-teach">
          <figure className="qc example" aria-hidden="true">
            <div className="qframe sq"><div className="example-frame"><span>your ad&rsquo;s preview</span></div></div>
            <div className="qbody">
              <div className="qmeta"><span className="tag">Example</span><span className="tag">Reels / Stories</span></div>
              <p className="qtext">Every ad lands here with its words, a check result, and three buttons: Approve, Hold, Reject. Nothing goes live until you approve it — and even then, you launch it yourself.</p>
              <div className="acts"><button className="ap" disabled>Approve</button><button className="hd" disabled>Hold</button><button className="rj" disabled>Reject</button></div>
            </div>
          </figure>
          <a className="btn" href="/create">Make your first ad →</a>
        </div>
      ) : (
        <>
        {active.length === 0 ? (
          <div className="gate"><span>No active concepts — everything is in <b>Rejected</b> below. Restore or delete them there.</span></div>
        ) : (
        <div className="q">
          {active.map((c) => {
            const st = state[c.id];
            const badge = c.qa === "pass" ? "" : c.qa === "fail" ? "bad" : "warn";
            const blocked = claimsBlock(c);
            return (
              <figure key={c.id} className={`qc ${getBrand(c.brand).tokenClass || ""} ${st === "approve" ? "appr" : st === "reject" ? "rej" : st === "hold" ? "hold" : ""} ${selecting && selected[c.id] ? "sel" : ""}`}>
                <div className={`qframe ${c.vertical ? "v" : "sq"}`}>
                  {selecting && (
                    <label className="sel-box" title="Select for bulk remove">
                      <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggleSelect(c.id)} />
                    </label>
                  )}
                  {c.video_url
                    ? <PreviewVideo src={c.video_url} />
                    : c.hasImg || c.ad_url || c.ad_photo_url || c.image_url
                      ? <img src={adSrc(c)} alt={c.headline} />
                      : <div className="example-frame"><span>idea — waiting for the next batch</span></div>}
                  <span className={`qbadge ${badge}`} title={c.qa !== "pass" && c.qa_reasons?.length ? c.qa_reasons[0] : undefined}>Check: {QA_LABEL[c.qa] || c.qa}</span>
                </div>
                <div className="qbody">
                  <div className="qmeta">
                    <span className={`tag brand-badge ${c.brand === "atd" ? "atd" : "rev"}`} title="Which brand this ad is for — its own claims regime and look.">{BRAND_BADGE[c.brand] || "Revarity"}</span>
                    <span className="tag">{c.angle_id}</span>{c.variant && c.variant !== "HUB" && <span className="tag">VAR {c.variant}</span>}<span className="tag">{SPEC_LABEL[c.spec] || c.spec}</span>
                    {c.submitted_by && <span className="tag flag" title="Sent in through the remote connector — drafts only; this queue is still the gate.">from {c.submitted_by}</span>}
                    {c.pricing_flag && <span className="tag flag">{c.pricing_flag}</span>}
                    {c.disclosure === "ai-presenter" && <span className="tag flag" title="AI presenter — not a real client. Apply the platform's AI-generated label when posting; no implied client, no return claims.">AI presenter · label on post</span>}
                  </div>
                  <p className="qtext">{c.body} <b>· {c.cta} →</b></p>
                  {c.script && <p className="qscript" title="What the presenter says on camera (Veo turns this into synced audio).">🎙 <em>“{c.script}”</em></p>}
                  <ScoreStrip s={c.scores} />
                  <QcGates c={c} g={gates[c.id] || {}} onTick={(k) => tickGate(c.id, k)} />
                  <DownloadRow c={c} />
                  {blocked && <div className="claims-block">⚠ {blocked}</div>}
                  <div className="acts">
                    <button
                      className={`ap ${st === "approve" ? "on" : ""}`}
                      disabled={st !== "approve" && (!!blocked || (!!c.qc && !gatesPassed(c.id)))}
                      title={blocked || (c.qc && !gatesPassed(c.id) ? "Tick both QC gates first — voice read + final claims check." : undefined)}
                      onClick={() => set(c.id, "approve")}
                    >Approve</button>
                    <button className={`hd ${st === "hold" ? "on" : ""}`} onClick={() => set(c.id, "hold")}>Hold</button>
                    <button className={`rj ${st === "reject" ? "on" : ""}`} onClick={() => set(c.id, "reject")}>Reject</button>
                  </div>
                  {st === "approve" && c.qc && (
                    <div className="meta-next">
                      <a className="link" href={metaCreateHref()} target="_blank" rel="noreferrer" title="Opens Meta Ads Manager. Upload the downloaded files, pick the Messages objective, and tick 'AI-generated' where asked (voice/captions). Nothing posts from here (D-04).">Open Meta Ads Manager →</a>
                      <span className="muted"> upload the files above · Messages objective · declare AI-generated media</span>
                    </div>
                  )}
                  <div className="card-foot">
                    <a className="link remake-link" href={remakeHref(c)} title="Open this in the studio with its idea prefilled — tweak and regenerate to perfect it.">✎ Edit &amp; remake</a>
                    <button className="link var-spin" onClick={() => spinVariations(c)} disabled={!!varBusy} title={`Make ${varN} versions of this ad — same script and background, different openings. They land in your approvals for review.`}>{varBusy === c.id ? "Creating…" : `✨ Make ${varN} versions`}</button>
                    <button className="link remove-link" onClick={() => removeToTrash(c.id)} title="Removes this ad from everywhere (queue, gallery, counts, rankings). It sits in Trash for 30 days in case you change your mind.">🗑 Remove</button>
                  </div>
                  {st === "reject" && (
                    <div className="rej-note">
                      Rejected — still here, not deleted. Click Reject again to undo.
                      <input
                        className="rej-reason"
                        type="text"
                        placeholder="Why? (saved to the reject log — helps the batch stop making this mistake)"
                        value={reasons[c.id] || ""}
                        onChange={(e) => setReasons((p) => ({ ...p, [c.id]: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </figure>
            );
          })}
        </div>
        )}
        {rejected.length > 0 && (
          <div className="rejected-wrap">
            <button className="btn ghost" onClick={() => setShowRejected((v) => !v)}>Rejected ({rejected.length}) {showRejected ? "▲" : "▼"}</button>
            <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>kept out of your approvals — click Remove to send one to the 30-day Trash</span>
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
                        <button className="rj" onClick={() => removeToTrash(c.id)}>Remove 🗑</button>
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
      {trash.length > 0 && (
        <div className="rejected-wrap">
          <button className="btn ghost" onClick={() => setShowTrash((v) => !v)}>Trash ({trash.length}) {showTrash ? "▲" : "▼"}</button>
          <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>removed from everywhere — each ad deletes itself for good after 30 days</span>
          {showTrash && (
            <div className="q rejected-q">
              {trash.map((c) => (
                <figure key={c.id} className="qc rej">
                  <div className={`qframe ${c.vertical ? "v" : "sq"}`}>
                    {c.video_url ? <PreviewVideo src={c.video_url} /> : <img src={adSrc(c)} alt={c.headline} />}
                  </div>
                  <div className="qbody">
                    <div className="qmeta"><span className="tag">{c.angle_id}</span><span className="tag">{SPEC_LABEL[c.spec] || c.spec}</span><span className="tag flag">{c.trash_days_left} days left</span></div>
                    <p className="qtext">{c.headline || c.body}</p>
                    <div className="acts">
                      <button className="hd" onClick={() => restoreFromTrash(c.id)}>Put it back</button>
                      <button className="rj" onClick={() => { if (window.confirm("Delete this ad forever, right now? This cannot be undone.")) removeCreative(c.id).then(() => restoreFromTrash(c.id)); }}>Delete now ✕</button>
                    </div>
                  </div>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
