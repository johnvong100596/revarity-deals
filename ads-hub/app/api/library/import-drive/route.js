// POST /api/library/import-drive — copy the read-only Drive library INTO the site Library
// (Blob), so the on-site Library is the single source of truth. Dedupes by name against
// already-imported Drive photos. Drive stays read-only Viewer; nothing is written back to Drive.
import { listLibraryPhotos, addLibraryPhoto } from "@/lib/store";
import { fetchFolderPhotos, driveConfigured } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  if (!driveConfigured()) {
    return Response.json({ ok: false, error: "Drive isn't connected (service-account key not set)." }, { status: 400 });
  }
  const already = new Set((await listLibraryPhotos()).filter((p) => p.source === "drive").map((p) => p.name));
  let drivePhotos = [];
  try {
    drivePhotos = await fetchFolderPhotos(undefined, { count: 40 });
  } catch (e) {
    return Response.json({ ok: false, error: `Drive fetch failed: ${e?.message || e}` }, { status: 502 });
  }
  if (!drivePhotos.length) {
    return Response.json({ ok: true, added: 0, skipped: 0, note: "No photos found in the Drive /best-of folder." });
  }
  const added = [];
  for (const p of drivePhotos) {
    if (already.has(p.name)) continue; // dedupe by filename
    try { added.push(await addLibraryPhoto({ buffer: p.buffer, name: p.name, source: "drive", contentType: p.mimeType || "image/jpeg" })); }
    catch (e) { console.warn(`[library/import-drive] skip ${p.name}:`, e?.message || e); }
  }
  return Response.json({ ok: true, added: added.length, skipped: drivePhotos.length - added.length, photos: added });
}
