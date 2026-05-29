"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/create", label: "Create" },
  { href: "/review", label: "Review & Approve" },
  { href: "/budget", label: "Budget" },
  { href: "/monitor", label: "Monitor" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="side">
      <div className="brand">Revarity <em>Ads</em></div>
      <div className="brand-sub">ads.revarity.com · operator hub</div>
      <nav className="nav">
        {ITEMS.map((it) => {
          const on = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} className={on ? "on" : ""}>
              <span className="dot" />{it.label}
            </Link>
          );
        })}
      </nav>
      <div className="side-foot">Wired to the live engine · no publish, no spend (D-04) · Malcolm &amp; David</div>
    </aside>
  );
}
