// POST /api/library/delete { id } — remove a photo from the site Library (index + image blob).
import { deleteLibraryPhoto } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  let id;
  try { ({ id } = await req.json()); } catch {}
  if (!id || typeof id !== "string") return Response.json({ ok: false, error: "id required" }, { status: 400 });
  await deleteLibraryPhoto(id);
  return Response.json({ ok: true });
}
