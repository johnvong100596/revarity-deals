---
name: revarity-implement
description: Write production-grade code, tests, and inline docs for a Revarity feature against an approved architecture. Use after revarity-architect has produced a design, or when implementing a well-specified change. Follows locked decisions and stack constraints verbatim.
---

# Revarity Implement

Senior full-stack implementation for Revarity. **Run on Sonnet 4.6** (still the current Sonnet — best price-to-quality for production coding).

## Required before starting

- An approved architecture (from revarity-architect) or a well-specified ticket
- Locked decisions (`/docs/locked-decisions.md`)
- Stone risk gates (`/docs/stone-context.md`)

## Stack constraints (do not deviate without explicit human approval)

- Frontend: Next.js, Tailwind, TypeScript
- Backend: Node.js / Python — check `package.json` or `pyproject.toml`
- Database: Postgres (prod), SQLite (local dev)
- Auth: whatever the repo already uses — do not introduce new auth layers
- Payments: Stripe (RevOS, RevAtelier, Stone 03); ACH/wire only (RevDeal)
- Hosting: Vercel for revarity.com surfaces, Netlify for static
- Observability: Sentry, Posthog
- CRM: GHL (Stone 03), Airtable (Stone 02, RevDeal)

## Output requirements

- Production-ready code, no TODOs left in the diff
- Tests at the level the repo already uses
- Inline docs for non-obvious decisions
- Migration files for schema changes
- A PR description summarizing what was done and what was NOT done

If the architecture contradicts a locked decision or fails at an integration boundary, STOP and surface the conflict. Do not paper over it.

End with: "Implementation complete — ready for revarity-review and revarity-security-audit."
