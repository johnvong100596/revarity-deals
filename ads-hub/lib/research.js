import angles from "../config/ad-angles.json";
import { ANTHROPIC_KEY, GEMINI_KEY } from "./connectors.js";

/**
 * Research / "find similar ads" — paste path.
 * Take a competitor ad (pasted text, optional URL) and extract the GENERALIZED winning pattern
 * (hook/angle/format/framework) plus a ready-to-use brief so the generator can produce an ORIGINAL
 * lookalike (learn the framework, never copy the words). Also scores how well it matches our client's
 * ICP so operators know if it's worth mimicking. A paid spy-tool connector can later feed this same
 * shape (decision D-11); the rest of the system doesn't change.
 */
const ICP = [
  "Client ICP: Revarity — done-for-you short-term-rental / Airbnb arbitrage for people with real capital.",
  `Audiences: ${[...new Set(angles.angles.map((a) => a.audience))].join("; ")}.`,
  `Geo: ${(angles.targeting?.geo || []).join("/")}. Interests: ${(angles.targeting?.interests || []).join(", ")}.`,
].join(" ");

export async function extractPattern({ text = "", url = "" }) {
  if (!ANTHROPIC_KEY()) throw new Error("ANTHROPIC_API_KEY not set — required for ad research.");
  if (!text.trim() && !url.trim()) throw new Error("Paste the competitor ad text (or a note about it) to research.");
  const prompt = [
    "You are a direct-response creative strategist. Below is a competitor/reference ad an operator pasted in.",
    "Extract the GENERALIZED, reusable pattern so we can produce ORIGINAL creative in the same spirit — never reproduce wording.",
    ICP,
    "",
    `REFERENCE${url ? ` (source: ${url})` : ""}:`,
    text || "(no text — only a URL was provided; infer cautiously and say so)",
    "",
    'Return ONLY JSON: {"hook":"the hook framework with [placeholders]","angle":"angle name + why it works","format":"format + when to use","framework":"structure e.g. myth→reframe→proof→CTA","icp_match":{"score":0-100,"why":"one line"},"suggested_brief":"a 1-2 sentence brief our generator can run to make an ORIGINAL ad in this spirit","do":[".."],"dont":[".."]}',
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.COPY_MODEL || "claude-sonnet-4-6", max_tokens: 1200, messages: [{ role: "user", content: prompt + "\n\nReturn ONLY the JSON object — no prose, no markdown fences." }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const txt = d?.content?.map((b) => b.text || "").join("") || "";
  let p; try { p = JSON.parse(txt); } catch { try { const m = txt.match(/\{[\s\S]*\}/); p = m ? JSON.parse(m[0]) : null; } catch { p = null; } }
  if (!p) throw new Error("Could not parse research result.");
  for (const k of ["do", "dont"]) if (!Array.isArray(p[k])) p[k] = p[k] ? [p[k]] : [];
  if (!p.icp_match || typeof p.icp_match !== "object") p.icp_match = { score: null, why: "" };
  return p;
}

/** Normalize share links so the raw file is fetchable (Dropbox dl=1, Drive direct download). */
function normalizeVideoUrl(u) {
  if (/dropbox\.com/i.test(u)) return u.includes("dl=") ? u.replace(/dl=0/i, "dl=1") : u + (u.includes("?") ? "&dl=1" : "?dl=1");
  const gd = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) return `https://drive.google.com/uc?export=download&id=${gd[1]}`;
  return u;
}

/**
 * Analyze a REFERENCE VIDEO (Dropbox/Drive/direct mp4 or YouTube) with Gemini → a structured text
 * description (transcript + shot breakdown + hook + framework) we feed into extractPattern. We learn
 * the framework to make an ORIGINAL in a different context — never copy the footage.
 */
export async function describeVideo({ videoUrl = "" }) {
  if (!GEMINI_KEY()) throw new Error("GEMINI_API_KEY not set — required to analyze a reference video.");
  if (!videoUrl.trim()) throw new Error("Provide a reference video URL.");
  const model = process.env.RESEARCH_VIDEO_MODEL || "gemini-2.5-flash";
  const ask = "Analyze this advertising video so we can learn its FRAMEWORK (never to copy it). Output plain text: (1) full spoken transcript; (2) shot-by-shot visual breakdown with rough timing; (3) the hook in the first 3 seconds; (4) the persuasion structure/framework; (5) tone, pacing, and CTA.";
  let parts;
  if (/youtube\.com|youtu\.be/i.test(videoUrl)) {
    parts = [{ text: ask }, { fileData: { fileUri: videoUrl } }];
  } else {
    const r = await fetch(normalizeVideoUrl(videoUrl), { redirect: "follow" });
    if (!r.ok) throw new Error(`could not fetch the video (${r.status}) — make sure it's a public link`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 18 * 1024 * 1024) throw new Error("video is too large to analyze inline (>18MB) — use a shorter clip or a YouTube link");
    const mime = (r.headers.get("content-type") || "video/mp4").split(";")[0];
    parts = [{ text: ask }, { inlineData: { mimeType: mime, data: buf.toString("base64") } }];
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY() },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) throw new Error(`Gemini video ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const txt = (d?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  if (!txt.trim()) throw new Error("Gemini returned no analysis for that video.");
  return txt;
}
