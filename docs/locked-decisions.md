# Locked Decisions — Revarity Marketing Engine (standalone module)

> ⚠️ The authoritative decision register for this module is **`DECISIONS.md`** at the repo root — NOT this file. It predates the Revarity skills kit and is canonical. This file exists only so the `revarity-context` skill resolves; it lists the cross-cutting decisions and points to `DECISIONS.md` for everything module-specific. Do not duplicate or fork decisions here.

## Canonical source
- **`DECISIONS.md`** (repo root) — locked: D-03 (no AI UGC video), D-04 (no autonomous ad publishing), D-05, D-06. Open + gating: D-01 (pricing model, needs Malcolm), D-02 (SaaS brand separation, needs Malcolm).

## Cross-cutting decisions (apply to all Revarity repos)

### D-001 · Subdomain map
**Decision:** All web surfaces use subdomains under `revarity.com`. (Note: D-02 in `DECISIONS.md` may revisit brand separation for the SaaS line — defer to it.)
**Locked:** 2026-04 by CTO, ratified by CEO
**Rationale:** Brand consolidation, deliverability, SEO discipline.

### D-003 · Audit trail mandatory
**Decision:** Every AI action on production data must be logged with input context, model, output, and human override (if any). Applies to the Creative Engine's generation/QA actions.
**Locked:** 2026-03 by CTO, ratified by CEO
**Rationale:** Auditability is non-negotiable.

### D-004 · Locked-decision violation = BLOCKER
**Decision:** Any PR that contradicts a locked decision (here or in `DECISIONS.md`) is BLOCKED regardless of code quality. No override without CTO sign-off.
**Locked:** 2026-05 by CTO
**Rationale:** Locked means locked.
