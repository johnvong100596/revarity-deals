import { ANTHROPIC_KEY } from "./connectors.js";

/**
 * AI "ads-expert" recommendations — a senior paid+organic social strategist that says WHEN to post
 * and WHICH approved creatives to prioritize. With live performance it doubles down on winners;
 * without it, it prioritizes by concept strength + angle diversity. (Loop A.)
 */
export async function recommend({ approved = [], connectedChannels = [], performance = null }) {
  if (!ANTHROPIC_KEY()) throw new Error("ANTHROPIC_API_KEY not set — required for recommendations.");
  const prompt = [
    "You are a senior paid + organic social ads strategist for Revarity — done-for-you short-term-rental / Airbnb arbitrage, CA/US, premium capital-having audience. Honest brand voice, no hype.",
    `Channels connected: ${connectedChannels.length ? connectedChannels.join(", ") : "none yet — plan assuming Instagram + Facebook organic (for views/reach) AND Meta paid (for leads)"}.`,
    performance ? `Live performance so far: ${JSON.stringify(performance).slice(0, 1500)} — DOUBLE DOWN on the winners; deprioritize low performers.` : "No live performance yet — prioritize by concept strength, hook variety, and angle diversity so we learn fast.",
    `Approved creatives (id · angle · headline · format):\n${approved.slice(0, 40).map((c) => `${c.id} · ${c.angle_id} · ${(c.headline || "").slice(0, 60)} · ${c.spec || ""}`).join("\n") || "(none approved yet)"}`,
    'Return ONLY JSON: {"cadence":"e.g. 3 posts/day, rotate angles","best_times":["Tue 7:30pm ET","..."],"priority":[{"creativeId":"<id or headline>","channel":"instagram|facebook|meta_ads","when":"e.g. Tue 7:30pm","why":"one line"}],"notes":["1-3 short strategist notes"]}',
    "Return ONLY the JSON object — no prose, no markdown fences.",
  ].join("\n\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.COPY_MODEL || "claude-sonnet-4-6", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const txt = d?.content?.map((b) => b.text || "").join("") || "";
  let p; try { p = JSON.parse(txt); } catch { try { const m = txt.match(/\{[\s\S]*\}/); p = m ? JSON.parse(m[0]) : null; } catch { p = null; } }
  if (!p) throw new Error("Could not parse recommendations.");
  for (const k of ["best_times", "priority", "notes"]) if (!Array.isArray(p[k])) p[k] = p[k] ? [p[k]] : [];
  return p;
}
