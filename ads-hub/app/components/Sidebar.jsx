"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Grouped so it reads by job-to-be-done, not a flat list. Malcolm/David/Vu all see everything (no role gating).
const GROUPS = [
  { title: "", items: [{ href: "/welcome", label: "Guide" }, { href: "/", label: "Overview" }] },
  { title: "Make", items: [{ href: "/create", label: "Create" }, { href: "/swipe", label: "Mine winners" }] },
  { title: "Decide", items: [{ href: "/review", label: "Review & approve" }] },
  { title: "Publish", items: [{ href: "/schedule", label: "Schedule" }] },
  { title: "Plan", items: [{ href: "/budget", label: "Budget" }, { href: "/monitor", label: "Monitor" }] },
  { title: "", items: [{ href: "/settings", label: "Settings" }] },
];

// Hidden on standard; the top-left toggle (next to the brand) slides it in. On desktop the open drawer
// pushes content (via the --side-w CSS var on :root); on narrow screens it overlays with a scrim.
export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false); // deterministic default → no hydration mismatch
  const on = (href) => (href === "/" ? path === "/" : path.startsWith(href));

  // restore the operator's last choice after mount (localStorage is client-only)
  useEffect(() => {
    try { if (localStorage.getItem("rev_sidebar_open") === "1") setOpen(true); } catch {}
  }, []);

  // reflect open-state as a CSS var so .main can shift right without touching the server layout
  useEffect(() => {
    try { document.documentElement.style.setProperty("--side-w", open ? "236px" : "0px"); } catch {}
  }, [open]);

  // Esc closes while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpenPersist(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const setOpenPersist = (v) => { setOpen(v); try { localStorage.setItem("rev_sidebar_open", v ? "1" : "0"); } catch {} };
  const toggle = () => setOpenPersist(!open);
  const close = () => setOpenPersist(false);
  // drawer now overlays centered content on all sizes → close on navigation everywhere
  const onNav = () => close();

  return (
    <>
      <div className="topbar">
        <button className="side-toggle" onClick={toggle} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open
              ? (<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>)
              : (<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}
          </svg>
        </button>
        <Link href="/" className="brand" onClick={onNav}>Revarity <em>Ads</em></Link>
      </div>

      <div className={"side-scrim" + (open ? " on" : "")} onClick={close} aria-hidden="true" />

      <aside className={"side" + (open ? " open" : "")} aria-hidden={!open}>
        <Link href="/create" className="side-cta" onClick={onNav}>+ New creative</Link>
        <nav className="nav">
          {GROUPS.map((g, i) => (
            <div className="navgroup" key={i}>
              {g.title && <div className="navgroup-t">{g.title}</div>}
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={on(it.href) ? "on" : ""} onClick={onNav}><span className="dot" />{it.label}</Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
