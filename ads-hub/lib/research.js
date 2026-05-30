import angles from "../config/ad-angles.json";
import { ANTHROPIC_KEY } from "./connectors.js";

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
