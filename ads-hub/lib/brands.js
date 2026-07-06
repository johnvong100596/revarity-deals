/**
 * lib/brands.js — the brand registry + router (D-19). One place that maps a brand id to its
 * claims regime, ad voice, CTA style, and color-token class, so nothing downstream hard-codes
 * "Revarity". Every draft/brief carries brand ∈ { revarity | atd }; the claims engine, the
 * copy voice, the CTA rules, and the Review/render tokens all key off it. No cross-brand leakage:
 * an ATD draft is claims-checked by the ATD regime and renders on ATD tokens, never Revarity gold.
 */
import * as revClaims from "./claims.js";
import * as atdClaims from "./claimsAtd.js";

export const DEFAULT_BRAND = "revarity";

export const BRANDS = {
  revarity: {
    id: "revarity",
    label: "Revarity",
    claims: revClaims,
    tokenClass: null, // Revarity = the hub's default :root theme (no scope needed)
    ctaStyle: "dm", // DM "SETUP"
    // Voice descriptor injected into the copy/director prompts for this brand.
    voice: [
      "Brand: Revarity — done-for-you short-term-rental (Airbnb) setup for property owners. We handle design, furniture, photography, and launch, end-to-end.",
      "Voice: direct, premium, honest. No hype adjectives, no emoji, no fake scarcity.",
      'CTA: the DM keyword flow — end on DM "SETUP". Never a website link.',
    ].join(" "),
  },
  atd: {
    id: "atd",
    label: "AnalyzeTheDeal",
    claims: atdClaims,
    tokenClass: "brand-atd", // scoped color tokens (see globals.css); NOT Revarity gold
    ctaStyle: "site", // direct to analyzethedeal.com / sign up
    voice: [
      "Brand: AnalyzeTheDeal (ATD) — a web app that analyzes a rental property across every strategy (STR, long-term, BRRRR, flip, etc.) and returns one clear buy/pass verdict in seconds.",
      "Voice: sharp, confident, plain. Speak to real-estate investors who are tired of guessing. No hype, no emoji.",
      "Say what the PRODUCT DOES (analyze any deal, every strategy, one verdict, in seconds) — never quote returns, ROI, cap rate, profit, or income numbers (the app shows those in-app; ads never do).",
      "CTA: ALWAYS direct-to-site — 'Sign up at analyzethedeal.com' / 'Run the numbers at analyzethedeal.com'. NEVER a DM keyword.",
      "Imagery is REAL product screenshots / report outputs on demo data only — never AI-fabricated app UI, never a real customer's deal.",
    ].join(" "),
  },
};

/** Normalize any input to a known brand id (defaults to Revarity). */
export function normalizeBrand(x) {
  const b = String(x || "").toLowerCase().trim();
  return BRANDS[b] ? b : DEFAULT_BRAND;
}

export function getBrand(x) { return BRANDS[normalizeBrand(x)]; }

/** The claims module (claimViolations / assertClean / CTA constants) for a brand. */
export function claimsFor(x) { return getBrand(x).claims; }

/** Convenience: run the right regime's violation scan for a brand. */
export function claimViolationsFor(x, text) { return getBrand(x).claims.claimViolations(text); }
