# Revarity Marketing Engine

The CTO's tooling layer for marketing + content. Built to feed David's paid
funnel, Vu's content, and Malcolm's spend decisions — without removing the human
judgment that protects a high-ticket brand.

**This folder is built to be dropped into a Claude Code session.** Open it,
point Claude Code at it, and it reads `CLAUDE.md` → `PLAN.md` and goes.

## What's here

| Path | What it is |
|------|-----------|
| `CLAUDE.md` | Orientation for the Claude Code session. Read first. |
| `PLAN.md` | The sequenced implementation plan (the task list). |
| `DECISIONS.md` | Locked vs open decisions. D-01 and D-02 need Malcolm. |
| `brand-kit/` | `brand.json` (tokens) + guidelines. The visual law. |
| `.claude/skills/creative-engine/SKILL.md` | The Creative Engine skill. |
| `creative-engine/` | Angles, model routing, prompts, output queue. |
| `lead-magnets/income-calculator/` | Spec + working React component. |
| `lead-magnets/deal-list/` | Spec (build after RevDeal teaser-feed). |
| `docs/` | Executive plan + the two decision memos (open in a browser). |

## Start order

1. **Read** `docs/master-plan.html` (the executive narrative).
2. **Send** the two memos in `docs/` to Malcolm — `D-01` and `D-02` gate the
   paid launch and any SaaS surface.
3. **Build** in parallel (decision-independent): the Creative Engine and the
   income calculator. See `PLAN.md` Streams A and B.
4. **Hand** approved creatives + live lead-magnet URLs to David for the funnel.

## The two lines we hold

- **No AI fake-testimonial video.** Static + B-roll only; real clients for
  video social proof.
- **No autonomous ad publishing.** The engine generates and QAs; humans approve
  before any spend.

## Pricing/security note for whoever builds

Don't hardcode a price anywhere — D-01 (flat-fee vs 4-tier) is open. Lead forms
take name/email/phone only and post to a GHL webhook injected at deploy; no
account creation, no stored/sensitive data, no browser storage in components.
