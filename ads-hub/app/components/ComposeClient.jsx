"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { claimViolations } from "@/lib/claims";
import PostPreview from "@/app/components/PostPreview";

// The SIMPLE path: name + caption + your photos + square/carousel + a disclaimer →
// live Instagram & Facebook preview → send to Review. No AI. The heavy Create/Director
// flow stays for generated ads; this is "here's my screenshot and my words, show me the post."
export default function ComposeClient() {
  const [name, setName] = useState("");
  const [caption, setCaption] = useState("");
  const [disclaimer, setDisclaimer] = useState("Results not typical.");
  const [cta, setCta] = useState("Comment SETUP");
  const [format, setFormat] = useState("carousel"); // square | carousel
  const [platform, setPlatform] = useState("instagram");

  const [library, setLibrary] = useState([]);
  const [selected, setSelected] = useState([]); // ordered library ids (photo 1, photo 2, …)
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const fileRef = useRef(null);

  const loadLib = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/library", { cache: "no-store" }); const d = await r.json(); setLibrary(d.photos || []); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { loadLib(); }, [loadLib]);

  const byId = Object.fromEntries(library.map((p) => [p.id, p]));
  const selectedUrls = selected.map((id) => byId[id]?.url).filter(Boolean);
  const previewUrls = format === "carousel" ? selectedUrls : selectedUrls.slice(0, 1);
  const media = previewUrls.map((src) => ({ type: "image", src }));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const claimsHit = claimViolations([caption, disclaimer, cta].filter(Boolean).join("\n"));
  const claimsMsg = claimsHit.length ? `Claims check: ${[...new Set(claimsHit.map((h) => h.kind))].join(", ")} — unconfirmed money/credit or urgency language can't ship. Move it to DM replies.` : "";

  async function upload(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type?.startsWith("image/"));
    if (!files.length) return;
    setBusy(true); setMsg(`Uploading ${files.length}…`);
    try {
      const fd = new FormData(); files.forEach((f) => fd.append("files", f));
      const r = await fetch("/api/library/upload", { method: "POST", body: fd });
      const d = await r.json();
      await loadLib();
      if (d.photos?.length) setSelected((s) => [...s, ...d.photos.map((p) => p.id)]); // auto-select what we just added
      setMsg(d.added ? `Added ${d.added} — selected for this post.` : `Upload failed${d.error ? ` — ${d.error}` : ""}`);
    } catch (e) { setMsg(`Upload failed — ${String(e?.message || e)}`); }
    setBusy(false); setTimeout(() => setMsg(""), 5000);
  }

  async function send() {
    if (busy) return;
    if (claimsHit.length) { setMsg(claimsMsg); return; }
    if (!caption.trim() && !selected.length) { setMsg("Add a caption or at least one photo."); return; }
    setBusy(true); setMsg("Sending to Review…");
    try {
      const r = await fetch("/api/compose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, caption, disclaimer, cta, format, photos: selected }) });
      const d = await r.json();
      if (r.status === 422) { setMsg(claimsMsg || "Claims check blocked this — adjust the copy."); setBusy(false); return; }
      if (!r.ok || !d.ok) { setMsg(`Couldn't send — ${d.error || r.status}.`); setBusy(false); return; }
      setSent(true); setMsg("");
    } catch (e) { setMsg(`Couldn't send — ${String(e?.message || e)}`); }
    setBusy(false);
  }

  const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, marginTop: 14 };
  const inp = { width: "100%", font: "inherit", padding: "9px 11px", borderRadius: 9, border: "1px solid var(--line, rgba(0,0,0,0.16))", background: "var(--bg-card, #fff)" };

  if (sent) {
    return (
      <>
        <div className="eyebrow">— Quick post —</div>
        <h1>Sent to <em>Review</em> ✓</h1>
        <p className="lead">Your post is waiting in Review with its Instagram &amp; Facebook preview. Approve it there, then post it to your own channel — nothing goes out on its own.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <a className="btn" href="/review">Open Review →</a>
          <button className="btn ghost" onClick={() => { setSent(false); setCaption(""); setName(""); setSelected([]); }}>Make another</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="eyebrow">— Quick post —</div>
      <h1>Make a <em>post</em></h1>
      <p className="lead">Your caption, your photos — see exactly how it lands on Instagram and Facebook, tweak it, then send it to Review. No AI, no setup.</p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,420px)", gap: 28, alignItems: "start", marginTop: 8 }} className="compose-grid">
        {/* ── form ── */}
        <div>
          <label style={{ ...lbl, marginTop: 0 }}>Content name <span className="muted" style={{ fontWeight: 400 }}>(just for you — not posted)</span></label>
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. P&L PROOF — Taran · FB group + IG feed" />

          <label style={lbl}>Caption</label>
          <textarea style={{ ...inp, minHeight: 150, resize: "vertical", lineHeight: 1.5 }} value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder={"Real listing. Real month. Screenshot straight from Airbnb — revenue on top, every expense under it. What's left is the point. No course, no coaching. We set it up and we run it. Comment SETUP."} />

          <label style={lbl}>Disclaimer <span className="muted" style={{ fontWeight: 400 }}>(shown small, near the numbers)</span></label>
          <input style={inp} value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} placeholder="Results not typical." />

          <label style={lbl}>Call to action</label>
          <input style={inp} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Comment SETUP" />

          <label style={lbl}>Layout</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["square", "Square (one image)"], ["carousel", "Carousel (swipe)"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFormat(k)}
                style={{ flex: 1, cursor: "pointer", borderRadius: 9, padding: "9px", fontSize: 13, fontWeight: 600, border: `1px solid ${format === k ? "var(--gold, #d9a859)" : "var(--line, rgba(0,0,0,0.16))"}`, background: format === k ? "rgba(217,168,89,0.12)" : "transparent", color: "inherit" }}>{label}</button>
            ))}
          </div>

          <label style={lbl}>Photos <span className="muted" style={{ fontWeight: 400 }}>(click to add in order — 1, 2, …)</span></label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}>📷 Upload photos</button>
            <a className="btn ghost" href="/library" target="_blank" rel="noreferrer">Manage library ↗</a>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </div>
          {loading ? <p className="muted">Loading your photos…</p> : library.length === 0 ? (
            <p className="muted">No photos yet — upload your Airbnb screenshot and P&amp;L breakdown above (or add them in the Library).</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
              {library.map((p) => {
                const pos = selected.indexOf(p.id);
                const on = pos >= 0;
                return (
                  <button key={p.id} type="button" onClick={() => toggle(p.id)} title={p.name}
                    style={{ position: "relative", padding: 0, border: `2px solid ${on ? "var(--gold, #d9a859)" : "transparent"}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", background: "#0000000a", aspectRatio: "1 / 1" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: on ? 1 : 0.9 }} />
                    {on && <span style={{ position: "absolute", top: 4, left: 4, width: 20, height: 20, borderRadius: 999, background: "var(--gold, #d9a859)", color: "#fff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{pos + 1}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {claimsMsg && <div className="claims-block" style={{ marginTop: 14 }}>⚠ {claimsMsg}</div>}

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
            <button className="btn" onClick={send} disabled={busy || !!claimsHit.length}>{busy ? "Sending…" : "Send to Review →"}</button>
            <span className="muted" style={{ fontSize: 13 }}>{msg || "You approve & post it yourself — nothing goes out on its own."}</span>
          </div>
        </div>

        {/* ── live preview ── */}
        <div style={{ position: "sticky", top: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.06)", borderRadius: 999, padding: 3 }}>
              {[["instagram", "Instagram"], ["facebook", "Facebook"]].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setPlatform(k)}
                  style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "7px 18px", fontSize: 13, fontWeight: 600, background: platform === k ? "var(--gold, #7e6128)" : "transparent", color: platform === k ? "#fff" : "inherit" }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PostPreview platform={platform} media={media} caption={caption} headline={name} cta={cta} disclaimer={disclaimer} />
          </div>
        </div>
      </div>
    </>
  );
}
