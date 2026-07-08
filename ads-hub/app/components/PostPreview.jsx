"use client";
import { useState } from "react";

// One faithful in-feed post mockup — Instagram OR Facebook — from normalized media + copy.
// Shared by the Quick-post composer's live preview and the Review expand-modal, so "what you
// see" is identical in both. Presentation only. media: [{ type:"image"|"video", src }].
const navBtn = (side) => ({ position: "absolute", top: "50%", [side]: 8, transform: "translateY(-50%)", width: 30, height: 30, borderRadius: 999, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.9)", color: "#111", fontSize: 18, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" });
const Avatar = () => (
  <span style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0, background: "conic-gradient(from 210deg, #d9a859, #7e6128, #d9a859)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>R</span>
);

export default function PostPreview({ platform = "instagram", media = [], caption = "", headline = "", cta = "Learn more", vertical = false, disclaimer = "" }) {
  const [idx, setIdx] = useState(0);
  const items = (media || []).filter((m) => m && m.src);
  const cur = items[Math.min(idx, Math.max(0, items.length - 1))] || null;
  const multi = items.length > 1;
  const cleanCta = cta && cta.trim().length > 1 && cta.length < 28 ? cta.trim() : "Learn more";
  const aspect = platform === "facebook" ? (vertical ? "9 / 16" : "1 / 1") : (vertical ? "9 / 16" : "4 / 5");

  const MediaEl = () =>
    !cur ? (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a9a9a", fontSize: 13, background: "#f2f2f4" }}>Add a photo to preview →</div>
    ) : cur.type === "video" ? (
      <video src={cur.src.includes("#") ? cur.src : `${cur.src}#t=0.1`} autoPlay muted loop playsInline controls style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }} />
    ) : (
      <img src={cur.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    );

  const Frame = () => (
    <div style={{ position: "relative", aspectRatio: aspect, width: "100%", background: "#000", overflow: "hidden" }}>
      <MediaEl />
      {multi && (
        <>
          <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{idx + 1}/{items.length}</div>
          {idx > 0 && <button type="button" onClick={() => setIdx((i) => i - 1)} aria-label="Previous photo" style={navBtn("left")}>‹</button>}
          {idx < items.length - 1 && <button type="button" onClick={() => setIdx((i) => i + 1)} aria-label="Next photo" style={navBtn("right")}>›</button>}
          <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
            {items.map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: i === idx ? "#fff" : "rgba(255,255,255,0.5)" }} />)}
          </div>
        </>
      )}
    </div>
  );

  const Disclaimer = () => disclaimer ? <div style={{ marginTop: 6, fontSize: 11, fontStyle: "italic", color: "#8a8a8a" }}>{disclaimer}</div> : null;

  return (
    <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 34px rgba(0,0,0,0.16)", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {platform === "instagram" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px" }}>
            <Avatar />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>revarity</div><div style={{ fontSize: 11, color: "#737373" }}>Sponsored</div></div>
            <span style={{ color: "#737373" }}>⋯</span>
          </div>
          <Frame />
          <div style={{ padding: "9px 12px 4px", fontSize: 21, letterSpacing: 8 }}>♡ 💬 ➤<span style={{ float: "right", letterSpacing: 0 }}>🔖</span></div>
          <div style={{ padding: "0 12px 14px", fontSize: 13, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>1,204 likes</div>
            <div style={{ whiteSpace: "pre-wrap" }}><b>revarity</b> {caption}</div>
            <Disclaimer />
            <div style={{ marginTop: 10 }}><div style={{ textAlign: "center", border: "1px solid #dbdbdb", background: "#fafafa", borderRadius: 8, padding: "9px", fontWeight: 600, fontSize: 13 }}>{cleanCta} ›</div></div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 12px 8px" }}>
            <Avatar />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Revarity</div><div style={{ fontSize: 11, color: "#65676b" }}>Sponsored · 🌐</div></div>
            <span style={{ color: "#65676b" }}>⋯</span>
          </div>
          <div style={{ padding: "0 12px 10px", fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{caption}<Disclaimer /></div>
          <Frame />
          <div style={{ background: "#f0f2f5", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#65676b", textTransform: "uppercase" }}>revarity.com</div>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headline || (caption ? caption.slice(0, 60) : "Your Airbnb, done-for-you")}</div>
            </div>
            <div style={{ background: "#e4e6eb", borderRadius: 6, padding: "8px 14px", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{cleanCta}</div>
          </div>
          <div style={{ padding: "8px 12px", fontSize: 13, color: "#65676b", display: "flex", justifyContent: "space-around", borderTop: "1px solid #eceef0" }}><span>👍 Like</span><span>💬 Comment</span><span>↪ Share</span></div>
        </>
      )}
    </div>
  );
}
