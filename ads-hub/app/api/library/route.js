// GET /api/library — the site photo Library (real photos, shared source of truth).
// Behind the hub session gate (middleware). Nothing here spends or publishes.
import { listLibraryPhotos } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const photos = await listLibraryPhotos();
  return Response.json({ ok: true, count: photos.length, photos });
}
