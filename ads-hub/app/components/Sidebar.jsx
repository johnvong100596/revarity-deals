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

// Persistent left rail on desktop (a real studio sidebar); a slide-in drawer on narrow screens via the
// top-left toggle. The rail carries the brand, the primary CTA, grouped nav, and the operator footer.
export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer only
  const on = (href) => (href === "/" ? path === "/" : path.startsWith(href));
  const close = () => setOpen(false);

  useEffect(() => { close(); }, [path]); // close the drawer after navigating (mobile)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Mobile-only top bar with the menu toggle (hidden on desktop, where the rail is always present) */}
      <div className="topbar">
        <button className="side-toggle" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open
              ? (<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>)
              : (<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}
          </svg>
        </button>
        <Link href="/" className="brand" onClick={close}>Revarity <em>Ads</em></Link>
      </div>

      <div className={"side-scrim" + (open ? " on" : "")} onClick={close} aria-hidden="true" />

      <aside className={"side" + (open ? " open" : "")}>
        <Link href="/" className="brand side-brand" onClick={close}>Revarity <em>Ads</em></Link>
        <Link href="/create" className="side-cta" onClick={close}>+ New creative</Link>
        <nav className="nav">
          {GROUPS.map((g, i) => (
            <div className="navgroup" key={i}>
              {g.title && <div className="navgroup-t">{g.title}</div>}
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={on(it.href) ? "on" : ""} onClick={close}><span className="dot" />{it.label}</Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">ads.revarity.com · operator hub<br />proposes — never spends</div>
      </aside>
    </>
  );
}
