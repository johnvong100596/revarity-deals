/**
 * lib/voice.js — THE single voiceover seam. Every caller (render, /api/voiceover)
 * asks this module for VO and never talks to a provider directly, so we can swap
 * providers later by flipping ONE env var — no caller changes. (Explicit design
 * ask: "keep the VO call abstracted so we can swap providers later.")
 *
 * BRAND DECISION (2026-07-03): "Zoe" is a Higgsfield PRESET voice
 * (voice_id d0374db1-44b9-4f05-939e-0a9ae9dbbe6a, voice_type "preset") — it does
 * NOT expose an underlying ElevenLabs voice id. The voice is a locked brand
 * asset, so continuity wins: default VO_PROVIDER=higgsfield to keep the exact
 * Zoe voice. ElevenLabs stays available as an alternate behind the same seam.
 *
 *   synthesizeVO(text) -> { buffer, ext, provider, voice }
 *
 * Env:
 *   VO_PROVIDER            "higgsfield" (default) | "elevenlabs"
 *   HF_TTS_URL             Higgsfield text-to-speech endpoint (see note below)
 *   HF_TTS_MODEL           Higgsfield TTS model id (optional)
 *   HF_ZOE_VOICE_ID        override the Zoe voice id (defaults to the preset below)
 *   ELEVENLABS_VOICE_ID    the ElevenLabs voice id, when VO_PROVIDER=elevenlabs
 */
import { hasCloudKey } from "./higgsfield-cloud.js";
import { hasEleven, tts as elevenTts } from "./elevenlabs.js";
import { getPrebake, hasPrebake } from "./voicePrebake.js";

export const ZOE_VOICE_ID = process.env.HF_ZOE_VOICE_ID || "d0374db1-44b9-4f05-939e-0a9ae9dbbe6a";

export function voiceProvider() {
  return (process.env.VO_PROVIDER || "higgsfield").toLowerCase();
}

/** True when the selected provider can actually synthesize right now. */
export function voiceConfigured() {
  return voiceProvider() === "elevenlabs" ? hasEleven() : higgsfieldTtsConfigured();
}

// ── Higgsfield TTS (brand default: Zoe) ──────────────────────────────────────
// Auth mirrors higgsfield-cloud (Key KEY_ID:KEY_SECRET on platform.higgsfield.ai).
// NOTE: the audio endpoint path is env-driven (HF_TTS_URL) rather than hardcoded
// — the image2video contract is known (`/v1/image2video/dop` + `/v1/job-sets/{id}`
// poll) but the audio path must be confirmed against Higgsfield's audio API; set
// HF_TTS_URL to that endpoint. Until it's set, voiceConfigured() is false and
// callers degrade honestly (render assembles caption-only, flags VO pending).
const HF_BASE = process.env.HF_CLOUD_URL || "https://platform.higgsfield.ai";
const HF_KEY = process.env.HF_API_KEY || process.env.HIGGSFIELD_API_KEY_ID || "";
const HF_SECRET = process.env.HF_API_SECRET || process.env.HIGGSFIELD_API_KEY_SECRET || "";
const hfAuth = () => `Key ${HF_KEY}:${HF_SECRET}`;

function higgsfieldTtsConfigured() {
  return !!(HF_KEY && HF_SECRET && process.env.HF_TTS_URL);
}

async function higgsfieldTts(text, voiceId = ZOE_VOICE_ID) {
  if (!hasCloudKey()) throw new Error("HF_API_KEY/HF_API_SECRET not set — required for Higgsfield voice.");
  const url = process.env.HF_TTS_URL;
  if (!url) throw new Error("voice_provider_unconfigured: set HF_TTS_URL to the Higgsfield audio endpoint (or VO_PROVIDER=elevenlabs).");
  const body = {
    params: {
      text,
      voice_id: voiceId,
      ...(process.env.HF_TTS_MODEL ? { model: process.env.HF_TTS_MODEL } : {}),
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: hfAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Higgsfield TTS ${res.status}: ${(await res.text()).slice(0, 180)}`);

  // Either a direct audio body, or an async job-set id to poll (same shape as video).
  const ctype = res.headers.get("content-type") || "";
  if (ctype.startsWith("audio/")) return Buffer.from(await res.arrayBuffer());
  const j = await res.json().catch(() => ({}));
  const direct = j.audio_url || j.url || j.results?.raw?.url;
  if (direct) return fetchAudio(direct);
  if (j.id) return pollHiggsfieldAudio(j.id);
  throw new Error("Higgsfield TTS returned neither audio nor a job id");
}

async function pollHiggsfieldAudio(setId, { tries = 40, delayMs = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HF_BASE}/v1/job-sets/${setId}`, { headers: { Authorization: hfAuth() } });
    if (res.ok) {
      const j = await res.json();
      const job = (j.jobs || [])[0] || {};
      if (job.status === "completed") {
        const u = job.results?.raw?.url || job.results?.min?.url;
        if (u) return fetchAudio(u);
      }
      if (job.status === "failed" || job.status === "nsfw") throw new Error(`Higgsfield TTS job ${job.status}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Higgsfield TTS timed out");
}

async function fetchAudio(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`fetch VO ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Synthesize one VO line with the selected provider. Returns the mp3 bytes plus
 * which provider/voice produced it (for the render manifest + review card).
 */
export async function synthesizeVO(text, { voiceId, allowLive = true } = {}) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("synthesizeVO: text required");
  // 1) PREBAKE first — fixed money-arc beats + already-approved hooks resolve to a
  //    committed Zoe buffer. Nightly renders never touch live TTS for these.
  const pre = getPrebake(clean);
  if (pre) return { buffer: pre, ext: "mp3", provider: "prebake", voice: "zoe-prebake" };
  // 2) No prebake → live TTS if allowed + configured. When the caller can't accept a
  //    live call (nightly render — allowLive:false), signal VO_PENDING so it renders
  //    caption-only for that one novel line (honest; no fabricated audio).
  if (!allowLive) { const e = new Error("voice_pending: no prebaked audio for this line"); e.code = "VO_PENDING"; throw e; }
  if (voiceProvider() === "elevenlabs") {
    return { buffer: await elevenTts(clean, { voiceId }), ext: "mp3", provider: "elevenlabs", voice: voiceId || process.env.ELEVENLABS_VOICE_ID || "default" };
  }
  return { buffer: await higgsfieldTts(clean, voiceId || ZOE_VOICE_ID), ext: "mp3", provider: "higgsfield", voice: voiceId || ZOE_VOICE_ID };
}

/** True if this exact line already has committed Zoe audio (fixed beat or approved hook). */
export function voPrebaked(text) { return hasPrebake(text); }
