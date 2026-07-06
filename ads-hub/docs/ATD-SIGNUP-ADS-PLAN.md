# ATD signup ads through the studio — one-page plan

**Goal:** run AnalyzeTheDeal signup ads from the same hub as Revarity, with hard brand
separation and zero cross-brand leakage. CTA is always the site (analyzethedeal.com / sign up).

## What ATD ads are (and aren't)
- **Message:** what the product *does* — analyze any rental across every strategy (STR, LTR,
  BRRRR, flip…) and return one clear buy/pass verdict in seconds. Kill the spreadsheet guesswork.
- **Never in creative:** ROI/profit/cap-rate/cash-flow/return *numbers* (the app shows those
  in-app), income promises, guaranteed returns, APR/credit language, DM keywords, fake urgency.
- **Confirmed-only facts:** price, trial, and guarantee/refund claims stay BLOCKED until you
  confirm them in writing — then we flip the env flag and they're allowed. Send me those and I
  set `ATD_PRICE_CONFIRMED` / `ATD_TRIAL_CONFIRMED` / `ATD_GUARANTEE_CONFIRMED`.
- **Imagery:** REAL product screenshots + real report outputs on **demo data only** — never a
  real customer's deal, never AI-fabricated app UI. (AI image generation is refused for ATD.)

## The pipeline (what already works after this branch)
1. **Create** → pick brand **AnalyzeTheDeal** → type one line about the product → the marketing
   brain writes ATD-voiced copy, the ATD claims lock gates it, it lands in Review tagged ATD.
2. **Review** → ATD cards show a green/gold ATD badge on a light card (visually distinct from
   Revarity's dark cards); the ATD claims regime gates Approve; approve is still a human click.
3. **Schedule** → post approved ATD ads to any channel you're allowed to hit (D-18 pool). ATD's
   CTA points to the site, so these are link/traffic posts, not DM flows.
4. **Cowork connector** → `submit_idea` accepts `brand:"atd"` — ideas come in from chat, claims-
   locked, queued for review (generate_now is refused for ATD since it needs a real screenshot).

## What's NOT built yet (next slices, in order)
1. **Screenshot intake** (the ATD visual asset class): an upload path on Create/Review to attach a
   real ATD screenshot/report PNG (demo data) to an ATD draft, stored like a creative image. This
   is the one missing production piece — ATD ads currently generate copy but need you to attach the
   visual. ~1 slice.
2. **ATD ad templates**: 3–4 seed briefs ("stop guessing", "every strategy one verdict", "before
   you sign", "the 60-second underwrite") pre-loaded for the ATD brand, mirroring Revarity's seeds.
3. **Confirmed-facts unlock**: the moment you send price/trial/guarantee in writing, flip the flags
   + add the exact approved phrasings to the ATD voice so copy can use them.
4. **Signup attribution**: UTM convention (`?utm_source=meta&utm_campaign=<id>`) baked into the ATD
   site CTA so signups trace back to the ad — needs your analyzethedeal.com analytics choice.

## Guardrails that never bend (same as Revarity)
Claims lock on every ATD submission (pre- and post-generation), human approval before anything is
scheduled or posted (D-04), no AI-fabricated proof, real screenshots only, one clean queue with
per-brand regimes so a Revarity rule can never leak into an ATD ad or vice-versa.

## What I need from you
- Price / trial / guarantee posture **in writing** (to unlock those claims).
- A folder or handful of **real ATD screenshots on demo data** to seed the visual asset class.
- Which analytics you want signups attributed through (for the UTM convention).
