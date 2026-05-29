"use client";
import { useState } from "react";

export default function CreateClient({ angles, formats }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");
  const [err, setErr] = useState("");

  async function run() {
    setErr(""); setLog(""); setRunning(true);
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clean: true }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "run failed");
      setLog(data.log || "(no output)");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="eyebrow">— Create a run —</div>
      <h1>Spin up <em>creatives</em></h1>
      <p className="lead">Run the pipeline: generate copy + image prompts → render (Nano Banana) → auto-QA → regenerate failures. Output lands in the Review queue. The engine never publishes (D-04).</p>

      <div className="row">
        <div className="fld"><label className="l">Angles (configured)</label>
          <select multiple size={Math.min(5, angles.length)} defaultValue={angles.slice(0, 2).map((a) => a.id)}>
            {angles.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select>
        </div>
        <div className="fld"><label className="l">Formats</label>
          <select multiple size={Math.min(5, formats.length)} defaultValue={formats.slice(0, 2).map((f) => f.name)}>
            {formats.map((f) => <option key={f.name} value={f.name}>{f.name} · {f.dims}</option>)}
          </select>
        </div>
      </div>

      <div className="gate"><span>Run parameters currently come from <code>RUN</code> in <code>engine.mjs</code>. This button triggers the live pipeline as configured there. (Wiring the selectors above to write the run config is the next refinement.)</span></div>

      <button className="btn" onClick={run} disabled={running}>{running ? "Running pipeline…" : "Run pipeline →"}</button>
      {err && <div className="log" style={{ color: "var(--red)" }}>{err}</div>}
      {log && <div className="log">{log}</div>}
    </>
  );
}
