import { NextResponse } from "next/server";
import { extractPattern, describeVideo } from "@/lib/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Research a pasted competitor/reference ad (text OR a video link) → generalized winning pattern +
 * ICP-match + a brief the generator can run to make an ORIGINAL lookalike (learn the framework, never
 * copy the words/footage). A video link is analyzed by Gemini into a structured description first.
 */
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    let text = (b.text || "").slice(0, 8000);
    const videoUrl = (b.videoUrl || "").slice(0, 500);
    if (videoUrl.trim()) {
      const desc = await describeVideo({ videoUrl });
      text = `${text}\n\n[REFERENCE VIDEO ANALYSIS]\n${desc}`.slice(0, 16000);
    }
    const pattern = await extractPattern({ text, url: (b.url || videoUrl || "").slice(0, 500) });
    return NextResponse.json({ ok: true, pattern, fromVideo: !!videoUrl.trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
