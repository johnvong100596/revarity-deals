/**
 * ElevenLabs text-to-speech (voiceover). Serverless-safe REST, fetch-only.
 * Returns an MP3 Buffer for a script line; the route stores it to public Blob/FS and hands back a URL.
 * Brand default voice is overridable via ELEVENLABS_VOICE_ID. Nothing here publishes or spends on ads (D-04).
 */
const BASE = process.env.ELEVENLABS_URL || "https://api.elevenlabs.io/v1";
const KEY = () => process.env.ELEVENLABS_API_KEY || "";
// Default = "Rachel" (ElevenLabs stock voice id). Set ELEVENLABS_VOICE_ID to your brand voice.
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

export function hasEleven() { return !!KEY(); }

/** Synthesize `text` to an MP3 Buffer. Throws with a clear message if the key is missing. */
export async function tts(text, { voiceId } = {}) {
  if (!KEY()) throw new Error("ELEVENLABS_API_KEY not set — add it to enable voiceover.");
  const voice = voiceId || DEFAULT_VOICE;
  const res = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voice)}`, {
    method: "POST",
    headers: { "xi-api-key": KEY(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 180)}`);
  return Buffer.from(await res.arrayBuffer());
}
