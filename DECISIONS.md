# Decisions — Marketing Engine Initiative

Locked vs open, scoped to this initiative. Two open decisions (D-01, D-02) gate
downstream work and need Malcolm. Four are already decided (D-03 → D-06).

## OPEN — need Malcolm sign-off

### D-01 · Pricing model: flat-fee vs 4-tier  ⛔ GATES AD COPY + CALCULATOR COST SIDE
- **The conflict.** David's blueprint sells a flat **$375/mo, no revenue share,
  setup $12K–$35K**. Master-flow Stone 03 sells a **4-tier** model
  (Entry / Core / Premium / Portfolio). Ads and the close pitch currently
  contradict each other.
- **Why it can't wait.** If ads promise flat $375 and the closer pitches tiers,
  trust dies on the call and the CPA targets are fiction. You also can't A/B
  honestly.
- **Recommendation: two-funnel (Option C in the memo).** Flat-fee as the clean
  cold-paid hook → fit revealed on the call → tiers for the SEO/inbound motion.
- **Until resolved:** Creative Engine generates pricing-agnostic copy with a
  `[PENDING-D01]` token. Calculator omits the cost/net side.
- **Memo:** `docs/pricing-conflict-memo.html`. **Owner:** Malcolm + Cena.

### D-02 · SaaS brand separation + affiliate channel  ⛔ GATES ANY SAAS-FACING SURFACE
- **David's proposal.** Spin the lease-research SaaS out under its own brand so
  Revarity can vouch for it without looking self-serving (Yaman model), and so
  competitors will resell it via affiliate.
- **The cost.** Breaks the locked all-`*.revarity.com` architecture — needs its
  own domain, ad account, funnel, identity, support.
- **Recommendation: separate brand/face, shared spine behind it (Option C).**
  Consistent with the connector-edge SaaS posture and the shared Postgres spine.
- **Does NOT block:** the STR-operator funnel, the Creative Engine, the lead
  magnets. Build those now regardless.
- **Memo:** `docs/brand-separation-memo.html`. **Owner:** Malcolm.

## OPEN — drafted, awaiting ratification (see `docs/proposed-decisions.md`)
These came out of the 2026-05-29 paid-growth working session. **Proposed only — not binding**
until Malcolm/David sign off; the build already leans on the recommended defaults but reversibly.
- **D-07** Meta account structure (rec: one Business Manager + multiple ad accounts, gradual ramp).
- **D-08** Autonomy level (rec: keep the D-04 human spend-gate; bounded auto-launch only as a conscious, logged exception — your call).
- **D-09** Channel mix (rec: organic-first volume across owned channels; paid only behind validated winners).
- **D-10** Spend split (rec: ~30% test / 70% scale; weekly scale ≥ 50× CPA).
- **D-11** Swipe-file sourcing (Ad Library API is political/EU-UK only → manual refs or a paid tool).
- **D-12** Whether `ads.revarity.com` ever exposes a SaaS surface (ties to open D-02).

## DECIDED

### D-03 · No AI UGC video — static + B-roll only  ✅
AI talking-head / fake-testimonial UGC is a brand risk for a high-trust,
high-ticket offer and is dishonest. Video social proof = real clients only.
AI image gen approved for furnished units, before/after, lifestyle, B-roll.

### D-04 · No autonomous ad publishing — human gate before spend  ✅
The Creative Engine generates and QAs; it never auto-publishes to Meta.
Approval before ad spend is a money decision and stays human. The Phase-2
performance loop proposes; the human disposes.

### D-05 · Contractor engagement — Option 1  ✅
Dial in Phase 1 properly, then build Phase 2/3. Retain David past the month.
His extra scope (pitch decks, sales SOPs, agreement automation, onboarding)
maps to master-flow Stone 03 Phases 2–3 — not scope creep, the same roadmap.

### D-06 · Higgsfield adoption — yes, inside the engine; not standalone  ✅
Use Higgsfield / Nano Banana for static + B-roll generation, orchestrated by
the Creative Engine skill via Claude Code. Not adopted as a standalone
"autonomous ad factory."

## Carried-over locked rules touched by this work
- All operator surfaces under `*.revarity.com` (D-02 is the open exception).
- RevDeal: sold cards visible; risk featured; ACH/wire-only deposits >$10K;
  accredited self-attestation gate (deal-list magnet is teaser-only, none of
  the deposit flow applies there).
- Full audit logging on every RevOS AI action.
- GHL longevity is an open master-flow risk — keep an export/migration path.
