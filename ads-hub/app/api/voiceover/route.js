import { NextResponse } from "next/server";
import { tts, hasEleven } from "@/lib/elevenlabs";
import { putPublicAudio } from "@/lib/store";
import { newId } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Generate a brand voiceover from a script line → public MP3 URL. Used to voice b-roll ad cuts
 * (the missing piece behind the "no voiceover" bug). Proposes only; nothing publishes (D-04).
 */
export async function POST(req) {
  if (!hasEleven()) return NextResponse.json({ ok: false, error: "ELEVENLABS_API_KEY not set — add it in your env to enable voiceover." }, { status: 400 });
  let b = {};
  try { b = await req.json(); } catch {}
  const text = (b.text || "").slice(0, 2500);
  if (!text.trim()) return NextResponse.json({ ok: false, error: "no script text provided" }, { status: 400 });
  try {
    const mp3 = await tts(text, { voiceId: b.voiceId });
    const url = await putPublicAudio(mp3, newId("vo").slice(3));
    return NextResponse.json({ ok: true, url, chars: text.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
