import { NextResponse } from "next/server";
import { readSocial, writeSocial, CHANNELS, publicChannels, allowedChannels } from "@/lib/social";
import { readApprovals } from "@/lib/store";
import { getMember } from "@/lib/member";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sid = () => `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const strip = (s) => ({ ...s, channels: publicChannels(s) }); // tokens never leave the server

export async function GET() {
  return NextResponse.json({ ok: true, ...strip(await readSocial()) });
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
      // D-18 multi-select: one action fans a creative out to every chosen pool channel.
      // Server-enforced: only APPROVED creatives, only channels the poster may hit
      // (their own, or teamCanPost) — channel choice never bypasses review (D-04).
      const member = await getMember();
      const dec = (await readApprovals()).decisions || {};
      const allowed = new Set(allowedChannels(s, member.id).map((c) => c.id));
      const chById = Object.fromEntries((s.channels || []).map((c) => [c.id, c]));
      const items = [];
      for (const it of (b.items || []).slice(0, 200)) {
        const creativeId = String(it.creativeId || "").slice(0, 200);
        if (dec[creativeId] !== "approve") throw new Error(`"${creativeId.slice(0, 40)}" isn't approved — approve it in Review first.`);
        const postAt = (it.postAt || "").slice(0, 40);
        const chIds = Array.isArray(it.channelIds) ? it.channelIds.slice(0, 20) : [];
        for (const chId of chIds) {
          if (!allowed.has(chId)) throw new Error("You can't post to one of those channels — the owner hasn't opened it to the team.");
          const ch = chById[chId];
          items.push({ id: sid(), creativeId, channel: ch.kind, channelId: ch.id, account: ch.label,
            postAt, status: "queued", by: `${member.name} (${String(member.id).slice(0, 12)})` });
        }
        // legacy single-channel form (env channels) still accepted
        if (!chIds.length && it.channel && CHANNELS.includes(it.channel)) {
          items.push({ id: sid(), creativeId, channel: it.channel,
            account: s.connections[it.channel]?.account || "", postAt,
            status: "queued", by: `${member.name} (${String(member.id).slice(0, 12)})` });
        }
      }
      if (!items.length) throw new Error("Pick at least one channel.");
      s.schedule = [...items, ...s.schedule].slice(0, 5000);
    } else if (b.action === "unschedule") {
      s.schedule = s.schedule.filter((x) => x.id !== b.id);
    } else if (b.action === "autopilot") {
      const anyConnected = Object.values(s.connections || {}).some((v) => v?.connected) || (s.channels || []).length > 0;
      if (b.enabled && !anyConnected) throw new Error("Connect a channel before enabling autopilot.");
      s.autopilot = { enabled: !!b.enabled, updatedAt: new Date().toISOString() };
    } else throw new Error("unknown action");
    await writeSocial(s);
    return NextResponse.json({ ok: true, ...strip(s) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
