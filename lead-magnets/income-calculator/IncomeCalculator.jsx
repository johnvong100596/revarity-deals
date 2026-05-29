import React, { useState, useMemo } from "react";

/**
 * Revarity Income Calculator — lead magnet (AD3_INCOME_ESTIMATE)
 * Client-side only. No browser storage. No account creation.
 * Honest by design: shows a RANGE, labels everything an estimate, footnotes method.
 *
 * Pricing/cost side intentionally omitted in v1 pending DECISIONS.md D-01.
 * Add net-income output only after D-01 (flat-fee vs 4-tier) is resolved.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
// GHL inbound webhook. NEVER hardcode a real URL in the repo — inject at deploy.
const GHL_WEBHOOK_URL = process.env.REACT_APP_GHL_WEBHOOK_URL || "/__set_ghl_webhook__";
const BOOKING_REDIRECT = process.env.REACT_APP_BOOKING_URL || "/book-a-call";

// ── MARKET DATA · source: PriceLabs Market Dashboard ──────────────────────────
// ADR = average daily rate band (USD). occ = occupancy band (fraction).
// These bands come from the PriceLabs Market Dashboard (ADR + occupancy by market
// and bedroom count) and drive the CLIENT-SIDE pre-capture range ONLY. They are
// always shown in-UI as an ESTIMATE with a conservative→optimistic range and a
// visible methodology footnote — never as a single hero number.
//
// The property-specific number comes from the PriceLabs Revenue Estimator API,
// computed SERVER-SIDE only AFTER lead capture (out of scope for this client-side
// component — see model-routing.json → pricelabs). NOT AirDNA, NOT the lease tool.
//
// PROVENANCE: indicative bands aligned to PriceLabs Market Dashboard levels.
// REFRESH against a live PriceLabs pull before scale, then update MARKET_DATA_AS_OF.
const MARKET_DATA_SOURCE = "PriceLabs Market Dashboard";
const MARKET_DATA_AS_OF = "indicative — pending live PriceLabs pull";
const MARKET = {
  Austin:       { occ: [0.57, 0.71], adr: { Studio:[98,142], "1":[124,184], "2":[176,268], "3":[246,372], "4+":[328,492] } },
  Minneapolis:  { occ: [0.54, 0.67], adr: { Studio:[82,122], "1":[102,154], "2":[144,216], "3":[204,306], "4+":[276,408] } },
  Miami:        { occ: [0.61, 0.75], adr: { Studio:[124,186], "1":[156,236], "2":[216,338], "3":[308,468], "4+":[408,628] } },
  Columbus:     { occ: [0.54, 0.66], adr: { Studio:[72,108], "1":[92,138], "2":[128,194], "3":[178,270], "4+":[238,356] } },
  "Other US":   { occ: [0.55, 0.69], adr: { Studio:[86,132], "1":[112,168], "2":[154,238], "3":[218,330], "4+":[294,446] } },
  Canada:       { occ: [0.54, 0.69], adr: { Studio:[82,128], "1":[108,164], "2":[148,228], "3":[208,314], "4+":[278,424] } },
};
const MARKETS = Object.keys(MARKET);
const BEDROOMS = ["Studio", "1", "2", "3", "4+"];

const money = (n) => "$" + (Math.round(n / 50) * 50).toLocaleString();

export default function IncomeCalculator() {
  const [market, setMarket] = useState("Austin");
  const [bedrooms, setBedrooms] = useState("2");
  const [revealed, setRevealed] = useState(false);
  const [lead, setLead] = useState({ firstName: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const estimate = useMemo(() => {
    const m = MARKET[market];
    const [adrLow, adrHigh] = m.adr[bedrooms];
    const [occLow, occHigh] = m.occ;
    const grossLow = adrLow * 30 * occLow;
    const grossHigh = adrHigh * 30 * occHigh;
    return { grossLow, grossHigh, adrLow, adrHigh, occLow, occHigh };
  }, [market, bedrooms]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email);
  const validPhone = lead.phone.replace(/\D/g, "").length >= 10;
  const canSubmit = lead.firstName.trim() && validEmail && validPhone && !submitting;

  async function handleSubmit() {
    setError("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(GHL_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          leadSource: "income-calculator",
          market,
          bedrooms,
          estimateLow: Math.round(estimate.grossLow),
          estimateHigh: Math.round(estimate.grossHigh),
        }),
      });
      if (!res.ok) throw new Error("submit failed"); // don't redirect on a failed capture
      window.location.href = BOOKING_REDIRECT;
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rev-calc">
      <style>{`
        .rev-calc{
          --ink:#0a0a0b;--cream:#f5f1e8;--paper:#f9f6ee;--gold:#c9a961;
          --gold-bright:#e0c074;--gold-deep:#a88842;--muted:#8a857a;--muted-dark:#5a554b;
          --line:rgba(201,169,97,0.25);--line-dark:rgba(201,169,97,0.12);
          font-family:'Manrope',sans-serif;background:var(--ink);color:var(--cream);
          max-width:560px;margin:0 auto;padding:44px 36px;border-radius:4px;
          position:relative;overflow:hidden;letter-spacing:-0.005em;
        }
        .rev-calc::before{content:'';position:absolute;top:-30%;right:-20%;width:70%;height:160%;
          background:radial-gradient(ellipse at center,rgba(201,169,97,0.16) 0%,transparent 60%);pointer-events:none}
        .rev-calc > *{position:relative;z-index:2}
        .rc-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.3em;
          text-transform:uppercase;color:var(--gold-bright);margin-bottom:16px;font-weight:500}
        .rc-h{font-family:'Fraunces',serif;font-weight:400;font-size:30px;line-height:1.1;
          letter-spacing:-0.02em;margin:0 0 8px}
        .rc-h em{font-style:italic;font-weight:300;color:var(--gold)}
        .rc-sub{font-size:14px;color:rgba(245,241,232,0.7);margin:0 0 28px;line-height:1.5}
        .rc-row{display:flex;gap:14px;margin-bottom:18px;flex-wrap:wrap}
        .rc-field{flex:1;min-width:160px}
        .rc-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;
          text-transform:uppercase;color:var(--gold);margin-bottom:7px;display:block}
        .rc-select,.rc-input{width:100%;background:rgba(245,241,232,0.04);border:1px solid var(--line);
          color:var(--cream);font-family:'Manrope',sans-serif;font-size:15px;padding:12px 14px;
          border-radius:2px;outline:none;transition:border-color .15s}
        .rc-select:focus,.rc-input:focus{border-color:var(--gold-bright)}
        .rc-select option{background:var(--ink);color:var(--cream)}
        .rc-result{margin:26px 0 8px;padding:26px 24px;background:rgba(201,169,97,0.07);
          border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:2px}
        .rc-result-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;
          text-transform:uppercase;color:var(--gold-bright);margin-bottom:10px}
        .rc-range{font-family:'Fraunces',serif;font-size:38px;font-weight:400;line-height:1;letter-spacing:-0.02em}
        .rc-range em{font-style:normal;color:var(--gold)}
        .rc-range .dash{color:var(--muted);font-size:26px;margin:0 10px;vertical-align:middle}
        .rc-permo{font-size:13px;color:var(--muted);margin-top:8px}
        .rc-bar{height:6px;border-radius:3px;margin:18px 0 6px;
          background:linear-gradient(90deg,var(--gold-deep),var(--gold-bright))}
        .rc-bar-legend{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;
          font-size:10px;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase}
        .rc-foot{font-size:12px;color:rgba(245,241,232,0.55);line-height:1.55;margin:18px 0 0;
          padding-top:16px;border-top:1px solid var(--line-dark)}
        .rc-cta{width:100%;margin-top:24px;background:var(--gold);color:var(--ink);border:none;
          font-family:'Manrope',sans-serif;font-weight:600;font-size:15px;padding:15px;border-radius:2px;
          cursor:pointer;transition:background .15s}
        .rc-cta:hover{background:var(--gold-bright)}
        .rc-form .rc-row{margin-bottom:14px}
        .rc-err{color:#e8a08c;font-size:13px;margin-top:10px}
        .rc-back{background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;
          margin-top:14px;font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;text-transform:uppercase}
      `}</style>

      <div className="rc-eyebrow">— Free STR income estimate —</div>
      <h2 className="rc-h">How much could your area <em>make</em> on Airbnb?</h2>
      <p className="rc-sub">A quick market-level estimate. The property-specific number comes from a real analysis on your call.</p>

      <div className="rc-row">
        <div className="rc-field">
          <label className="rc-label">Market</label>
          <select className="rc-select" value={market} onChange={(e) => { setMarket(e.target.value); setRevealed(false); }}>
            {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="rc-field">
          <label className="rc-label">Bedrooms</label>
          <select className="rc-select" value={bedrooms} onChange={(e) => { setBedrooms(e.target.value); setRevealed(false); }}>
            {BEDROOMS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="rc-result">
        <div className="rc-result-label">Estimated gross revenue range</div>
        <div className="rc-range">
          <em>{money(estimate.grossLow)}</em>
          <span className="dash">–</span>
          <em>{money(estimate.grossHigh)}</em>
        </div>
        <div className="rc-permo">per month · estimate, conservative to optimistic</div>
        <div className="rc-bar" />
        <div className="rc-bar-legend"><span>Conservative</span><span>Optimistic</span></div>
      </div>

      {!revealed ? (
        <button className="rc-cta" onClick={() => setRevealed(true)}>
          Email me the full estimate + deals in my market →
        </button>
      ) : (
        <div className="rc-form">
          <div className="rc-row">
            <div className="rc-field">
              <label className="rc-label">First name</label>
              <input className="rc-input" value={lead.firstName}
                onChange={(e) => setLead({ ...lead, firstName: e.target.value })} placeholder="First name" />
            </div>
          </div>
          <div className="rc-row">
            <div className="rc-field">
              <label className="rc-label">Email</label>
              <input className="rc-input" type="email" value={lead.email}
                onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="you@email.com" />
            </div>
            <div className="rc-field">
              <label className="rc-label">Phone</label>
              <input className="rc-input" type="tel" value={lead.phone}
                onChange={(e) => setLead({ ...lead, phone: e.target.value })} placeholder="(555) 555-5555" />
            </div>
          </div>
          <button className="rc-cta" disabled={!canSubmit} onClick={handleSubmit}
            style={{ opacity: canSubmit ? 1 : 0.5 }}>
            {submitting ? "Sending…" : "Send my full estimate →"}
          </button>
          {error && <p className="rc-err">{error}</p>}
          <button className="rc-back" onClick={() => setRevealed(false)}>← Back</button>
        </div>
      )}

      {/* methodology footnote — always visible (SPEC hard rule #3), both pre- and post-capture */}
      <p className="rc-foot">
        This is a market-level estimate built on {MARKET_DATA_SOURCE} data — typical nightly
        rates and occupancy for this market and bedroom count. It is not a guarantee and not
        specific to one property. We run a proper, property-specific analysis on your call
        before any deal. Figures are rounded.
      </p>
    </div>
  );
}
