/**
 * Lyria 3 music generation via the Gemini API (REST, one-shot generateContent — same auth/shape as the
 * image flow in connectors.js). Returns a ~30s MP3 (44.1kHz stereo) from a text prompt, using the
 * existing GEMINI_API_KEY. SynthID-watermarked; vocals/artist-voice prompts are safety-filtered.
 * Nothing here publishes or spends on ads (D-04).
 *   lyria-3-clip-preview → ~30s clips/loops/beds (default)   lyria-3-pro-preview → full-length songs
 */
const KEY = () => process.env.GEMINI_API_KEY || "";
const MODEL = process.env.LYRIA_MODEL || "lyria-3-clip-preview";

export function hasLyria() { return !!KEY(); }

/** Generate a music clip from a text prompt. Returns { buf: Buffer (mp3), mime }. */
export async function generateMusic(prompt) {
  if (!KEY()) throw new Error("GEMINI_API_KEY not set — required for Lyria music.");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY() },
    // responseModalities:["AUDIO"] is REQUIRED — without it Lyria returns text and no inlineData part
    // (mirrors renderImage's ["IMAGE"] in connectors.js). Omitting it makes every /api/music call fail.
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["AUDIO"] } }),
  });
  if (!res.ok) throw new Error(`Lyria ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!part) throw new Error("Lyria returned no audio.");
  return { buf: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType || "audio/mpeg" };
}
