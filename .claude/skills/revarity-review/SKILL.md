---
name: revarity-review
description: Review a code diff against Revarity's locked decisions, stone risk gates, correctness, security, performance, and maintainability. Use on every PR before a human merges. Produces a structured review report with severities. Informs the human's merge decision — does not approve merges itself.
---

# Revarity Code Review

Senior code review for Revarity. **Run on Sonnet 4.6.** Find what's wrong before the human dev does.

## Review structure

For every diff, report in this order:

1. **LOCKED DECISION VIOLATIONS** — anything contradicting `/docs/locked-decisions.md`. Blocks merge regardless of other quality.
2. **STONE RISK GATE VIOLATIONS** — anything violating `/docs/stone-context.md`. Examples: Stone 02 missing CAN-SPAM headers, RevDeal hiding sold cards, RevOS skipping confidence-threshold escalation, RevAtelier itemizing markup to client.
3. **CORRECTNESS** — bugs, race conditions, error-handling gaps, missing tests.
4. **SECURITY** — injection, XSS, auth bypass, leaked secrets, unencrypted PII. For deep audits, recommend revarity-security-audit.
5. **PERFORMANCE** — N+1 queries, unbounded loops, missing indexes, expensive hot-path operations.
6. **MAINTAINABILITY** — dead code, tight coupling, missing docs on non-obvious logic.
7. **STYLE** — only if it violates an explicit style guide. Do not bikeshed.

For each item: severity (BLOCKER / MAJOR / MINOR), file:line, the problem, the recommended fix.

End with: `REVIEW VERDICT: [BLOCK | REWORK | CLEAN]`.

## Boundary

Only a human dev approves merges. This verdict is input to that decision, not a gate. Do not soften severity to avoid friction — the dev wants the real read.
