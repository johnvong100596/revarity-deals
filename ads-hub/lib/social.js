import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./paths.js";

/**
 * Social channel POOL + post schedule (Blob/fs, mirrors lib/swipe.js).
 *
 * D-18 (workspace pool, not per-user partitions): every connected channel lives in ONE
 * workspace-level rack that everyone can see. Each entry records who connected it; the
 * OWNER controls a "team can post here" toggle (default OFF for personal accounts, ON for
 * company pages) and a per-channel autopilot opt-in (default OFF — the bot never touches a
 * feed without the owner's explicit toggle). Posting is multi-select across the channels
 * the poster is allowed to hit; every send is logged as member + channel. Claims rules and
 * the approval gate are unchanged — channel choice never bypasses review (D-04).
 */
const DRIVER = process.env.STORE_DRIVER || "fs";
const KEY = "state/social.json";
const FILE = path.join(OUTPUT_DIR, "_social.json");
export const CHANNELS = ["instagram", "facebook", "meta_ads"];
const EMPTY = {
  /* the POOL — { id, kind:"facebook"|"instagram", label, pageId, igUserId|null,
       owner:{id,name}, company:bool, teamCanPost:bool, autopilot:bool,
       tok:{u:<enc user token>, p:<enc page token>, obtainedAt}, connectedAt } */
  channels: [],
  /* send log — { at, by, channelId, channelLabel, creativeId, postRef } */
  postLog: [],
  connections: { instagram: { connected: false }, facebook: { connected: false }, meta_ads: { connected: false } }, // legacy env-channel flags
  schedule: [], // [{ id, creativeId, channel, channelId?, account, postAt, status:"queued"|"posted", postRef, postedAt, by }]
  autopilot: { enabled: false }, // MASTER switch for the runpath; pool channels ALSO need their own opt-in
  doubledDown: [], // postRefs already used to spawn a variation (so we don't repeat)
  updatedAt: null,
};
const migrate = (s) => (s && typeof s === "object"
  ? { ...EMPTY, ...s, channels: Array.isArray(s.channels) ? s.channels : [], postLog: Array.isArray(s.postLog) ? s.postLog : [] }
  : { ...EMPTY });

async function blobApi() { return import(/* webpackIgnore: true */ "@vercel/blob"); }

export async function readSocial() {
  if (DRIVER === "cloud") {
    try { const { head } = await blobApi(); const b = await head(KEY); if (!b?.url) return migrate(null); const r = await fetch(b.url, { cache: "no-store" }); return migrate(r.ok ? await r.json() : null); }
    catch { return migrate(null); }
  }
  try { return migrate(JSON.parse(fs.readFileSync(FILE, "utf8"))); } catch { return migrate(null); }
}

export async function writeSocial(state) {
  state.updatedAt = new Date().toISOString();
  if (DRIVER === "cloud") { const { put } = await blobApi(); await put(KEY, JSON.stringify(state), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }); }
  else { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); }
  return state;
}

/** The rack as everyone sees it — tokens stripped, owner + toggles visible. */
export function publicChannels(state) {
  return (state.channels || []).map(({ tok, ...c }) => c);
}

/** Channels this member may post to: their own, plus any the owner opened to the team. */
export function allowedChannels(state, memberId) {
  return (state.channels || []).filter((c) => c.owner?.id === memberId || c.teamCanPost);
}
