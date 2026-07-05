"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Home "Recent creatives" gallery. Cards pop on hover; click opens a review lightbox (no navigation).
// The kebab menu keeps the D-04 guardrail: "Approve & send to Schedule" only writes an approve DECISION
// (a human still launches it on /schedule) — nothing publishes or spends here. "Remake" reopens Create.
const isVideo = (u = "") => /\.(mp4|webm|mov)(\?|$)/i.test(u);

// Frozen-until-hover preview: thumbnails no longer all autoplay at once (that pegged the browser with a
// full gallery). Each clip parks on its first frame (#t=0.1 poster) and plays only while hovered. Click
// still bubbles to the card button → opens the lightbox (which plays with controls).
function HoverVideo({ src }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const frozen = src && src.includes("#") ? src : `${src}#t=0.1`;
  const play = () => { const v = ref.current; if (v) v.play().then(() => setPlaying(true)).catch(() => {}); };
  const stop = () => { const v = ref.current; if (!v) return; v.pause(); try { v.currentTime = 0.1; } catch {} setPlaying(false); };
  return (
    <div className="vprev" onMouseEnter={play} onMouseLeave={stop}>
      <video ref={ref} src={frozen} muted loop playsInline preload="metadata" tabIndex={-1} />
      {!playing && <span className="vprev-play" aria-hidden="true">▶</span>}
    </div>
  );
}
const badgeClass = (qa) => (qa === "pass" ? "ok" : qa === "fail" ? "bad" : "warn");

export default function CreativeGallery({ creatives = [] }) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null); // { msg, err }
  const [removed, setRemoved] = useState({}); // locally hidden after Remove (server re-filters on next load)

  // Remove → 30-day trash. Same soft-delete the Review queue uses; the card vanishes here instantly.
  async function removeAd(c) {
    if (!window.confirm("Remove this ad? It disappears from everywhere. (You can bring it back from Trash on the approvals page for 30 days.)")) return;
    setMenuId(null); setLightbox(null);
    try {
      const res = await fetch("/api/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [c.id] }) });
      if (!res.ok) throw new Error(`remove failed (${res.status})`);
      setRemoved((p) => ({ ...p, [c.id]: true }));
      setToast({ msg: "Removed — it's in Trash on the approvals page for 30 days." });
    } catch (e) {
      setToast({ msg: `Couldn't remove — ${e.message || e}`, err: true });
    }
  }

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  function remake(c) {
    setMenuId(null); setLightbox(null);
    router.push(`/create?remake=${encodeURIComponent(c.id)}&brief=${encodeURIComponent(c.headline || "")}`);
  }

  // D-04 safe: read the full decisions map, merge one approve, write it back, then hand off to Schedule.
  async function approveAndSchedule(c) {
    if (busyId) return;
    setMenuId(null); setBusyId(c.id);
    try {
      const q = await (await fetch("/api/queue", { cache: "no-store" })).json();
      const decisions = { ...(q.decisions || {}), [c.id]: "approve" };
      const res = await fetch("/api/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
      });
      if (!res.ok) throw new Error(`approve failed (${res.status})`);
      router.push("/schedule");
    } catch (e) {
      setBusyId(null);
      setToast({ msg: `Couldn't approve — ${e.message || e}`, err: true });
    }
  }

  function Actions({ c, layout }) {
    const busy = busyId === c.id;
    return (
      <div className={layout === "lightbox" ? "lb-acts" : "cg-menu"} role="menu">
        {layout !== "lightbox" && (
          <button role="menuitem" onClick={() => { setMenuId(null); setLightbox(c); }}>
            <span className="mi-ico">⤢</span> Review
          </button>
        )}
        <button role="menuitem" className={layout === "lightbox" ? "btn" : ""} disabled={busy} onClick={() => approveAndSchedule(c)}>
          {layout === "lightbox"
            ? (busy ? "Approving…" : "Approve & send to Schedule →")
            : (<><span className="mi-ico">✓</span><span>{busy ? "Approving…" : "Approve & send to Schedule"}<span className="mi-sub">You launch it — nothing posts automatically</span></span></>)}
        </button>
        <button role="menuitem" className={layout === "lightbox" ? "btn ghost" : ""} onClick={() => remake(c)}>
          {layout === "lightbox" ? "Remake with your ideas ↻" : (<><span className="mi-ico">↻</span> Remake with your ideas</>)}
        </button>
        {layout !== "lightbox" && <>
          <div className="sep" />
          <button role="menuitem" onClick={() => { setMenuId(null); router.push("/review"); }}>
            <span className="mi-ico">↗</span> Open in review queue
          </button>
          <button role="menuitem" onClick={() => removeAd(c)}>
            <span className="mi-ico">🗑</span><span>Remove<span className="mi-sub">Goes to a 30-day Trash — not gone forever</span></span>
          </button>
        </>}
      </div>
    );
  }

  return (
    <>
      <div className="sgrid">
        {creatives.filter((c) => !removed[c.id]).map((c) => (
          <div className={"cg-card" + (menuId === c.id ? " menu-open" : "")} key={c.id}>
            <button className="cg-open" onClick={() => setLightbox(c)} aria-label={`Review ${c.headline || "creative"}`}>
              <div className={`sg-frame ${c.vertical ? "v" : "sq"}`}>
                {isVideo(c.src)
                  ? <HoverVideo src={c.src} />
                  : <img src={c.src} alt={c.headline} loading="lazy" />}
                <div className="sg-badges">
                  <span className={`chip ${badgeClass(c.qa)}`}>QA {c.qa}</span>
                  {c.pricing_flag && <span className="chip warn">{c.pricing_flag}</span>}
                </div>
              </div>
              <div className="sg-cap">
                <div className="sg-h">{(c.headline || "").slice(0, 48)}</div>
                <div className="sg-m">{c.angle_id} · {c.spec}</div>
              </div>
            </button>
            <button
              className="cg-kebab"
              aria-label="Actions"
              aria-haspopup="menu"
              aria-expanded={menuId === c.id}
              onClick={() => setMenuId(menuId === c.id ? null : c.id)}
            >⋯</button>
            {menuId === c.id && <Actions c={c} />}
          </div>
        ))}
      </div>
      {menuId && <div className="cg-menu-scrim" onClick={() => setMenuId(null)} />}

      {lightbox && (
        <div className="lightbox" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <button className="lb-close" aria-label="Close" onClick={() => setLightbox(null)}>✕</button>
          <div className="lb-card">
            <div className="lb-media">
              {isVideo(lightbox.src)
                ? <video src={lightbox.src} autoPlay loop muted playsInline controls />
                : <img src={lightbox.src} alt={lightbox.headline} />}
            </div>
            <div className="lb-body">
              <div className="lb-meta">
                <span className={`chip ${badgeClass(lightbox.qa)}`}>QA {lightbox.qa}</span>
                {lightbox.angle_id && <span className="tag">{lightbox.angle_id}</span>}
                {lightbox.spec && <span className="tag">{lightbox.spec}</span>}
                {lightbox.pricing_flag && <span className="tag flag">{lightbox.pricing_flag}</span>}
              </div>
              {lightbox.headline && <div className="lb-h">{lightbox.headline}</div>}
              {lightbox.body && <p className="lb-txt">{lightbox.body}</p>}
              {lightbox.cta && <div className="lb-cta">{lightbox.cta} →</div>}
              <Actions c={lightbox} layout="lightbox" />
            </div>
          </div>
        </div>
      )}

      {toast && <div className={"cg-toast" + (toast.err ? " err" : "")}>{toast.msg}</div>}
    </>
  );
}
