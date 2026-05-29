# PLAN.md — Sequenced Implementation Plan

This is the executable plan for the Marketing Engine initiative. It sequences
the four workstreams (the "all of the above" from the decision) so that the two
gating decisions get unblocked first and decision-independent build runs in
parallel. Owners are tagged **HUMAN**, **BOT**, or a **subagent**.

Cross-references: `DECISIONS.md` (D-xx), `creative-engine/SKILL.md`,
master-flow Stone 03 phases, and David's blueprint phases.

---

## The shape of it

```
WEEK 0        WEEKS 1–4                    WEEKS 4–9 (Phase 2)
─────────     ─────────────────────────    ──────────────────────────
DECISIONS  →  BUILD (decision-independent)  →  PERFORMANCE + SCALE
 D-01 memo     A. Creative Engine               E. Meta perf loop
 D-02 memo     B. Income calculator             F. Malcolm dashboard
 (Malcolm)     C. Deal list (after RevDeal)     G. SaaS surface (if D-02=yes)
               D. Wire into David's funnel
```

Phase 1 ships a working STR-operator funnel with engine-produced creatives.
Phase 2 ships the learning loop and leadership visibility. Nothing waits on a
big-bang launch — each stream ships standalone value (master-flow principle).

---

## STREAM 0 · Unblock the decisions  ·  WEEK 0  ·  GATES EVERYTHING DOWNSTREAM

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| 0.1 | Deliver pricing-conflict memo to Malcolm + Cena | **HUMAN** (Cena) | Memo sent: `docs/pricing-conflict-memo.html` |
| 0.2 | Malcolm decides D-01 (rec: two-funnel) | **HUMAN** (Malcolm) | D-01 marked resolved in `DECISIONS.md` |
| 0.3 | Deliver brand-separation memo to Malcolm | **HUMAN** (Cena) | Memo sent: `docs/brand-separation-memo.html` |
| 0.4 | Malcolm decides D-02 (rec: separate brand, shared spine) | **HUMAN** (Malcolm) | D-02 marked resolved |

**Why first:** D-01 unblocks final ad copy + the calculator cost side. D-02
unblocks any SaaS-facing surface and the domain/ad-account setup. Everything
below that doesn't touch pricing or a SaaS surface can proceed in parallel
immediately — do not idle waiting on Malcolm.

---

## STREAM A · Creative Engine  ·  WEEKS 1–3  ·  decision-independent

The core build. Invoke `.claude/skills/creative-engine/SKILL.md`.

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| A.1 | Stand up the skill + read brand.json / ad-angles.json | **architect** (Opus) | Skill loads, validates config |
| A.2 | Implement copy-gen step (template 1, pricing guard on) | **implementer** (Sonnet) | Returns valid JSON variants; honors `[PENDING-D01]` |
| A.3 | Implement image-prompt-gen step (template 2) | **implementer** (Sonnet) | Produces brand-correct prompts |
| A.4 | Wire image-gen model (Higgsfield MCP / Nano Banana) | **implementer** (Sonnet) | Renders an asset from a prompt |
| A.5 | Implement QA pass (template 3) on Haiku, Sonnet escalation | **reviewer** (Haiku) | Catches garbled text + off-brand; writes verdict JSON |
| A.6 | Implement output queue + run summary (`output/run-<ts>.md`) | **implementer** (Sonnet) | Passes land in `output/`, summary table generated |
| A.7 | First real run: AD3 (income) + AD1 (deal list), 3 variants × 2 formats | **BOT** orchestrated | ~12 creatives in the human queue |
| A.8 | **HUMAN GATE:** David/Malcolm review + approve queue | **HUMAN** | Approved set marked; engine stops here |

**Ships:** a repeatable creative pipeline producing brand-locked, QA'd ad
creatives into a review queue, at ~10x manual throughput, money gate intact.

**Acceptance:** no creative with garbled text reaches the queue; no off-brand
color; no fabricated-face testimonials; no pricing claim while D-01 open; engine
never publishes.

---

## STREAM B · Income calculator  ·  WEEKS 1–2  ·  decision-independent (cost side waits on D-01)

Spec: `lead-magnets/income-calculator/SPEC.md`. Starter component already built
(`IncomeCalculator.jsx`).

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| B.1 | Replace placeholder ADR/occupancy constants with PriceLabs/AirDNA data | **implementer** (Sonnet) + **HUMAN** data pull | Real bands per market, still labeled estimate |
| B.2 | Wire GHL webhook env var + booking redirect | **devops** (Sonnet) | Form posts to GHL; lead lands tagged `income-calculator` |
| B.3 | QA: range-only output, estimate labels, footnote visible, no storage | **reviewer** (Sonnet) | All SPEC acceptance criteria pass |
| B.4 | Embed on `partners.revarity.com` (or SaaS domain if D-02=yes) | **devops** (Sonnet) | Live, mobile-tested, loads < 3s |
| B.5 | (after D-01) Add net/cost side honoring the resolved pricing model | **implementer** (Sonnet) | Cost side matches D-01 decision |

**Ships:** the highest-intent lead magnet, live and feeding GHL — also reused as
the master landing page "What It Costs" widget.

---

## STREAM C · Deal list  ·  WEEKS 2–4  ·  after RevDeal teaser-feed shape confirmed

Spec: `lead-magnets/deal-list/SPEC.md`. Lower priority than B.

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| C.1 | Confirm `deals.revarity.com` teaser-feed field shape | **HUMAN** + **stone-context** (Haiku) | Teaser fields documented |
| C.2 | Build deal-list component (mirror calculator brand styling) | **implementer** (Sonnet) | Cards render; closed deals visible+faded; risk line featured |
| C.3 | Wire GHL webhook + booking redirect, lead source `deal-list` | **devops** (Sonnet) | Lead lands tagged |
| C.4 | QA: no deposit/accreditation flow (teaser only), range+risk shown | **reviewer** (Sonnet) | SPEC acceptance criteria pass |

**Ships:** the deal-list magnet, consistent with RevDeal's honesty rules,
teaser-only (no deposit flow).

---

## STREAM D · Wire creatives into David's funnel  ·  WEEKS 3–4  ·  David-led, our assets feed it

This is David operating his blueprint; our job is handing him approved assets
and the working lead-magnet endpoints.

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| D.1 | Hand approved creatives (Stream A.8) to David | **HUMAN** | David has the set |
| D.2 | Hand live lead-magnet URLs (B.4, C.4) to David | **HUMAN** | URLs wired into FB lead forms + delivery |
| D.3 | David builds FB/IG campaigns, lead forms, GHL workflows, nurture | **HUMAN** (David) | Blueprint Phase 1 checklist complete |
| D.4 | End-to-end test (dummy lead → delivery → booking → pipeline) | **HUMAN** (David) + **BOT** assist | Email+SMS < 60s, pipeline updates fire |
| D.5 | Go live | **HUMAN** (Malcolm sign-off on spend) | $7K/mo campaign live |

**Ships:** David's blueprint Phase 1 — working funnel converting on the new
architecture, fed by engine creatives and real lead magnets.

---

## STREAM E · Meta performance loop  ·  WEEKS 4–9  ·  PHASE 2 (needs live spend data)

Do not start before there's performance data (post D.5).

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| E.1 | Wire Meta Ads Manager MCP (read-only perf) | **devops** (Sonnet) | Pull CPL/CPC/CPA/CTR per creative |
| E.2 | Implement `refresh` mode: spawn variations of winners | **implementer** (Sonnet) | New variants generated for creatives under the scale-CPL target |
| E.3 | Flag losers for human pause (over kill-CPL after 500 impressions) | **reviewer** (Haiku) | Loser list surfaced |
| E.4 | **HUMAN GATE** on every launch/pause | **HUMAN** | Loop proposes, human disposes |

**Ships:** a learning loop that compounds the winners while keeping spend
decisions human.

---

## STREAM F · Malcolm dashboard  ·  WEEKS 4–9  ·  PHASE 2

Malcolm's "build" is visibility, not a tool he operates.

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| F.1 | Define metrics: spend, CPC, CPL, cost/call, CPA, close rate, revenue closed | **architect** (Opus) | Metric list locked (blueprint Phase 2 + master-flow Stone 03 metrics) |
| F.2 | Build dashboard pulling GHL + Meta (read-only) | **implementer** (Sonnet) | Live dashboard, brand-matched |
| F.3 | Weekly auto-summary to Malcolm (spend → ROI, one screen) | **devops** (Sonnet) | Summary delivered on cadence |

**Ships:** Malcolm sees spend → ROI in one place and can make the scale call.

---

## STREAM G · SaaS sub-brand surface  ·  WEEKS 4+  ·  ONLY IF D-02 = separate

Blocked until D-02 resolves. If yes:

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| G.1 | Register SaaS brand name + domain | **HUMAN** (Malcolm/Cena) | Domain live, wildcard cert |
| G.2 | Stand up separate ad account + funnel for the SaaS | **HUMAN** (David) | Separate FB ad account, separate creatives |
| G.3 | Affiliate mechanics (tracking, payout, competitor-friendly framing) | **implementer** (Sonnet) + **HUMAN** | Affiliate links + attribution work |
| G.4 | Shared spine behind it (Postgres/governance), separate face | **architect** (Opus) | SaaS reads shared spine; brand is distinct |

**Ships:** the lease-research SaaS as its own brand with an affiliate channel —
separate face, shared backend.

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| D-01 unresolved when ads launch | **High** | Pricing guard blocks copy; do not launch paid until resolved |
| AI creative looks cheap / off-brand and hurts a high-ticket brand | **High** | QA pass + human gate + D-03 (no AI UGC); real testimonials for video |
| Autonomous loop spends money on a bad creative | **High** | D-04 human gate on every launch/pause; loop only proposes |
| GHL longevity (master-flow open risk) | **Med** | Keep export/migration path; don't deep-couple |
| Placeholder calculator data presented as real | **Med** | Constants isolated + labeled; replace with PriceLabs/AirDNA before scale; range + footnote in UI |
| Contractor spreads thin (Option 2 temptation) | **Med** | D-05: Option 1, Phase 1 properly; retain past month |
| Brand separation breaks domain architecture | **Med** | D-02 Option C: separate face, shared spine; explicit domain/cert task (G.1) |
| Scope creep on Claude builds | **Med** | David's filter in CLAUDE.md: ties to SaaS/Revarity or don't build |

---

## The human/bot map (North Star applied)

**BOT owns:** creative generation, image-prompt generation, QA pass, estimate
computation, lead capture, nurture, performance pulls, variation spawning,
dashboard assembly.

**HUMAN owns:** approving creative before spend (money decision), the D-01/D-02
calls, the discovery/close calls (David's team), confirming real market data,
and every ad launch/pause. Everything repeatable is already a bot.
