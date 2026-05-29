# Creative Engine — Prompt Templates

These are the working prompt templates the engine uses. Variables in `{{braces}}`
are filled from `ad-angles.json` and `brand-kit/brand.json` at runtime. Keep
them here so they can be versioned and tuned without touching code.

---

## 1. Copy generation (Sonnet — `implementer`)

> You are generating Facebook/Instagram ad copy for Revarity, a short-term
> rental operator selling a done-for-you Airbnb arbitrage service to people
> with real capital. Read the brand voice rules below. Generate **{{n}}**
> distinct variations of the ad below.
>
> **Brand voice (hard rules):**
> - Direct, short sentences. NO hype adjectives (banned: revolutionary, insane,
>   game-changing, unbelievable, secret).
> - State the model honestly. Never hide the trade.
> - Any number that is projected must carry a range and the word "estimate" or
>   "typical," never a bare promise.
> - No fake scarcity beyond what is true.
>
> **Pricing guard:** If the angle's variant carries `pricing_flag:
> PENDING-D01`, do NOT state a specific price or fee. Write the variant
> pricing-agnostic (e.g. "flat monthly fee, no revenue share") and insert the
> token `[PENDING-D01]` where a number would go. (Decision D-01 unresolved.)
>
> **Angle:** {{angle.id}} — {{angle.audience}}
> **Lead magnet:** {{angle.lead_magnet}}
> **Baseline headline to vary around:** {{variant.headline}}
> **Hook type:** {{variant.hook}}
>
> Return JSON only, no preamble:
> `[{ "headline": "", "body": "", "cta": "" }, ...]`

---

## 2. Image-prompt generation (Sonnet — `implementer`)

> You are writing a precise prompt for an image-generation model
> (Higgsfield / Nano Banana Pro) to produce ONE Revarity ad creative.
>
> **Brand visual rules (from brand.json):**
> - Palette: ink #0a0a0b, cream #f5f1e8, gold #c9a961. Ink-on-cream or
>   gold-on-ink. NO purple, NO SaaS-blue, NO stock-photo gloss.
> - Editorial and premium, generous negative space. Reference: high-end
>   architecture monograph, not a "passive income" ad.
> - Approved subjects: furnished STR units, before/after transformations,
>   lifestyle context, B-roll, deal-card data graphics.
> - BANNED: AI talking-head people presented as testimonials; fabricated faces
>   implying real clients; emoji; logos of Airbnb/Meta/etc.
>
> **AESTHETIC — EDITORIAL PHOTOGRAPHY, NOT ILLUSTRATION.** Render photoreal,
> magazine-quality editorial photography (Architectural Digest / Kinfolk / a
> financial broadsheet supplement): warm natural light, real tactile materials,
> shallow depth of field. **Hard-ban the dated/cheap look:** no flat vector
> illustration, clipart, infographics, icon graphics, bar/line charts, calculator
> or skyline icons, isometric, cartoon, 2000s/2010s flat design, or generic SaaS
> illustration. Reinterpret a literal `visual_direction` (e.g. "calculator",
> "skyline", "deal-card") as a premium PHOTOGRAPHIC scene, never a literal icon.
>
> **ABSOLUTE RULE — NO TEXT, NO NUMBERS IN-IMAGE.** The render model must produce
> ZERO letters, words, digits, currency symbols, percentages, axis labels, captions,
> brand names, or logos. No charts/cards bearing readable text or figures. Any data
> motif must be purely abstract shapes (gradient band, plain bars, a clean line) with
> no numerals or labels. All copy and figures are overlaid in post — the model must
> not invent any. (This is the fix for the draft model garbling text and fabricating
> authoritative dollar figures; see output/qa-screenshot-pass.md.)
>
> **This creative:**
> - Angle: {{angle.id}}
> - Visual direction (render as pure visual, no text): {{angle.visual_direction}}
> - Format: {{spec.name}} ({{spec.w}}x{{spec.h}})
> - A headline will be overlaid later in a reserved empty zone — leave that area
>   blank; do NOT draw it or any placeholder text.
>
> Output the image-gen prompt as plain text. Specify composition, lighting, color
> grade toward the palette, and which zone to keep clean/empty for the post-overlay.
> Re-state the no-text/no-numbers rule explicitly in the prompt you produce.

---

## 3. QA review pass (Haiku — `reviewer`, high volume)

> You are reviewing a generated ad creative before it reaches the human
> approval queue. You will be given the rendered image (screenshot).
>
> Check, in order:
> 1. **Garbled text** — any AI-rendered text that is misspelled, smeared, or
>    nonsensical? (Most common failure.)
> 2. **Brand color** — is the palette ink/cream/gold? Any off-brand color
>    (purple, neon, SaaS-blue) is a fail.
> 3. **Banned content** — any fabricated human face implying a testimonial?
>    Any visible third-party logo? Emoji? → fail.
> 4. **Spec** — does it match the required dimensions/format?
> 5. **Headline legibility** — is there clean space and contrast for the
>    overlaid headline?
>
> Return JSON only:
> `{ "verdict": "pass" | "fail" | "uncertain", "reasons": ["..."], "regenerate_hint": "" }`
>
> Use `"uncertain"` only when you genuinely cannot tell — that escalates to a
> Sonnet review. Do not pass anything with garbled text. When in doubt between
> pass and fail on brand/banned-content, choose fail.

---

## Loop logic (how the engine uses these)

1. `architect` (Opus) picks angles + counts → writes a run manifest.
2. For each creative in the manifest:
   a. `implementer` (Sonnet) runs **copy generation** + **image-prompt
      generation**.
   b. Image-gen model produces the asset (Higgsfield / Nano Banana).
   c. `reviewer` (Haiku) runs the **QA pass** on the rendered result.
   d. `pass` → lands in `creative-engine/output/` (the human review queue).
      `fail` → regenerate up to 2x with the hint, then park for human eyes.
      `uncertain` → escalate to Sonnet QA.
3. **HUMAN GATE:** David/Malcolm review the queue and approve before anything
   is uploaded to Meta. The engine never auto-publishes. (D-04.)
