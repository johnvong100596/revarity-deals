# Arcads UGC lane — status & go-live checklist

**What it is:** a dedicated, clearly-labeled **UGC talking-head** lane (selfie/creator-style AI presenter), separate from the premium **Veo presenter commercials**. Connector lives in `lib/arcads.js`; the director (`lib/director.js`) only routes to it when it's configured.

**Status: BUILT BUT INERT.** It does nothing until `ARCADS_CLIENT_ID` + `ARCADS_CLIENT_SECRET` are set (fails closed, like `lib/meta.js`). The director won't route to Arcads while it's unconfigured, so nothing breaks.

## Why it's gated (decision context)
Research verdict (2026): Arcads **cannot** produce the walking/presenting cinematic commercial — its actors are seated/selfie-framed UGC. That format is **Veo 3.1** (already wired). Arcads' value is *only* the casual UGC talking-head for top-of-funnel volume tests. Its API is also **Pro-tier/sales-gated** (no free trial), and at ~$11/video it's 3–14× the per-clip cost of Veo/Kling/Higgsfield.

## Get these IN WRITING from Arcads sales before signing / setting keys
1. **Pro tier price** + per-video credit cost at volume + **API rate limits** (all sales-gated today).
2. **Actor consent/release chain** — written confirmation the AI actors are licensed from consenting performers, with the release scope.
3. **Financial-adjacent advertising permitted** — explicit clause; their default Terms have a vague "high-risk AI" prohibition (Art. 16.3) that could create breach risk for an investment-adjacent brand.
4. **Stronger customer-facing indemnity** — the default runs indemnity *from us to FRESHR* with FRESHR liability capped.
5. Whether **regenerations/retakes** burn credits (determines true cost-per-usable-video).

## Guardrails when live (revised D-03 + FTC)
- UGC presenter = a **labeled brand spokesperson**, never a real-client testimonial.
- **No** implied real Revarity client; **no** guaranteed/specific income/return/occupancy claims.
- Apply the platform **AI-generated label** (Meta/TikTok) on every shipped Arcads ad; EU AI Act (Aug 2026) + NY synthetic-performer law (Jun 2026) also require disclosure.
- Human approval before spend still applies (D-04). Run a **cost/quality bake-off vs the Veo/Kling/Higgsfield/ElevenLabs stack** before committing real budget.

## To go live
Set `ARCADS_CLIENT_ID` / `ARCADS_CLIENT_SECRET` (Settings → Public API in Arcads) in Vercel, verify the request field names in `lib/arcads.js` against the contract's API docs, generate one test, confirm the AI-label workflow, then enable for volume.
