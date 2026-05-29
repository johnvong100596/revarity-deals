---
name: creative-engine
description: "Use this skill whenever the task is to produce Revarity advertising or marketing creative at volume — Facebook/Instagram ad images, ad copy variations, before/after unit visuals, B-roll prompts, or to refresh creatives based on Meta performance data. Triggers: 'generate ad creatives', 'make ad variations', 'creative for the funnel', 'spin up ads for [angle]', 'refresh the winning creatives'. This skill enforces the Revarity brand kit, runs an automated QA pass, and routes everything to a human approval queue. Do NOT use this skill to publish ads directly to Meta — publishing is a human-gated action."
license: Revarity internal.
---

# Creative Engine

Turns the Revarity brand kit + an approved ad angle into a batch of
ready-for-review ad creatives (image + copy), QA'd automatically, dropped into a
human approval queue. This is the force-multiplier for David's paid funnel and
Vu's content — it 10x's output without removing the human judgment that protects
a high-ticket brand.

## North Star alignment

> "If a step is repeatable, a bot owns it. Humans only own (1) live phone calls,
> (2) on-the-ground property visits, (3) sanity-checking top-tier deal numbers
> before signing."

Creative *generation* and *QA* are repeatable → bot. **Approving creative before
ad spend is a money decision → human.** The engine produces and screens; it never
spends. That gate is non-negotiable (see `DECISIONS.md` D-04).

## What this skill is NOT

- It is **not** an autonomous ad factory. It does not auto-publish to Meta.
- It does **not** generate AI talking-head / fake-testimonial UGC video. Static
  + B-roll only. Real client testimonials are the only source of video social
  proof. (D-03.)
- It does **not** invent pricing. While D-01 (flat-fee vs 4-tier) is unresolved,
  copy is generated pricing-agnostic with a `[PENDING-D01]` token.

## Required reading before any run

1. `brand-kit/brand.json` — tokens, creative rules, specs. Authoritative.
2. `brand-kit/brand-guidelines.md` — voice and intent.
3. `creative-engine/ad-angles.json` — approved angles + copy baseline + KPI targets.
4. `creative-engine/model-routing.json` — which subagent/model runs each task.
5. `creative-engine/prompts.md` — the prompt templates.
6. `DECISIONS.md` — especially D-01 through D-04.

## Inputs

A run is parameterized by:
- `angle_ids`: which angles from `ad-angles.json` to produce (e.g. `["AD1_DEAL_LIST", "AD3_INCOME_ESTIMATE"]`).
- `variants_per_angle`: how many copy variations per angle (default 3).
- `formats`: which `creative_specs` to render (default `["meta_feed_square", "meta_story_vertical"]`).
- `mode`: `cold` (paid traffic) | `content` (Vu's organic) | `refresh` (Phase 2, perf-driven).

## Procedure

1. **Strategy (Opus / `architect`).** Read the brand + the requested angles.
   Produce a run manifest: for each angle × variant × format, one creative job.
   In `refresh` mode, read Meta performance first (Phase 2) and only manifest
   variations of creatives beating the `scale_creative_cpl_usd_under` target.

2. **Generate (Sonnet / `implementer`).** For each job:
   - Copy generation (template 1 in `prompts.md`). Honor the pricing guard.
   - Image-prompt generation (template 2).
   - Call the image-gen model (Higgsfield MCP / Nano Banana) with that prompt.

3. **QA (Haiku / `reviewer`).** Screenshot each rendered creative, run template 3.
   - `pass` → write to `creative-engine/output/<angle>/<variant>-<format>.{png,json}`
     where the `.json` carries the copy + metadata.
   - `fail` → regenerate up to 2x with the hint; if still failing, write to
     `output/_parked/` with the failure log for a human.
   - `uncertain` → escalate to Sonnet QA (template 3, deeper).

4. **Human gate.** Stop. Print a summary table of what's in `output/` (angle,
   variant, format, copy preview, QA verdict). David/Malcolm review and approve.
   The engine does NOT proceed to upload. Approval and upload are manual until
   explicitly re-scoped.

## Output contract

```
creative-engine/output/
  AD1_DEAL_LIST/
    A-meta_feed_square.png
    A-meta_feed_square.json   # { headline, body, cta, angle_id, variant, spec, qa }
    A-meta_story_vertical.png
    ...
  _parked/                    # failed-twice creatives + logs, for human eyes
  run-<timestamp>.md          # the summary table for the human gate
```

## Cost discipline

QA is the high-volume step, so it runs on Haiku. Strategy is rare, so Opus is
affordable there. If a run's projected cost exceeds expectation, the bottleneck
is almost always QA volume — batch QA calls, don't loop one image at a time.

## Phase 2: the performance loop

When Meta Ads Manager MCP is wired (`model-routing.json` → `meta_ads_manager`):
weekly, `implementer` pulls per-creative CPL/CPC/CPA/CTR, the engine identifies
winners, and `refresh` mode spawns new variations of those winners. Losers
(CPL over `kill_creative_cpl_usd_over` after `kill_creative_after_impressions`)
are flagged for a human to pause. **Pausing and launching still go through the
human gate** — the loop proposes, the human disposes.
