# Stack — Revarity Marketing Engine (standalone module)

> This module predates the Revarity skills kit and has its own structure (`creative-engine/`, `brand-kit/`, `lead-magnets/`, `docs/`). For authoritative setup, read the repo root **`README.md`** and **`CLAUDE.md`**. This file exists only so `revarity-context` resolves.

## Known
- Brand tokens: `brand-kit/brand.json` — Fraunces / Manrope / JetBrains Mono; ink / cream / gold. Brand kit is law.
- Creative Engine: brand-locked generation + QA (`creative-engine/`); output reviewed before any ad spend.
- Its own `.mcp.json` (kept as-is by the installer — not overwritten).

## Secrets discipline
- Env vars only (`.env.local`; `.env.example` documents shape). Never committed.
- GitHub PAT stays in `${GITHUB_PAT}` env var, never in `.mcp.json`.

## Deviations
Defer to the repo's own `CLAUDE.md` / `README.md`. Any deviation requires human dev sign-off.
