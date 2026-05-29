# Studio Dashboard — design draft (team login home)

The post-login home for `ads.revarity.com`, drafted as a **creative-ops command center** — the
register the top tools set. Mockup: `creative-engine/studio.mjs` → `output/studio-home.html`
(+ `.preview.png`). Brand-locked (ink/cream/gold, Fraunces/Manrope/JetBrains Mono).

## Why this shape — mapped to the market
The leading creative-ops tools each own one slice; Revarity's hub unifies them:
| Capability | Market owner | Our equivalent |
|---|---|---|
| Generate creative from scratch | AdCreative.ai | the Creative Engine (`pipeline.mjs`) |
| Swipe file + competitor discovery | Foreplay (Swipe/Discovery/Spyder) | `swipe.mjs` + Ad-Library mining |
| Briefs → concepts | Foreplay (Briefs) | `army-of-content` workflow → `concepts.json` |
| Creative performance analytics | Motion (Lens) | Monitor (Phase 2, Meta MCP) |
| Approval / collaboration | (creative-ops norm) | Review queue + human gate (D-04) |
Sources: [Foreplay](https://www.foreplay.co/), [Motion alternatives (G2)](https://www.g2.com/products/motion-2025-12-21/competitors/alternatives), [CreativeOS comparison](https://creativeos.com/compare/best-ad-creative-platforms/).

## Layout (studio home)
```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ Revarity   │  [ search ]            Brand·Revarity   [Mine winners] [+ New run]│
│ Ads        ├──────────────────────────────────────────────────────────────┤
│            │  Welcome back, Malcolm                                          │
│ • Studio   │  ┌ queue ┐ ┌ awaiting ┐ ┌ approved ┐ ┌ $7,000 · CPL≤$50 ┐       │
│   Create   │  D-04 human-gate banner                                         │
│   Swipe    │  [ Generate ] [ Mine winners ] [ Review & approve ]  (quick)    │
│   Review   │  Pipeline:  Generated → QA passed → Approved → Live(human)       │
│   Budget   │  Recent creatives  ───────────────────────  (gallery grid)      │
│   Monitor  │   [ad][ad][ad][ad][ad]   chips: QA pass · backdrop · angle       │
│   Settings │  Top performers  [Phase 2 — Meta MCP]                            │
│ ◑ Malcolm  │                                                                 │
└────────────┴──────────────────────────────────────────────────────────────┘
```

**Sections**
1. **Sidebar** — brand, nav (Studio/Create/Swipe/Review/Budget/Monitor/Settings), user + role.
2. **Top bar** — search, brand/workspace switcher, `Mine winners`, primary `+ New run`.
3. **Stat cards** — queue / awaiting approval / approved / monthly plan + CPL target.
4. **Human-gate banner** — D-04, always present.
5. **Quick actions** — Generate · Mine winners · Review (the three core verbs).
6. **Pipeline** — Generated → QA passed → Approved → Live (live is human-launched).
7. **Recent creatives** — gallery grid of finished ads with QA + backdrop + angle chips (Foreplay-style board).
8. **Top performers** — Phase-2 perf stub (Motion-style), activates with Meta data.

## Role views
- **Malcolm (CEO/approver):** lands on Review + Budget; approves sets, sees spend→ROI.
- **David (paid):** Create + Pipeline + Monitor; runs, launches approved sets in Meta.
- **Vu (content):** Create + Swipe + gallery; organic volume.
(Clerk roles can gate nav items; v1 shows all.)

## To make it real (in `ads-hub`)
The current hub pages (Overview/Create/Review/Budget/Monitor) already hold the data + actions.
This draft upgrades the **Overview** into this studio home: add the gallery grid (finished ads
from the queue), the pipeline strip, and the quick-action cards; wire `Mine winners` → swipe run.
~1 focused build on top of the existing components. Nothing changes the spend gate (D-04).
