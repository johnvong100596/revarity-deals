"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Grouped so it reads by job-to-be-done, not a flat list. Malcolm/David/Vu all see everything (no role gating).
const GROUPS = [
  { title: "", items: [{ href: "/", label: "Overview" }] },
  { title: "Make", items: [{ href: "/create", label: "Create" }, { href: "/swipe", label: "Mine winners" }] },
  { title: "Decide", items: [{ href: "/review", label: "Review & approve" }] },
  { title: "Publish", items: [{ href: "/schedule", label: "Schedule" }] },
  { title: "Plan", items: [{ href: "/budget", label: "Budget" }, { href: "/monitor", label: "Monitor" }] },
  { title: "", items: [{ href: "/settings", label: "Settings" }] },
];

export default function Sidebar() {
  const path = usePathname();
  const on = (href) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <aside className="side">
      <div className="brand">Revarity <em>Ads</em></div>
      <Link href="/create" className="side-cta">+ New creative</Link>
      <nav className="nav">
        {GROUPS.map((g, i) => (
          <div className="navgroup" key={i}>
            {g.title && <div className="navgroup-t">{g.title}</div>}
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={on(it.href) ? "on" : ""}><span className="dot" />{it.label}</Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
