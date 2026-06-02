"use client";
import { useEffect, useState } from "react";

// Reusable full-screen picker modal (mirrors the Higgsfield "HOOKS THAT STOP THE SCROLL" /
// "SETTINGS THAT SET THE SCENE" panels): title + subtitle, optional category tabs, search, and a card
// grid (thumbnail + label + description). Picking a card returns the item and closes.
export default function StudioPicker({ open, onClose, title, subtitle, tabs = [], items = [], selected, onPick }) {
  const [tab, setTab] = useState(tabs[0] || "All");
  const [q, setQ] = useState("");

  useEffect(() => { if (open) { setTab(tabs[0] || "All"); setQ(""); } }, [open]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const ql = q.trim().toLowerCase();
  const list = items.filter((it) => {
    const matchTab = !tabs.length || tab === "All" || it.cat === tab;
    const matchQ = !ql || `${it.label} ${it.desc || ""}`.toLowerCase().includes(ql);
    return matchTab && matchQ;
  });

  return (
    <div className="pk-scrim" onClick={onClose}>
      <div className="pk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <button className="pk-x" onClick={onClose} aria-label="Close">✕</button>
        <div className="pk-head">
          <div className="pk-title">{title}</div>
          {subtitle && <div className="pk-sub">{subtitle}</div>}
        </div>
        <div className="pk-controls">
          {tabs.length > 0 && (
            <div className="pk-tabs">
              {tabs.map((t) => <button key={t} className={"pk-tab" + (t === tab ? " on" : "")} onClick={() => setTab(t)}>{t}</button>)}
            </div>
          )}
          <input className="pk-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search" />
        </div>
        <div className="pk-grid">
          {list.length === 0 && <div className="muted" style={{ padding: "20px 4px" }}>No matches.</div>}
          {list.map((it) => (
            <button key={it.value} className={"pk-card" + (selected === it.value ? " on" : "")} onClick={() => { onPick(it); onClose(); }}>
              <div className="pk-thumb" style={it.thumb ? { backgroundImage: `url(${it.thumb})` } : {}}>
                {!it.thumb && <span className="pk-thumb-ph">{it.label}</span>}
                {it.cat && <span className="pk-tag">{it.cat}</span>}
              </div>
              <div className="pk-card-b">
                <div className="pk-card-t">{it.label}</div>
                {it.desc && <div className="pk-card-d">{it.desc}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
