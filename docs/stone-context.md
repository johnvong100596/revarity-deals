# Module Context — Revarity Marketing Engine (standalone tooling module)

## Identity

**Type:** Standalone tooling module — **not one of the six stones.** The CTO's tooling layer for marketing + content: a brand-locked Creative Engine plus real lead-magnet assets that feed David's paid funnel, Vu's content, and Malcolm's spend decisions. It is the engine and the assets — humans run the campaigns.
**This repo's role:** See the repo's own `CLAUDE.md` (orientation) and `PLAN.md` (sequenced plan). This module already had its own agentic setup before the Revarity skills kit was installed.

## Canonical context lives in this repo (do not duplicate)

- **`CLAUDE.md`** — the authoritative session orientation (kept as-is; the kit did not overwrite it).
- **`DECISIONS.md`** — the authoritative decision register for this module (locked + open, incl. D-01 pricing model and D-02 SaaS brand separation, both gating and pending Malcolm).
- **`PLAN.md`** — the implementation task list.
- **`brand-kit/brand.json`** — brand tokens (Fraunces / Manrope / JetBrains Mono; ink/cream/gold). Brand kit is law.

## Integration map (connects to spine later — TBD)

Feeds the live Revarity funnel and the master-flow STR Profitability Calculator; the RevDeal teaser deal list is sourced here. Formal spine integration contract is not defined here — defer to `DECISIONS.md`.

## Risk gates (from this repo's own hard guardrails — see `CLAUDE.md`)

- No AI UGC / fake-testimonial video — static + B-roll only (D-03).
- No autonomous ad publishing — engine generates + QAs; human approval gates spend (D-04).
- No pricing claims while D-01 is open — pricing-agnostic copy with `[PENDING-D01]` token.
- No SaaS-facing surface while D-02 is open — STR-operator surfaces only.
- Brand kit is law — all creative/UI reads `brand-kit/brand.json`; no fourth font, no off-brand color, no emoji.
