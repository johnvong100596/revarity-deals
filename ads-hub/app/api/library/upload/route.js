// POST /api/library/upload — drag-and-drop / file-picker uploads → the site Library.
// multipart form-data, field "files" (one or many). Images only, 15MB each. Stores each
// as its own public Blob + index record (lib/store.addLibraryPhoto). No spend, no publish.
import { addLibraryPhoto } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Expected multipart form-data." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f) => f && typeof f === "object" && "arrayBuffer" in f);
  if (!files.length) return Response.json({ ok: false, error: "No files uploaded." }, { status: 400 });

  const photos = [];
  const errors = [];
  for (const f of files.slice(0, 30)) {
    const fname = f.name || "photo";
    try {
      const ct = f.type || "image/jpeg";
      if (!/^image\//.test(ct)) { errors.push(`${fname}: not an image`); continue; }
      const buf = Buffer.from(await f.arrayBuffer());
      if (buf.length > MAX_BYTES) { errors.push(`${fname}: too large (max 15MB)`); continue; }
      if (buf.length === 0) { errors.push(`${fname}: empty file`); continue; }
      photos.push(await addLibraryPhoto({ buffer: buf, name: fname, source: "upload", contentType: ct }));
    } catch (e) {
      errors.push(`${fname}: ${e?.message || e}`);
    }
  }
  return Response.json({ ok: photos.length > 0, added: photos.length, photos, errors });
}
