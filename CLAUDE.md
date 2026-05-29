# CLAUDE.md — Revarity Marketing Engine

You are working inside the Revarity Marketing Engine project. Read this file
fully before doing anything. It is the orientation for this Claude Code session
and the subagent stack.

---

## What this project is

The systems Revarity's **CTO** builds to power marketing and content for the
team — specifically to feed **David's paid-ads funnel**, **Vu's (CGO) content**,
and give **Malcolm (CEO)** the visibility to make spend calls. It is not the
funnel itself (David runs that) and it is not a campaign. It is the **tooling
layer** underneath: a brand-locked Creative Engine plus the real lead-magnet
assets the funnel needs.

One-line scope: *build the engine and the assets; humans run the campaigns.*

---

## The North Star (applies to every decision here)

> "If a step is repeatable, a bot owns it. Humans only own (1) live phone calls,
> (2) on-the-ground property visits, (3) sanity-checking top-tier deal numbers
> before signing."

Push toward automation. The one defensible human exception in this project is
**approving creative before ad spend** — that's a money decision, treat it like
sanity-checking a deal before signing. Everything else (generation, QA,
estimate computation, lead capture) is bot.

## David's build filter (the discipline that scopes this folder)

> "Whatever you build on Claude either strictly serves the SaaS, or it ties to
> what we're doing at Revarity. If there's no Revarity use case, question why
> you're building it — with Claude you get carried away easily."

Every file in this folder passes that filter: the Creative Engine feeds the live
funnel; the income calculator is the master-flow STR Profitability Calculator;
the deal list is the RevDeal teaser. We explicitly **rejected** the "autonomous
AI ad factory" because it failed this filter (no proven use yet) — see
`DECISIONS.md` D-04.

---

## Hard guardrails (do not violate)

1. **No AI UGC / fake-testimonial video.** Static + B-roll only. Real clients
   are the only source of video social proof. (D-03)
2. **No autonomous ad publishing.** The engine generates and QAs; it never
   uploads to Meta. Human approval gates spend. (D-04)
3. **No pricing claims while D-01 is open.** Flat-fee vs 4-tier is unresolved.
   Generate pricing-agnostic copy with a `[PENDING-D01]` token; omit the
   calculator's cost side. (D-01)
4. **No SaaS-facing surface while D-02 is open.** Brand separation is pending
   Malcolm. STR-operator surfaces only for now. (D-02)
5. **Brand kit is law.** All creative and UI reads tokens from
   `brand-kit/brand.json`. Fraunces / Manrope / JetBrains Mono, ink/cream/gold.
   No fourth font, no off-brand color, no emoji.
6. **Privacy/security.** Lead forms capture basic PII only (name/email/phone),
   post to a GHL webhook injected at deploy (never hardcoded). No account
   creation, no sensitive/financial fields, no browser storage in components.
7. **Don't alter approved ad copy** (`creative-engine/ad-angles.json`) without
   David's sign-off.

---

## File map

```
CLAUDE.md                  ← you are here
README.md                  ← human orientation
PLAN.md                    ← the sequenced implementation plan (your task list)
DECISIONS.md               ← locked vs open decisions; D-01/D-02 gate work

brand-kit/
  brand.json               ← design tokens (authoritative)
  brand-guidelines.md      ← voice + intent

.claude/skills/creative-engine/
  SKILL.md                 ← the Creative Engine skill (invoke for any creative work)

creative-engine/
  ad-angles.json           ← approved angles + copy + KPI targets
  model-routing.json       ← subagent/model per task + MCP connectors
  prompts.md               ← prompt templates (copy, image, QA)
  output/                  ← generated creatives land here = human review queue

lead-magnets/
  income-calculator/       ← SPEC.md + working IncomeCalculator.jsx (build first)
  deal-list/               ← SPEC.md (build after RevDeal teaser-feed shape is set)

docs/
  master-plan.html         ← executive narrative of the plan (for leadership)
  pricing-conflict-memo.html   ← D-01 decision memo (for Malcolm)
  brand-separation-memo.html   ← D-02 decision memo (for Malcolm)
```

---

## Subagent routing (your existing stack)

Mapped per task in `creative-engine/model-routing.json`. Summary:
- **architect (Opus 4.7)** — creative strategy, run manifests, the master
  roadmap redo. Rare, high-leverage.
- **implementer (Sonnet 4.6)** — copy gen, image-prompt gen, building the
  lead-magnet components, Phase-2 performance analysis.
- **reviewer (Haiku 4.5)** — the high-volume QA pass on generated creatives;
  escalates to Sonnet only when genuinely uncertain.
- security-auditor / debugger / refactorer / devops (Sonnet) and
  explorer / stone-context (Haiku) as in the standard stack.

Keep the cheap model on the high-volume step. The usual cost bottleneck is QA
volume — batch it.

---

## MCP connectors

- **GoHighLevel (active)** — lead capture, pipeline, nurture. David's funnel.
  Keep an export path (GHL longevity is an open risk).
- **Meta Ads Manager (Phase 2)** — pull per-creative performance to drive the
  refresh loop. **Never** wire it to auto-publish; publishing is human-gated.

---

## How to start

1. Read `PLAN.md` for the sequence.
2. Confirm D-01 and D-02 status in `DECISIONS.md` before touching pricing or any
   SaaS surface.
3. For any creative task, invoke the `creative-engine` skill and follow its
   procedure (it ends at the human approval gate — do not cross it).
4. For the lead magnets, build the income calculator first (it's self-contained).
