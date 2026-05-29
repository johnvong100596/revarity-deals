# Ad Scaling Strategy — how we leverage these tools to scale (research-backed)

Companion to `working-session-2026-05-29.md`. This is the "how would a successful founder
actually do this" answer, grounded in 2025/26 data, then mapped to Revarity's $7K/mo and our
guardrails. Sources linked inline.

---

## 1. The one idea that changes everything

Meta's targeting is now automated (Advantage+ / Andromeda). **Creative is the only variable
you still control**, and Meta's algorithm explicitly rewards *creative diversity* — the more
distinct, on-brand variations you feed it, the better it finds the pocket that converts
([Meta GenAI/Advantage+](https://www.facebook.com/business/ads/meta-advantage-plus/creative),
[bir.ch](https://bir.ch/blog/meta-ai-creative-tools)). Agencies now ship 50+ variants/week, and
single concepts balloon to "300–1,000 creative variations"
([Campaign US](https://www.campaignlive.com/article/agency-performance-review-2025-ai-rewiring-ad-agency-workflow/1916440),
[Marketing Brew](https://www.marketingbrew.com/stories/2026/04/07/meta-ai-ad-creation)).

**So our moat isn't budget — it's creative throughput + signal discipline.** A brand-locked
factory that out-produces a human team 10×, screens itself, and mines the market for winning
patterns. That's exactly what we've built; this doc is how we point it at scale.

## 2. Your friend's playbook, corrected with data

The instinct (volume → 1–2 land → bet on the winner) is **right**. Two parts need correcting:

**(a) "5 accounts blasting paid ads" → ban risk, not a moat.** Multiple *personal profiles*
violate Meta ToS; each person may operate one personal profile and administer multiple ad
*accounts* through **one Business Manager** — that's the compliant way
([uproas](https://www.uproas.io/blog/how-to-manage-multiple-facebook-ad-accounts)). Fresh
accounts that scale fast trigger fraud/ban systems, and "circumventing systems" is its own ban
class under Meta's 2025 Andromeda enforcement
([Novabeyond](https://novabeyond.com/info-340.html),
[agencygdt](https://agencygdt.com/blog/facebook-ads-circumventing-systems/)). **We do not need
account farms.** Volume comes from *creative count*, not account count.

**(b) The cheap way to "shoot 300 and find the winner" is ORGANIC, not paid.** You can't run
300 paid tests on $7K/mo. But you *can* post 300 organic pieces for free across owned channels,
let engagement surface the 1–2 that land, and **then** put paid spend only behind proven
winners. This is the real version of the friend's story, it's cheap, and it sidesteps the
paid-account ban risk entirely.

## 3. The model: a 4-layer flywheel

```
   PRODUCE (bot, high volume)         →  the army of content
        │  brand-locked, QA'd, swipe-informed
        ▼
   ORGANIC TEST (cheap/free)          →  post at volume across owned IG/FB/Reels/TikTok
        │  signal: saves, shares, watch-time, CTR — find the 1–2 that land
        ▼
   PAID VALIDATE (disciplined, ABO)   →  winners + top engine creatives into isolated tests
        │  $300–500/creative, 7–10 days, 500+ impressions BEFORE calling it
        ▼
   PAID SCALE (CBO / Advantage+)      →  migrate validated winners; ramp gradually
        │  refresh constantly to beat fatigue → back to PRODUCE
        ▼
   [HUMAN SPEND GATE on every launch/scale — D-04]
```

Sources for each rule below.

### Layer 2 — organic test (find winners for ~$0)
Continuous production + testing is the "creative testing flywheel" that beats fatigue
([Motion](https://motionapp.com/blog/ultimate-guide-creative-testing-2025)). Organic is where
the 300/mo lives: free reach, fast read on hooks. Promote only what earns attention.

### Layer 3 — paid validate (ABO, isolate the variable)
Don't let Meta "pick a winner" in 3 days across mixed ad sets — that's not a test. Isolate one
variable per ad set, **$50–100/day**, run **7–10 days**, **$300–500 spend / 500+ impressions**
before declaring a winner; test new-vs-new (legacy winners have unfair pixel history)
([Metalla](https://metalla.digital/facebook-ad-creative-testing-2025/),
[Stackmatix](https://www.stackmatix.com/blog/meta-ads-creative-testing-framework)).

### Layer 4 — paid scale (CBO / Advantage+)
Best operators use **both in sequence**: ABO to get clean data, then migrate winners to **CBO
(now "Advantage Campaign Budget")** to automate and scale; Meta's April-2025 data showed +17%
ROAS within 6 weeks on CBO
([AdAmigo](https://www.adamigo.ai/blog/cbo-vs-abo-choosing-the-right-budget-strategy),
[RebootIQ](https://rebootiq.com/abo-vs-cbo-meta-ads/)). Budget rule of thumb: **weekly budget ≥
50× target CPA**; hold the budget 72h after launch for the algo to stabilize, then scale
gradually ([AdAmigo CBO](https://www.adamigo.ai/blog/cbo-best-practices-meta-ads)). Gradual ramp
also avoids the fast-scaling fraud flag from §2a.

## 4. Mining what already works — the swipe engine (legit)

The Meta Ad Library shows every active ad; sort by **impressions** + **active** to see a
competitor's *scaled winners*, and **longevity** (30/60/90+ days running) signals profitability
— nobody pays to keep a losing ad live
([adlibrary.com](https://adlibrary.com/meta-ads-library),
[deepsolv](https://deepsolv.ai/blog/how-to-use-the-meta-ad-library-to-find-and-analyze-competitor-ads-in-2026)).
**API caveat:** the official Ad Library API only covers political/social-issue ads globally +
*all* ad types in EU/UK (DSA) — it will **not** return US/CA STR ads programmatically
([Primores](https://primores.org/blog/meta-ad-library-api/)). So our `swipe.mjs` ingests ad
references (API where it works, or pasted/exported refs) and uses AI to extract the
**hook / angle / format pattern** — then feeds those patterns into our generator. Every source
agrees: **learn the framework, don't copy the creative** — copying is a brand + legal risk.

## 5. Revarity numbers (real)

- **CPL context:** cross-industry ~$28–42; **real estate ~$17–24**; high-ticket/B2B $100+
  ([WordStream](https://www.wordstream.com/blog/facebook-ads-benchmarks-2025),
  [SuperAds](https://www.superads.ai/facebook-ads-costs/cost-per-lead/real-estate)). Our
  `ad-angles.json` target CPL $50 is comfortable for a high-intent arbitrage lead.
- **$7K/mo math (planning, not a promise):** at a blended ~$40 CPL → ~**175 leads/mo**; our
  KPI floor is 20 booked calls → needs ~11% lead→call. Kill a creative at CPL > $75 after 500
  impressions; scale one under $40 (already in our `kpi_targets`).
- **Suggested split:** ~30% test / ~70% scale once we have a validated winner; week 1 is mostly
  test. Weekly scale budget ≥ 50× the cost-per-call/CPA target we're optimizing to.

## 6. What this means we build (and have built)

| Capability | Status |
|---|---|
| Brand-locked creative factory (copy+image+QA+regen) | ✅ built |
| Volume / "army of content" campaign mode | ✅ added this session (`pipeline.mjs` over all angles × N) |
| Swipe-file pattern miner | ✅ scaffolded (`swipe.mjs`) — feeds the generator |
| Operator hub (create/approve/budget/monitor) | ✅ built; prod storage + auth + deploy this session |
| Winner-detection + scale loop (the thresholds above) | ◐ spec'd for the Monitor loop (Phase 2, needs Meta data) |
| Organic multi-channel posting | ▢ proposed (D-09) — Higgsfield B-roll + static, owned channels |
| Bounded auto-launch (conscious D-04 exception) | ▢ your call (D-08) |

## 7. The honest risks
- **Account bans** if we farm accounts or scale fast → use one BM/many ad accounts + gradual ramp.
- **"Bet it all" without a validated signal = gambling** → enforce the $300–500/7–10d/500-imp rule.
- **AI creative looking cheap** → our QA + editorial-photography bar + human gate already address it (D-03).
- **Platform concentration** → don't research/spend Meta-only; mirror to TikTok/Reels organic.
- **D-04** → every launch/scale stays human-gated; the loop proposes, you dispose.
