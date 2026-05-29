# Working Session — 2026-05-29 (autonomous)

**Mandate (Cena/COO, stepping away 5–10h):** do hub items 1/2/3 (prod storage refactor,
deploy, Clerk auth); re-check the pipeline against our original guidelines so we're not
missing anything; think like an operator about generating ad spend + content *passively*;
deep-research how successful founders scale AI ad spend; decide if we need multiple Meta
accounts running constantly; build an engine to capture which ads work online and an "army
of content" to shoot at volume (the friend's model: 5 accounts, 10 posts/day, ~300/mo,
1–2 land, bet on the winner, repeat); make decisions on real data; use/创建 any tools.

This doc is the thing we discuss when you're back. Deep playbook + numbers live in
`docs/ad-scaling-strategy.md`. Decisions to ratify live in `docs/proposed-decisions.md`.

---

## 1. Re-grounding — why this exists (so we don't drift)

From `CLAUDE.md` / `DECISIONS.md`, unchanged and still binding:

- **What we're building:** the *tooling layer* under David's paid funnel + Vu's content —
  a brand-locked Creative Engine + real lead-magnet assets. "Build the engine and the
  assets; humans run the campaigns." `ads.revarity.com` is the operator console on top.
- **North Star:** if a step is repeatable, a bot owns it. The *one* defensible human
  exception in this project is **approving creative before ad spend** — a money decision,
  treated like sanity-checking a deal before signing.
- **David's filter:** if it doesn't strictly serve the SaaS or tie to Revarity, question why
  we're building it. (Keeps us from building a generic "AI ad factory" for its own sake.)
- **Locked guardrails:** D-01 pricing open → no hardcoded price, `[PENDING-D01]`. D-03 → no
  AI testimonial/talking-head; static + B-roll only. **D-04 → no autonomous publishing; human
  gate before spend; the loop proposes, the human disposes.** D-06 → Higgsfield inside the
  engine, not a standalone factory. Brand kit is law.

## 2. The honest check — friend's playbook vs. our rules + Meta's ToS

You asked me to make sure we're not missing anything. Here's the real tension, with sources
(full cites in the strategy doc):

| Friend's move | Reality | Our compliant version |
|---|---|---|
| **5 Meta accounts blasting** | Multiple *personal profiles* violates Meta ToS; fresh accounts that scale fast trigger fraud/ban; "circumventing systems" is a real ban class. | **One** Business Manager + **multiple ad *accounts*** under it (allowed, normal at scale). Warm them up; ramp gradually. Volume comes from *creative count*, not account count. |
| **Auto-blast 300 posts/mo** | The volume thesis is correct — Meta's algo rewards creative diversity; agencies ship 50+/wk, even "300–1000 per concept." | Generate at volume (bot) → auto-QA (bot) → **human approves before spend (D-04)**. We make approval one-click and fast, not absent. |
| **"Bet everything on the ad that lands"** | Directionally right (winners get the budget) — but real testing needs isolation + $300–500/creative + 7–10 days before you *know* it's a winner. "Bet it all" without that signal is gambling. | Encode the real winner-rule (impressions/spend/time thresholds) in the Monitor loop; scale the *validated* winner; kill losers by rule. Loop proposes; human commits the scale. |
| **"Copy/paste the ads that work"** | Mining winners is standard (Meta Ad Library). But copying creative is both a brand risk and, per every source, the wrong play. | **Swipe-file → pattern extraction:** ingest winning ads, have AI extract the *hook/angle/format pattern*, feed those patterns into our brand-locked generator. Learn the framework, generate original. |

**Bottom line:** the playbook is right in spirit and we should absolutely build for volume +
winner-detection + scale. We get the *same outcome* without the ban risk or the D-04
violation by: one BM / many ad accounts, gradual ramp, volume via creative not accounts, and
a fast human spend-gate instead of fully-autonomous betting. None of this is missing from our
design — it sharpens it.

## 3. The strategy in one paragraph

Treat creative as the only real variable (Meta's auto-targeting/Advantage+ now does the
audience work). Our moat is a **brand-locked creative factory** that out-produces a human
team 10×, screens itself, and mines the market for winning patterns — feeding a disciplined
**test → detect winner → scale winner → refresh** flywheel. We don't need account farms; we
need *creative throughput* + *signal discipline* + a *one-click human spend gate*. Full model,
numbers, and platform mix in `docs/ad-scaling-strategy.md`.

## 4. What I built this session (status at bottom; details inline in commits)

1. **Hub → production-ready (items 1 & 3):** swappable storage driver (filesystem → Vercel
   Blob + Postgres) so it survives serverless; Clerk auth scaffolding behind env flags.
2. **Hub → deploy prep (item 2):** `vercel.json`, env mapping, `DEPLOY.md` runbook. Final
   `vercel deploy` + Blob/Postgres provisioning + domain + Clerk keys need your login (flagged).
3. **Swipe engine:** `creative-engine/swipe.mjs` — ingests winning-ad references, extracts
   hook/angle/format patterns with AI, writes a swipe-patterns file the generator reads.
4. **Volume / campaign mode:** the engine can now mass-produce across all angles × N variants
   × formats (the "army of content"), still QA'd + human-gated.
5. **Winner→scale loop spec:** the real thresholds encoded for the Monitor/Phase-2 loop.
6. **Decisions to ratify:** `docs/proposed-decisions.md` (D-07..D-10).

## 5. Open decisions for you (in `docs/proposed-decisions.md`)
- **D-07** Account structure: one BM + N ad accounts, gradual ramp (recommended) vs. status quo.
- **D-08** Autonomy level: keep the human spend-gate (D-04) but make it one-click? Or do you
  want me to design a *bounded* auto-launch (hard $/day cap, only QA-passed, only into a test
  campaign) — this would be a conscious, logged exception to D-04, your call.
- **D-09** Platform mix: Meta-only now, or also TikTok/Reels organic for the cheap-volume top.
- **D-10** Spend philosophy: test budget vs. scale budget split of the $7K; "bet on winner" cap.

> Everything I built stops at the human spend gate. Nothing here publishes or spends. (D-04)

---

## STATUS — verified at end of session

**Hub (1/2/3):**
- ✅ **(1) Production storage** — `ads-hub/lib/store.js` driver pattern (fs → Vercel Blob+Postgres);
  `lib/schema.sql`, `scripts/ingest.mjs`. `next build` passes with the cloud driver present
  (webpack-ignored so the fs build needs nothing installed).
- ◑ **(2) Deploy** — fully prepped: `vercel.json`, `.env.example`, `DEPLOY.md` runbook. The final
  `vercel` deploy + Postgres/Blob provisioning + domain + secrets **need your login** (can't auth as you).
- ✅ **(3) Clerk auth** — complete activation kit in `ads-hub/clerk/` + `CLERK.md`; Basic auth stays
  the working default so the app runs today. ~5-min flip once you have keys.

**Growth engine (the real ask):**
- ✅ **Swipe miner** `creative-engine/swipe.mjs` — ran: 6 refs → 33 reusable patterns
  (`swipe-patterns.json`), now feeding copy-gen. Add real Ad-Library refs to `swipe-inbox.json`.
- ✅ **Volume/campaign mode** — engine is env-driven (`ANGLES=all VARIANTS=n …`). Ran the **full
  5-angle catalog × 2 × 2 = 20 creatives**: generated (swipe-informed) → rendered → auto-QA →
  regen. **20/20 pass.** Review sheet + `ads-dashboard.html` rebuilt over all 20.
  - *Accuracy note (added post-audit):* the **20/20** figure is the **5-angle catalog** run (passed after
    1 regen). The **later 17-concept** run (`concepts.json`) was **9/17 pass, 8 parked** on first QA — the
    8 parked were promoted as **ink-only** ads (the photographic background QA doesn't apply to the ink
    layout; copy was already workflow-vetted). Don't read "20/20" as the concept run.
- ◑ **Winner→scale loop** — thresholds spec'd (strategy §3); live wiring is Phase 2 (needs Meta data).

**Verified working:** copy-gen is a real model call (Gemini fallback; Sonnet/Haiku when
ANTHROPIC_API_KEY added); hub serves the queue + streams images + persists approvals; full
pipeline + swipe + volume + regen run end-to-end.

**Needs you:** ① ratify D-07–D-10; ② Vercel login (deploy) + provision Postgres/Blob;
③ Clerk keys; ④ ANTHROPIC_API_KEY (sharper copy + independent Haiku QA); ⑤ the D-08 call on
whether we ever allow bounded auto-launch, or keep the one-click human gate (my rec: keep it).

**Did NOT do (by guardrail/honesty):** no Meta accounts created, no spend, no auto-publish, no
account-farming, no scraping. All proposed, all reversible, all yours to approve.
