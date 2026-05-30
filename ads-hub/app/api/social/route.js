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
  if (!s.connections || typeof s.connections !== "object") s.connections = { instagram: { connected: false }, facebook: { connected: false }, meta_ads: { connected: false } };
  if (!Array.isArray(s.schedule)) s.schedule = [];
  try {
    if (b.action === "connect") {
      if (!CHANNELS.includes(b.channel)) throw new Error("unknown channel");
      s.connections[b.channel] = { connected: true, account: (b.account || "").slice(0, 120), connectedAt: new Date().toISOString() };
    } else if (b.action === "disconnect") {
      if (!CHANNELS.includes(b.channel)) throw new Error("unknown channel");
      s.connections[b.channel] = { connected: false };
    } else if (b.action === "schedule") {
      const items = (b.items || []).slice(0, 200).map((it) => {
        const channel = CHANNELS.includes(it.channel) ? it.channel : "instagram";
        return { id: sid(), creativeId: String(it.creativeId || "").slice(0, 200), channel,
          account: s.connections[channel]?.account || "", postAt: (it.postAt || "").slice(0, 40),
          status: "queued", by: (b.by || "").slice(0, 60) };
      });
      s.schedule = [...items, ...s.schedule].slice(0, 5000);
    } else if (b.action === "unschedule") {
      s.schedule = s.schedule.filter((x) => x.id !== b.id);
    } else if (b.action === "autopilot") {
      const anyConnected = Object.values(s.connections || {}).some((v) => v?.connected);
      if (b.enabled && !anyConnected) throw new Error("Connect a channel before enabling autopilot.");
      s.autopilot = { enabled: !!b.enabled, updatedAt: new Date().toISOString() };
    } else throw new Error("unknown action");
    await writeSocial(s);
    return NextResponse.json({ ok: true, ...s });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
