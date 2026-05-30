import { NextResponse } from "next/server";
import { readSocial, writeSocial, CHANNELS } from "@/lib/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sid = () => `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export async function GET() {
  return NextResponse.json({ ok: true, ...(await readSocial()) });
}

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  const s = await readSocial();
  try {
    if (b.action === "connect") {
      if (!CHANNELS.includes(b.channel)) throw new Error("unknown channel");
      s.connections[b.channel] = { connected: true, account: (b.account || "").slice(0, 120), connectedAt: new Date().toISOString() };
    } else if (b.action === "disconnect") {
      if (CHANNELS.includes(b.channel)) s.connections[b.channel] = { connected: false };
    } else if (b.action === "schedule") {
      const items = (b.items || []).slice(0, 200).map((it) => ({
        id: sid(), creativeId: String(it.creativeId || "").slice(0, 200),
        channel: CHANNELS.includes(it.channel) ? it.channel : "instagram",
        account: (it.account || "").slice(0, 120), postAt: (it.postAt || "").slice(0, 40),
        status: "queued", by: (b.by || "").slice(0, 60),
      }));
      s.schedule.unshift(...items);
    } else if (b.action === "unschedule") {
      s.schedule = s.schedule.filter((x) => x.id !== b.id);
    } else throw new Error("unknown action");
    await writeSocial(s);
    return NextResponse.json({ ok: true, ...s });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
