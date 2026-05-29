# ads.revarity.com — Operator Hub

The control surface for the Revarity marketing engine. One place for **Malcolm & David** to
create runs, generate brand-locked creatives, **approve before spend**, plan budget, and
(Phase 2) monitor performance. Next.js (App Router) + the existing Creative Engine.

> **Guardrails baked in.** The hub *proposes; a human disposes.* It never publishes to Meta
> or spends (**D-04**). No pricing is shown while **D-01** is open. It is an internal
> **operator** surface under `*.revarity.com` — not the SaaS sub-brand (**D-02**).

## Surfaces
- **Overview** — queue, auto-QA pass rate, budget plan, KPI targets, configured angles.
- **Create** — trigger the pipeline (generate → render → QA → regen). Streams the run log.
- **Review & Approve** — every creative + headline + copy + QA verdict; approve/hold/reject;
  decisions persist (`/api/approve`); export the approved set.
- **Budget** — plan monthly spend + per-angle allocation; computes target leads/calls. No spend.
- **Monitor** — Phase 2: live CPL/CPC/CPA/CTR vs targets (Meta Ads MCP, read-only).

## Run locally
```bash
cd ads-hub
npm install
cp .env.example .env.local      # optional: set HUB_BASIC_AUTH; leave empty for open dev
npm run dev                      # http://localhost:4321
```
The hub reads the engine's output from the parent project (`ENGINE_DIR=..`). "Create → Run
pipeline" spawns `../creative-engine/pipeline.mjs`, so the engine's `.env.local`
(GEMINI_API_KEY etc.) must be set. Generated creatives appear in **Review** automatically.

## Architecture
- `lib/store.js` — storage abstraction. `STORE_DRIVER=fs` (default) reads the engine's local
  output + writes `approvals.json`. **The pages/API never touch the FS directly** — swap the
  driver for production without touching the UI.
- `lib/engine.js` — spawns the pipeline (local/VM). `app/api/*` — queue / run / approve /
  image / metrics / health (all Node runtime).
- `middleware.js` — HTTP Basic auth (MVP) via `HUB_BASIC_AUTH`.

## Production (Vercel) — what changes
Serverless has an **ephemeral, read-only FS** and **can't spawn long child processes**, so two
things must change before deploy:
1. **Storage** → implement a `blob`/`db` driver in `lib/store.js`: **Vercel Blob** for the PNGs,
   **Postgres** (Neon) for queue records + approvals. Set `STORE_DRIVER=blob`.
2. **Run** → move the engine steps into a **background job / queued function** (the render +
   QA calls are long); have it write to Blob/DB. `Create` enqueues; `Review` reads from the DB.
3. **Auth** → replace Basic auth with **Clerk** (native Vercel Marketplace) for Malcolm/David.
4. **Monitor** → wire the **Meta Ads MCP (read-only)** + GHL pulls into `/api/metrics` once
   spend is live (PLAN Stream E/F). Still proposes only (D-04).
5. Add domain `ads.revarity.com` in Vercel; set env vars; deploy.

Nothing about the deploy changes the spend gate — pushing creatives live to Meta remains a
human action performed outside this hub.
