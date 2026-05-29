# Income Calculator — Lead Magnet Spec

**Asset ID:** `lead-magnets/income-calculator`
**Serves:** Ad angle `AD3_INCOME_ESTIMATE` + the master landing page "What It Costs" section.
**This is the master-flow Stone 03 "STR Profitability Calculator"** used as a paid-funnel lead magnet. Build it once, use it in both places.

## Purpose
Give a prospect a fast, honest, ranged estimate of what a short-term rental in
their market could gross, then capture name/email/phone to send the detailed
PDF estimate and push to a call. It is a lead magnet, not a promise engine — the
real number comes from a market analysis on the discovery call.

## North Star: bot or human?
Estimate computation is repeatable → **bot (client-side).** No human in the
loop until the prospect opts in. Per master-flow Stone 03: "pure client-side
computation, no API calls until lead capture."

## Hard rules (anti-hopium — these are brand-defining)
1. **Never show a single hero number.** Always a range (conservative →
   optimistic). A bare big number is a promise we cannot keep and it is
   off-brand.
2. **Label every projected figure as an estimate.** The word "estimate" or
   "typical range" must appear next to every output number.
3. **The methodology footnote is visible, not buried.** State plainly that this
   is a market-level estimate and the property-specific number comes from the
   call.
4. **No pricing claim that conflicts with D-01.** The "your cost" side stays
   pricing-agnostic until D-01 is resolved — show the model ("flat monthly fee,
   no revenue share") with a `[PENDING-D01]` placeholder where a number would
   go, OR omit the cost side entirely in v1 and add it after D-01.

## Inputs (kept deliberately minimal — friction kills lead magnets)
- Market (select): Austin, Minneapolis, Miami, Columbus, "Other US", "Canada".
- Bedrooms (select): Studio, 1, 2, 3, 4+.
- (Optional, progressive) Estimated monthly rent — if they know it, sharpens the
  net estimate; if blank, we estimate from market + bedrooms.

## Computation
```
gross_low  = ADR_low[market][bedrooms]  * 30 * occ_low[market]
gross_high = ADR_high[market][bedrooms] * 30 * occ_high[market]
```
Optional net (only if rent provided AND D-01 resolved):
```
net_low  = gross_low  - rent - opex_low
net_high = gross_high - rent - opex_high
```
Where `opex` covers cleaning/supplies/utilities/platform fees as a % band of
gross. **All coefficients live in a single clearly-labeled constants block and
are PLACEHOLDERS to be replaced with PriceLabs / AirDNA data.** Do not present
them as authoritative market data in the UI copy.

## Lead capture (the gate)
- After the prospect sees the on-screen range, a single CTA: "Email me the full
  estimate + the deals in my market."
- Form: First name, Email, Phone (all required — matches blueprint lead form).
- On submit → POST to GHL inbound webhook (URL from env, never hardcoded) with
  the inputs + computed range + lead source `income-calculator`.
- Redirect to the book-a-call page (matches blueprint Step 4).
- Privacy: basic PII only (name/email/phone). No sensitive/financial fields.
  No account creation. No autofill of stored data.

## Tech
- Single React component (`IncomeCalculator.jsx`), client-side only, no browser
  storage. Brand tokens from `brand-kit/brand.json` (inlined as CSS vars).
- Fonts: Fraunces / Manrope / JetBrains Mono. Palette: ink/cream/gold.
- Embeddable on `partners.revarity.com` (or the SaaS sub-brand domain if D-02
  separates it).

## Acceptance criteria
- [ ] Shows a conservative→optimistic **range**, never a single number.
- [ ] "Estimate" label adjacent to every figure; methodology footnote visible.
- [ ] No pricing claim that contradicts D-01.
- [ ] Lead form posts to GHL webhook (stubbed env var) and redirects to booking.
- [ ] No browser storage, no account creation, no sensitive fields.
- [ ] Brand-matched: correct fonts, palette, premium feel. Mobile-first.
- [ ] Rate constants isolated in one labeled block, marked as placeholders.
