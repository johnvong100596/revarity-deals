"use client";
import { useEffect, useState } from "react";

export default function WeeklySummary() {
  const [s, setS] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/summary", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setS(d.summary)).catch(() => {});
  }, []);

  if (!s) return <div className="gate"><span>Building this week's snapshot…</span></div>;

  async function copy() {
    try { await navigator.clipboard.writeText(s.text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  }

  return (
    <>
      <div className="grid cards4">
        <div className="stat"><div className="k">Added this week</div><div className="v">{s.weekGen}</div><div className="sub">{s.hubGen} hub-generated</div></div>
        <div className="stat"><div className="k">QA pass rate</div><div className="v good">{s.qaPassRate}%</div><div className="sub">{s.qa.pass} pass · {s.qa.review} to review · {s.qa.fail} fail</div></div>
        <div className="stat"><div className="k">Approved / awaiting</div><div className="v">{s.approved}<small> / {s.awaiting}</small></div><div className="sub">{s.reject} rejected · {s.hold} held</div></div>
        <div className="stat"><div className="k">Plan → leads</div><div className="v good">~{s.estLeads}</div><div className="sub">${s.budgetMonthly.toLocaleString()}/mo at ≤ ${s.cpl} CPL</div></div>
      </div>
      <div className="summary">
        <div className="summary-head"><span>Weekly summary for Malcolm</span><button className="btn ghost" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button></div>
        <pre>{s.text}</pre>
      </div>
    </>
  );
}
