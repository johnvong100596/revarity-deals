# Decisions — Marketing Engine Initiative

Locked vs open, scoped to this initiative. Two open decisions (D-01, D-02) gate
downstream work and need Malcolm. Four are already decided (D-03 → D-06).

## OPEN — need Malcolm sign-off

### D-01 · Pricing model  ✅ RESOLVED (Cena/COO, 2026-05-29)
**Decision: FLAT $375/month, fully-managed done-for-you, NO revenue share.** Copy may now state
"$375/mo". The pricing guard is lifted (engine allows $375/mo; flags stale `[PENDING-D01]` tokens).
The calculator cost/net side (B.5) is unblocked. **Open sub-item:** setup fee ($12K–$35K in the
blueprint) is **not yet cleared for ad copy** — confirm before stating it. Original conflict below.

### D-01 (original) · Pricing model: flat-fee vs 4-tier  ⛔ was: GATES AD COPY + CALCULATOR COST SIDE
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

## DECIDED — paid-growth (ratified by Cena/COO, 2026-05-29)
- **D-07 · Account structure ✅** One Business Manager + multiple ad *accounts*, warmed up and
  ramped gradually. No personal-profile farming (Meta ToS / ban risk). Volume = creative count, not accounts.
- **D-08 · Autonomy ✅** Keep the **D-04 human spend-gate** (make approval one-click/fast).
  **No autonomous or bounded auto-launch.** The engine + hub propose; a human disposes.
- **D-09 · Channel mix ✅** Organic-first volume across owned IG/FB/Reels/TikTok to find winners
  cheaply; **paid only behind validated winners** (Meta first).
- **D-10 · Spend split ✅** ~30% test / 70% scale once a winner exists; weekly scale budget
  ≥ 50× CPA; gradual ramp; capped "bet on winner" so one bad read can't torch the month.
- **D-11 · Swipe sourcing ✅** Manual Ad-Library refs + our own winners (official API is
  political/EU-UK only). Revisit a paid spy tool only if ROI justifies.
- **D-12 · `ads.revarity.com` scope ✅** Internal **operator** surface only — no SaaS-facing
  surface — until D-02 resolves.

## DECIDED

### D-03 · AI presenters OK for awareness creative; no AI testimonials  ✅ REVISED (COO, 2026-06-01)
**Revised decision.** AI **presenters/spokespeople** are permitted for awareness/top-of-funnel
creative — including cinematic **presenter commercials** (a host walking/presenting, built on Veo 3.1
with native synced dialogue) and a separate, clearly-labeled **UGC talking-head** lane (Arcads, gated
until contracted). Shipped ads carry an **"AI-generated / AI presenter" label** where the platform
expects it (Meta/TikTok; EU AI Act Aug-2026; NY synthetic-performer law Jun-2026).
**Still prohibited:** AI **testimonials/endorsements**, fake-client framing, and ANY guaranteed or
specific income/return/occupancy claim — these are the FTC fake-testimonial trip-wire (16 CFR 465) and
break the no-guarantee brand voice; disclosure does NOT cure them. **Social proof in the close = real
clients only** (we have real testimonial content for that). Human approval before spend still applies (D-04).
Guardrails are enforced in the prompt builders, the Director's routing brain, and the Review gate badge.

_Original rationale (still the spirit):_ AI fake-testimonial UGC is a brand + legal risk for a
high-trust, high-ticket offer and is dishonest. AI image/B-roll gen approved for furnished units,
before/after, lifestyle, B-roll.

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

### D-07 · VO provider — Higgsfield "Zoe", behind a swappable seam  ✅
Checked whether Higgsfield's "Zoe" exposes an underlying ElevenLabs voice id: it
does NOT — Zoe is a Higgsfield preset voice (voice_id
`d0374db1-44b9-4f05-939e-0a9ae9dbbe6a`, voice_type "preset"), not an ElevenLabs
voice. The voice is a locked brand asset, so continuity beats architectural
neatness: **route VO through Higgsfield** (default `VO_PROVIDER=higgsfield`).
All VO goes through ONE seam — `lib/voice.js synthesizeVO()` — so the provider
swaps via a single env var with zero caller changes; ElevenLabs stays available
as the alternate (`VO_PROVIDER=elevenlabs`). Open item: the Higgsfield audio
HTTP endpoint isn't in the codebase — set `HF_TTS_URL` (Key auth + Zoe voice_id
are wired). Until then the render assembles caption-only and flags VO pending.

### Phase-1 render branch (`phase1-drive-realphoto-bridge`) — status
Built (committed locally, NOT pushed pending repo-remote confirmation):
- `lib/drive.js` — Google Drive service-account, READ-ONLY (dep-free JWT).
- `lib/render.js` — real-photo slideshow render (ffmpeg port of build_vo_ads.sh).
- `lib/renderBatch.js` + `app/api/cron/render` — nightly 1–2/run batch → Review (HITL).
- `lib/notify.js` — Slack webhook summary. `lib/voice.js` — the VO seam (D-07).
Runtime notes: render shells to ffmpeg (ffmpeg-static / FFMPEG_PATH) + needs
FONT_*_PATH; on a runtime without them the batch preflight reports exactly what's
missing (no crash, no half-written draft). CLAIMS_APR_UNLOCKED stays UNSET —
APR/credit claims remain build-failing until leadership flips it on written terms.

### D-08 · Nightly render runs on GitHub Actions, not Vercel  ✅
Vercel serverless can't run ffmpeg, so the nightly render COMPUTE runs in
`.github/workflows/nightly-render.yml` (ubuntu, ffmpeg + fonts-liberation install
in seconds, free). It runs `ads-hub/scripts/render-batch.mjs` → the same
`lib/renderBatch` with `STORE_DRIVER=cloud` + `BLOB_READ_WRITE_TOKEN`, so drafts
write to the SAME Vercel Blob queue the live Review reads. Vercel keeps the
queue/API/orchestration (the `/api/cron/render` route stays for manual dry-run).
Removed the Vercel cron schedule for `/api/cron/render` (it would fail on
serverless). Required GitHub repo secrets mirror the Vercel env: BLOB_READ_WRITE_TOKEN,
GDRIVE_SA_JSON, GDRIVE_PHOTOS_FOLDER_ID, ANTHROPIC_API_KEY, HF_API_KEY, HF_API_SECRET,
SLACK_WEBHOOK_URL (+ optional HF_TTS_URL). Fonts on the runner = Liberation
(Arial/Georgia-metric-compatible).

### Phase-1b (approved) — remaining creative scope  ✅ BUILT
Approved scope: both ad sizes + carousel PNG export + the 2 QC gates +
approve→Meta deep-link + reject-reason log — shipped as one integrated slice.
Size correction: the second size is **1080x1350** (IG feed) per OPERATOR-PLAYBOOK
step 4 and the shipped U3–U5 precedent — the "1080x1080" in the earlier note was
wrong; nothing ships square.
- `lib/render.js` — size-parametrized (reels 1080x1920 / feed 1080x1350; y-offsets
  scale by height so the 1920 output is unchanged). voPending now trips on ANY
  silent beat (partial VO no longer reads as fully voiced).
- `lib/carousel.js` — 5-slide PNG set per placement (S1 hook photo → S2 problem →
  S3 we-do-it-all → S4 offer+disclaimer card → S5 DM card), text sourced ONLY from
  the claims-locked script.
- `lib/renderBatch.js` — each draft ships reels + feed + 10 carousel PNGs, and
  carries `qc_gates` (gate 1 voice-read, gate 2 claims-check w/ machine precheck).
- Review UI — the two playbook QC gates are HUMAN ticks; Approve is disabled until
  both are ticked. Approved money-arc cards get the Meta Ads Manager deep-LINK
  (upload/objective/AI-declare stay manual — D-04). Reject now takes a reason →
  append-only reject log (`state/reject-log.json` cloud / output/reject-log.json fs).

### Studio-freedom slice (branch `studio-freedom-and-theme`, 2026-07-05)
**D-13 · Angles PARKED, not deleted ✅** — Create no longer constrains generation to
preset angles: the operator's prompt goes to the marketing brain (Opus), which
freely decides copy, structure, and format per request. The library, Settings
editor, and overrides are intact behind `ANGLES_ENABLED=1` (restore switch if
free-prompt quality drops). NOT angles and unchanged: the claims lock
(lib/claims assertClean, generate-boundary + approve-gate), QA scoring, and the
human approve queue — infrastructure, always on.

**D-14 · Palette — AWAITING CENA'S ARBITRATION ⛔** — brand.json ("the visual law",
v1.0 2026-05-28) contradicts what ALL THREE live properties actually use
(verified from production CSS 2026-07-05): no live site is dark-ink based, none
use Manrope or JetBrains Mono (body = Inter everywhere), none use brand.json's
gold hexes (#c9a961/#e0c074), and all three are green-forward (#0c2620 ATD /
#1e4a38 revarity.com) while brand.json has no green at all. Per the no-guessing
rule the hub ships BOTH palettes behind `html[data-palette]` + a sidebar toggle:
"law" (brand.json verbatim, default) vs "family" (ATD dark-theme tokens:
#121615/#0c2620/#f5f3ef/#d9a859/#46a07c + Inter). Cena picks; then hard-set the
winner, remove the toggle, and update brand.json to match reality if "family" wins.
Shared in both: Fraunces display (the one point of agreement), brand.json's
label treatment (mono labels) under "law".

**D-15 · Remove = 30-day trash, never silent destroy ✅** — every creative card
(Review queue, Rejected section, home gallery) has Remove: plain confirm
("Remove this ad? It disappears from everywhere."), soft-delete into
`state/removed.json`, excluded from queue/gallery/counts/winner-ranking/posting
via the single readQueue() filter, bulk-select for backlog clearing, Trash
section with per-item days-left + "Put it back" + explicit "Delete now";
anything past 30 days hard-deletes on the next trash read.

## D-16 · STANDING DESIGN CHARTER (Cena, 2026-07-05) — applies from the theme slice onward
1. **One primary action per screen.** Create = the prompt box. Review =
   approve/remove. Schedule = the calendar. Everything else visually recedes.
2. **Progressive disclosure.** Advanced controls live behind one "More options"
   drawer or appear contextually after the first action — never all visible on
   load. Default answer to "where does this new button go?" is the drawer, not
   the surface.
3. **Power through a command menu (⌘K), not toolbar sprawl** — every tool
   reachable in two keystrokes at zero visual cost. This is how the studio gets
   more creative tools forever without ever getting busier.
4. **Empty states teach:** a screen with nothing shows one example and one
   button, never a blank page.
5. **Restraint reads expensive:** brand.json tokens only, generous spacing,
   two typefaces max, no decoration that isn't information. Same rule as the
   Brand 30 ad, applied to the product.
6. **Every feature must earn its pixels.** If it can't justify surface space,
   it ships in the drawer — shipping it hidden is fine, shipping it loud is not.

Charter rulings applied to existing surface (this slice):
- Two-typefaces-max OVERRIDES brand.json's third face: JetBrains Mono label
  treatment is retired in both palettes (labels ride the body face). Revisit
  with D-14 arbitration only if Cena wants it back.
- "No decoration that isn't information": the animated aurora backdrop and the
  headline shimmer animation are removed. The one sanctioned atmosphere is
  brand.json's own rule — a single static radial gold glow on dark.
