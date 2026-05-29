# Proposed Decisions — for ratification (D-07 → D-10)

Drafted in the 2026-05-29 session. **Not yet binding** — `DECISIONS.md` stays the source of
truth; move these in only after Malcolm/David sign off. Each has my recommendation + why.

---

## D-07 · Meta account structure  ⛔ gates how we scale paid
**Question:** how many accounts, and how?
**Recommendation:** **One Business Manager → multiple ad *accounts* under it**, warmed up and
ramped gradually. NOT multiple personal profiles, NOT fresh accounts scaled fast.
**Why:** multiple personal profiles violate Meta ToS; fast scaling on fresh accounts trips
fraud/ban systems; "circumventing systems" is its own ban class (Andromeda enforcement, 2025).
Volume comes from creative count, not account count. (See strategy §2.)
**Owner:** David (runs the ad accounts) + Malcolm (sign-off).

## D-08 · Autonomy level for spend  ⛔ touches D-04
**Question:** keep the human spend-gate, or allow bounded auto-launch?
**Options:**
- **A (default, recommended): keep D-04.** Engine + hub propose; a human clicks launch/scale.
  We make approval *one-click and fast*, not absent. Zero new risk.
- **B (conscious exception): bounded auto-launch.** Engine may auto-launch ONLY: QA-passed
  creatives, into a single capped *test* campaign, hard $X/day ceiling, auto-kill at CPL>$75/500
  imp, full audit log, daily digest. Scaling a winner still needs a human. This is a deliberate,
  logged carve-out of D-04 — **your explicit call**, not mine to assume.
**Why it matters:** "passive" spend implies B, but B is the one place we'd be relaxing a locked
money guardrail. I built everything to support A; B is a switch we can add if you want it.
**My rec:** start A; revisit B only after we have one validated winner and trust the kill-rule.

## D-09 · Platform / channel mix  ⛔ gates the "army of content"
**Question:** Meta-only, or multi-channel organic + paid?
**Recommendation:** **Organic-first volume across owned IG / FB / Reels / TikTok** (free reach
to find winners), **paid only behind validated winners on Meta** to start.
**Why:** the cheap version of "300 posts → 1–2 land" is organic (free), not 300 paid tests on
$7K. Research-only-on-Meta and spend-only-on-Meta both leave signal on the table.
**Owner:** Vu (content/organic) + David (paid).

## D-10 · Spend philosophy / budget split  ⛔ how we deploy the $7K
**Recommendation:** ~**30% test / 70% scale** once a winner exists (week 1 is mostly test);
weekly scale budget ≥ 50× the CPA/cost-per-call target; ramp gradually; "bet on winner" capped
so one bad read can't torch the month.
**Why:** validated-winner scaling (ABO→CBO) returned +17% ROAS in Meta's 2025 data; the 50×
rule gives the algo enough events; gradual ramp avoids ban triggers. (Strategy §3–5.)
**Owner:** Malcolm (budget) + David (execution).

---

### Also worth a decision later (not blocking)
- **D-11?** Swipe-file sourcing: official Ad Library API only returns political + EU/UK ads, so
  US/CA STR competitor mining is manual-paste or a paid 3rd-party tool. Decide if a paid spy
  tool is worth it, or stick to manual references + our own winners.
- **D-12?** Whether `ads.revarity.com` ever exposes any SaaS surface (ties back to open **D-02**).
