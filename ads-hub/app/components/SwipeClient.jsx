"use client";
import { useEffect, useState, useCallback } from "react";

export default function SwipeClient() {
  const [refs, setRefs] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/swipe", { cache: "no-store" });
    const d = await r.json();
    setRefs(d.refs || []); setPatterns(d.patterns || null);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body, label) {
    setErr(""); setBusy(label);
    try {
      const r = await fetch("/api/swipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "failed");
      setRefs(d.refs || []); setPatterns(d.patterns || null);
      if (body.action === "add") { setText(""); setSource(""); }
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(""); }
  }

  const Bucket = ({ title, items }) => items?.length ? (
    <div className="pbucket">
      <div className="pbk">{title}</div>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  ) : null;

  return (
    <>
      <div className="eyebrow">— Mine winners —</div>
      <h1>Learn what <em>works</em></h1>
      <p className="lead">Paste ads that are working in our space (sort a competitor by impressions + longevity in the Meta Ad Library, or drop any swipe you like). The miner extracts the reusable <b>framework</b> — never the wording — so the generator can make original ads in the same spirit. These patterns feed Create.</p>
      <div className="gate"><span>Honest scope: the Meta Ad Library API doesn't return US/CA short-term-rental ads, so winners are added by hand here (or later via a paid spy tool — decision D-11). The miner generalizes whatever you give it. Publishes nothing.</span></div>

      <div className="two">
        <div>
          <label className="l">Add a winning ad (paste its copy)</label>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the competitor / swipe ad copy. Note why you think it works if you like." />
          <input style={{ marginTop: 8 }} value={source} onChange={(e) => setSource(e.target.value)} placeholder="optional source (e.g. @competitor · 90 days active)" />
          <div className="row" style={{ margin: "10px 0 0" }}>
            <button className="btn ghost" onClick={() => post({ action: "add", ref: { text, source } }, "add")} disabled={busy === "add" || !text.trim()}>{busy === "add" ? "Adding…" : "+ Add reference"}</button>
            <button className="btn" onClick={() => post({ action: "mine" }, "mine")} disabled={busy === "mine" || refs.length === 0}>{busy === "mine" ? "Mining…" : `Mine patterns (${refs.length}) →`}</button>
          </div>
          {err && <div className="log" style={{ color: "var(--red)" }}>{err}</div>}
        </div>

        <div className="drop">
          <label className="l">References ({refs.length})</label>
          {refs.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>None yet. Add a few winners, then mine.</p> : (
            <div className="reflist">
              {refs.map((r, i) => (
                <div className="refitem" key={i}>
                  <div className="reftext">{(r.text || "").slice(0, 160)}{(r.text || "").length > 160 ? "…" : ""}</div>
                  {r.source && <div className="refsrc">{r.source}</div>}
                  <button className="refx" onClick={() => post({ action: "remove", index: i }, `rm${i}`)} title="remove">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sec"><h2>Extracted patterns {patterns?.minedAt && <span className="muted" style={{ fontSize: 12 }}>· {patterns.sourceCount} refs · {new Date(patterns.minedAt).toLocaleString()}</span>}</h2><a className="link" href="/create">Use in Create →</a></div>
      {!patterns ? (
        <div className="gate"><span>No patterns yet — add references and hit <b>Mine patterns</b>. The copy generator will draw on these.</span></div>
      ) : (
        <div className="pgrid">
          <Bucket title="Hooks" items={patterns.hooks} />
          <Bucket title="Angles" items={patterns.angles} />
          <Bucket title="Formats" items={patterns.formats} />
          <Bucket title="Copy frameworks" items={patterns.copy_frameworks} />
          <Bucket title="Do" items={patterns.do} />
          <Bucket title="Don't" items={patterns.dont} />
        </div>
      )}
    </>
  );
}
