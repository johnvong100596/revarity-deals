"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ⌘K / Ctrl+K command menu (D-16 rule 3): every tool reachable in two keystrokes at zero
 * visual cost. New tools land HERE by default, not on a toolbar — the surface stays quiet
 * while the studio grows. Zero pixels when closed (a hint lives in the sidebar footer).
 */
export default function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => [
    { label: "Make an ad", hint: "Create", run: () => router.push("/create") },
    { label: "Your approvals", hint: "Review & approve", run: () => router.push("/review") },
    { label: "Open Trash", hint: "removed ads, 30-day recovery", run: () => router.push("/review#trash") },
    { label: "Overview", hint: "home", run: () => router.push("/") },
    { label: "Mine winners", hint: "swipe file", run: () => router.push("/swipe") },
    { label: "Schedule", hint: "launch calendar", run: () => router.push("/schedule") },
    { label: "Budget", hint: "monthly plan + leads", run: () => router.push("/budget") },
    { label: "Monitor", hint: "performance", run: () => router.push("/monitor") },
    { label: "Settings", hint: "connections, models, library", run: () => router.push("/settings") },
    { label: "Guide", hint: "how the hub works", run: () => router.push("/welcome") },
  ], [router]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => `${it.label} ${it.hint}`.toLowerCase().includes(needle));
  }, [q, items]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); setQ(""); setIdx(0); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10); }, [open]);
  useEffect(() => { setIdx(0); }, [q]);

  if (!open) return null;
  const runItem = (it) => { setOpen(false); it.run(); };

  return (
    <div className="cmdk-scrim" onClick={() => setOpen(false)}>
      <div className="cmdk" role="dialog" aria-label="Command menu" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Type to jump anywhere…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && filtered[idx]) runItem(filtered[idx]);
          }}
        />
        <div className="cmdk-list">
          {filtered.length === 0 && <div className="cmdk-empty">Nothing matches — try "ad", "trash", or "budget".</div>}
          {filtered.map((it, i) => (
            <button key={it.label} className={`cmdk-item ${i === idx ? "on" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => runItem(it)}>
              <span>{it.label}</span><span className="cmdk-hint">{it.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
