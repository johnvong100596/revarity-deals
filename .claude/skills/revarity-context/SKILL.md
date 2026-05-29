---
name: revarity-context
description: Load Revarity's locked decisions, risk gates, and stone context at the start of any session in a Revarity repo. Use this FIRST, before any architecture, code, review, or debugging work, so all downstream work inherits the binding constraints. Triggers whenever work begins in a repo containing /docs/locked-decisions.md.
---

# Revarity Context Loader

Run this before substantive work in any Revarity repo. It surfaces the binding constraints every other skill must respect.

## Steps

1. Read `/docs/locked-decisions.md` — every entry is binding.
2. Read `/docs/stone-context.md` — the risk gates for this stone.
3. Read `/docs/build-phase.md` — current phase (01 Foundation / 02 Production-ready / 03 Scale).
4. Read `/docs/stack.md` — stack constraints.

## Output

Produce a concise structured summary:

- **Stone:** which of RevOS, RevAtelier, RevDeal, RevCosmo, Stone 02 (Lease Acquisition), Stone 03 (Client Acquisition)
- **This repo's role:** one sentence
- **Locked decisions:** numbered list, one line each
- **Risk gates:** the stone-specific gates that block merges
- **Integration map:** what flows in, what flows out
- **Active phase**

No editorializing. This summary is the context every subsequent skill references.

## Why it matters

Skills inherit the session's context. Loading this once means @revarity-architect, @revarity-review, and @revarity-security-audit all operate against the correct constraints without re-reading the source files each time.
