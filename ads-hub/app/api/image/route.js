import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { getImage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/image?id=ANGLE/base → the rendered PNG (fs: stream; cloud: redirect to blob URL)
export async function GET(req) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const img = await getImage(id);
  if (!img) return new Response("not found", { status: 404 });
  if (img.kind === "url") return NextResponse.redirect(img.url);
  const buf = readFileSync(img.path);
  return new Response(buf, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
