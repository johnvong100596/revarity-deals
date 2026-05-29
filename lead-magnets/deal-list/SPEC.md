# Deal List — Lead Magnet Spec

**Asset ID:** `lead-magnets/deal-list`
**Serves:** Ad angle `AD1_DEAL_LIST` + the master landing page + nurture Email 6 ("a few deals moving this month").
**Ties to:** RevDeal / `deals.revarity.com`. This is the top-of-funnel teaser version of the marketplace.

## Purpose
Show a prospect that real, analyzed lease deals exist in their market, then
capture name/email/phone to send the live list and push to a call. It borrows
RevDeal's strongest conversion lever — honesty — and the locked RevDeal rules
apply.

## North Star: bot or human?
Rendering the teaser list and capturing the lead is repeatable → **bot.** A
human only enters when a qualified prospect wants to actually reserve a deal
(that's RevDeal Phase 1, manual-by-design, out of scope for this lead magnet).

## Locked RevDeal rules that carry over
1. **Sold/closed deals stay visible** (reduced opacity + gray badge + "Actual Y1
   beat Projected" where true) — strongest conversion lever, do not hide them.
2. **Risk callouts are featured, not buried.** Each card shows the honest risk
   line. This builds trust; it is a feature.
3. **No deposit collection in this asset.** This is a teaser. Reservations,
   accredited self-attestation gate, and ACH/wire-only deposit handling all live
   in RevDeal proper, not here. The public/teaser surface is teaser-only
   (matches the "public WhatsApp = teaser only" rule).
4. **Numbers are projections, labeled as such, with the risk shown beside them.**

## Inputs / interaction
- Prospect picks their market (same market list as the income calculator).
- Sees 2–3 teaser deal cards for that market: city, bedrooms, projected setup,
  projected monthly revenue (as a range), the featured risk line, status badge
  (Available / Closed). Closed cards shown faded with outcome where known.
- Single CTA: "Send me the full live list + get on the deal alerts."
- Form: First name, Email, Phone (required). → GHL webhook, lead source
  `deal-list`. → redirect to book-a-call.

## Data
- v1: a small curated JSON of representative deals per market, clearly marked as
  illustrative where they are not live listings. As RevDeal/`deals.revarity.com`
  comes online, this asset reads from the real deal feed (read-only, teaser
  fields only — never expose full underwriting).
- Projected figures must show a **range** and a **risk line**, never a bare
  number (same anti-hopium rule as the calculator).

## Tech
- Single React component (mirror the calculator's structure and brand styling).
- Client-side. No browser storage. No deposit/payment fields. No account
  creation. Basic PII only in the form.
- Brand tokens from `brand-kit/brand.json`. Card visual language should echo the
  existing RevDeal card design (`Rev_Deal_Flow_Demo.jsx` in the master project).

## Acceptance criteria
- [ ] Closed deals visible (faded + badge), not hidden.
- [ ] Every card shows a featured risk line.
- [ ] Projected revenue shown as a range, labeled projection.
- [ ] No deposit/payment/accreditation flow in this asset (teaser only).
- [ ] Lead form → GHL webhook (stubbed env var) → booking redirect.
- [ ] No browser storage, no account creation, basic PII only.
- [ ] Brand-matched, mobile-first, card language consistent with RevDeal.

## Build note
Lower priority than the income calculator for v1 — the calculator is the
higher-intent magnet and is fully self-contained. The deal list depends partly
on what `deals.revarity.com` exposes, so build the calculator first, then this
once the RevDeal teaser-feed shape is confirmed.
