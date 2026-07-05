import { NextResponse } from "next/server";
import { readSocial, writeSocial, publicChannels } from "@/lib/social";
import { readPending, deletePending } from "@/lib/metaPending";
import { refreshPageToken } from "@/lib/meta";
import { encryptToken, decryptToken } from "@/lib/metaCrypto";
import { getMember } from "@/lib/member";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cid = () => `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** The rack (tokens never leave the server) + the picker payload when a ?pick pen is open. */
export async function GET(req) {
  const member = await getMember();
  const s = await readSocial();
  const out = { ok: true, me: member, channels: publicChannels(s) };
  const pick = new URL(req.url).searchParams.get("pick");
  if (pick) {
    const pen = await readPending(pick);
    if (pen && pen.member?.id === member.id) out.pending = { pick, pages: pen.pages };
    else out.pendingError = "That connect link expired or belongs to someone else — press Connect again.";
  }
  return NextResponse.json(out);
}

/**
 * POST { pick, selections:[{ pageId, asFacebook, asInstagram, company }] } — finalize a
 * connect: derive page tokens from the pen's user token, encrypt, and add pool entries.
 * teamCanPost defaults ON for company pages, OFF for personal (owner can flip later).
 * Autopilot defaults OFF everywhere — per-channel opt-in only (D-18).
 */
export async function POST(req) {
  const member = await getMember();
  let b = {};
  try { b = await req.json(); } catch {}
  const pen = await readPending(String(b.pick || ""));
  if (!pen) return NextResponse.json({ ok: false, error: "Connect link expired — press Connect again." }, { status: 410 });
  if (pen.member?.id !== member.id) return NextResponse.json({ ok: false, error: "This connect belongs to a different member." }, { status: 403 });

  const userToken = decryptToken(pen.encUserToken);
  const byId = Object.fromEntries((pen.pages || []).map((p) => [p.pageId, p]));
  const s = await readSocial();
  const added = [];
  for (const sel of (b.selections || []).slice(0, 20)) {
    const page = byId[sel.pageId];
    if (!page) continue;
    const pageToken = await refreshPageToken({ userToken, pageId: page.pageId });
    if (!pageToken) continue;
    const base = {
      owner: { id: member.id, name: member.name },
      company: !!sel.company,
      teamCanPost: !!sel.company, // default ON for company pages, OFF for personal — owner-controlled after
      autopilot: false, // per-channel opt-in, ALWAYS starts off
      tok: { u: pen.encUserToken, p: encryptToken(pageToken), obtainedAt: new Date().toISOString() },
      connectedAt: new Date().toISOString(),
    };
    if (sel.asFacebook !== false) {
      added.push({ id: cid(), kind: "facebook", label: page.name, pageId: page.pageId, igUserId: null, ...base });
    }
    if (sel.asInstagram && page.ig) {
      added.push({ id: cid(), kind: "instagram", label: page.ig.username ? `@${page.ig.username}` : `${page.name} (IG)`, pageId: page.pageId, igUserId: page.ig.id, ...base });
    }
  }
  if (!added.length) return NextResponse.json({ ok: false, error: "Nothing selected (or page tokens could not be derived)." }, { status: 400 });
  s.channels = [...(s.channels || []), ...added];
  await writeSocial(s);
  await deletePending(String(b.pick));
  return NextResponse.json({ ok: true, added: added.length, channels: publicChannels(s) });
}

/** PATCH { channelId, teamCanPost?, autopilot? } — OWNER-ONLY toggles. */
export async function PATCH(req) {
  const member = await getMember();
  let b = {};
  try { b = await req.json(); } catch {}
  const s = await readSocial();
  const ch = (s.channels || []).find((c) => c.id === b.channelId);
  if (!ch) return NextResponse.json({ ok: false, error: "channel not found" }, { status: 404 });
  if (ch.owner?.id !== member.id) return NextResponse.json({ ok: false, error: "Only the channel owner can change this." }, { status: 403 });
  if (typeof b.teamCanPost === "boolean") ch.teamCanPost = b.teamCanPost;
  if (typeof b.autopilot === "boolean") ch.autopilot = b.autopilot;
  await writeSocial(s);
  return NextResponse.json({ ok: true, channels: publicChannels(s) });
}

/** DELETE { channelId } — OWNER-ONLY disconnect (queued sends for it are dropped). */
export async function DELETE(req) {
  const member = await getMember();
  let b = {};
  try { b = await req.json(); } catch {}
  const s = await readSocial();
  const ch = (s.channels || []).find((c) => c.id === b.channelId);
  if (!ch) return NextResponse.json({ ok: false, error: "channel not found" }, { status: 404 });
  if (ch.owner?.id !== member.id) return NextResponse.json({ ok: false, error: "Only the channel owner can disconnect it." }, { status: 403 });
  s.channels = s.channels.filter((c) => c.id !== b.channelId);
  s.schedule = (s.schedule || []).filter((x) => !(x.channelId === b.channelId && x.status === "queued"));
  await writeSocial(s);
  return NextResponse.json({ ok: true, channels: publicChannels(s) });
}
