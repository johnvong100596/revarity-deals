"use client";
import { useEffect, useState, useRef, useCallback } from "react";

// The site photo Library — drop real photos here (or import from Drive) and the render
// engine + Slack/Cowork all draw from this one shared set. Real photos only; nothing here
// spends or publishes. The heavy lifting lives server-side (/api/library/*).
export default function LibraryClient() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/library", { cache: "no-store" });
      const d = await r.json();
      setPhotos(d.photos || []);
    } catch { /* leave as-is */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (t, ms = 6000) => { setMsg(t); setTimeout(() => setMsg(""), ms); };

  async function upload(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type?.startsWith("image/"));
    if (!files.length) { flash("Those weren't image files."); return; }
    setBusy(true); setMsg(`Uploading ${files.length} photo${files.length === 1 ? "" : "s"}…`);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const r = await fetch("/api/library/upload", { method: "POST", body: fd });
      const d = await r.json();
      await load();
      flash(d.added ? `Added ${d.added} photo${d.added === 1 ? "" : "s"}.${d.errors?.length ? ` ${d.errors.length} skipped.` : ""}` : `Upload failed${d.error ? ` — ${d.error}` : ""}.`);
    } catch (e) { flash(`Upload failed — ${String(e?.message || e)}`); }
    setBusy(false);
  }

  async function importDrive() {
    if (busy) return;
    setBusy(true); setMsg("Importing from Drive…");
    try {
      const r = await fetch("/api/library/import-drive", { method: "POST" });
      const d = await r.json();
      await load();
      flash(d.ok ? `Imported ${d.added} from Drive${d.skipped ? ` (${d.skipped} already here)` : ""}.${d.note ? ` ${d.note}` : ""}` : `Import failed — ${d.error || "unknown"}`, 8000);
    } catch (e) { flash(`Import failed — ${String(e?.message || e)}`); }
    setBusy(false);
  }

  async function remove(id) {
    if (!window.confirm("Remove this photo from the library?")) return;
    setPhotos((p) => p.filter((x) => x.id !== id));
    try { await fetch("/api/library/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); } catch {}
  }

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer?.files); };

  return (
    <>
      <div className="eyebrow">— Photo library —</div>
      <h1>Your <em>photos</em></h1>
      <p className="lead">Drop real listing photos here or import them from Drive. Everything the engine renders — and everything Slack or Cowork can prompt against — comes from this one shared set. Real photos only; nothing here posts or spends.</p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        style={{
          border: `2px dashed ${dragOver ? "var(--gold, #d9a859)" : "var(--line, rgba(0,0,0,0.16))"}`,
          borderRadius: 16, padding: "clamp(28px,5vw,48px)", textAlign: "center", cursor: "pointer",
          background: dragOver ? "rgba(217,168,89,0.08)" : "rgba(0,0,0,0.015)", transition: "all .15s ease", marginTop: 8,
        }}
      >
        <div style={{ fontSize: 34, lineHeight: 1 }}>📷</div>
        <div style={{ fontWeight: 600, marginTop: 10, fontSize: 16 }}>{busy ? "Working…" : "Drag photos here, or click to choose"}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>JPG / PNG / WebP · up to 15MB each</div>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn ghost" onClick={importDrive} disabled={busy} title="Copy the read-only Drive /best-of photos into this library">⤓ Import from Drive</button>
        <button className="btn ghost" onClick={load} disabled={busy}>↻ Refresh</button>
        <span className="muted" style={{ fontSize: 13 }}>{loading ? "Loading…" : `${photos.length} photo${photos.length === 1 ? "" : "s"} in the library`}{msg && <> — {msg}</>}</span>
      </div>

      {/* Grid */}
      {!loading && photos.length === 0 ? (
        <p className="muted" style={{ marginTop: 28 }}>No photos yet. Drop a few in above (or import from Drive) and the render engine will start building from them.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginTop: 24 }}>
          {photos.map((p) => (
            <figure key={p.id} style={{ margin: 0, position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line, rgba(0,0,0,0.1))", background: "#0000000a" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.name} loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
              <figcaption style={{ position: "absolute", inset: "auto 0 0 0", padding: "6px 8px", fontSize: 11, color: "#fff", background: "linear-gradient(0deg, rgba(0,0,0,0.68), transparent)", display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>{p.name}</span>
                <span style={{ opacity: 0.75, flexShrink: 0 }}>{p.source === "drive" ? "Drive" : "Upload"}</span>
              </figcaption>
              <button onClick={() => remove(p.id)} title="Remove" aria-label={`Remove ${p.name}`}
                style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 14, lineHeight: 1 }}>×</button>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
