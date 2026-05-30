import { NextResponse } from "next/server";
import { readSwipe, writeSwipe, minePatterns } from "@/lib/swipe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sanitizeRef(r) {
  if (!r) return null;
  if (typeof r === "string") return r.trim() ? { text: r.slice(0, 4000) } : null;
  const text = (r.text || "").slice(0, 4000);
  if (!text.trim() && !(r.source || "").trim()) return null;
  return { text, source: (r.source || "").slice(0, 200), hook: (r.hook || "").slice(0, 300), why_winning: (r.why_winning || "").slice(0, 300) };
}

export async function GET() {
  return NextResponse.json({ ok: true, ...(await readSwipe()) });
}

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const state = await readSwipe();
    if (b.action === "add") {
      const ref = sanitizeRef(b.ref);
      if (!ref) throw new Error("Paste a winning ad (text) to add it.");
      state.refs.unshift(ref);
      await writeSwipe(state);
      return NextResponse.json({ ok: true, ...state });
    }
    if (b.action === "remove") {
      state.refs = state.refs.filter((_, i) => i !== b.index);
      await writeSwipe(state);
      return NextResponse.json({ ok: true, ...state });
    }
    if (b.action === "mine") {
      const patterns = await minePatterns(state.refs);
      state.patterns = { ...patterns, minedAt: new Date().toISOString(), sourceCount: state.refs.length };
      await writeSwipe(state);
      return NextResponse.json({ ok: true, ...state });
    }
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
