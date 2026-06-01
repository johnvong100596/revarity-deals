import { NextResponse } from "next/server";
import { generateMusic, hasLyria } from "@/lib/lyria";
import { putPublicAudio } from "@/lib/store";
import { newId } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Generate a royalty-free background music bed (Lyria 3) → public MP3 URL. Completes the in-app
 * generation stack (copy + image + b-roll + voiceover + music). Proposes only; nothing publishes (D-04).
 */
export async function POST(req) {
  if (!hasLyria()) return NextResponse.json({ ok: false, error: "GEMINI_API_KEY not set — required for music." }, { status: 400 });
  let b = {};
  try { b = await req.json(); } catch {}
  const prompt = (b.prompt || "").slice(0, 1500);
  if (!prompt.trim()) return NextResponse.json({ ok: false, error: "describe the music (mood + instruments, no vocals)" }, { status: 400 });
  try {
    const { buf } = await generateMusic(prompt);
    const url = await putPublicAudio(buf, newId("music").slice(6));
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
