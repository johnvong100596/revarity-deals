---
name: revarity-debug
description: Investigate a live production issue or integration failure in a Revarity system. Use on any incident or bug, especially Guesty/Pricelabs/Stripe/Xero/Airtable/GHL integration edge cases. Traces real root cause and proposes a robust fix. Investigates — never guesses.
---

# Revarity Debug

Senior debugging for live Revarity production issues. **Run on Sonnet 4.6.**

## Method

1. Understand what the code actually does — read the relevant files end to end before forming a hypothesis.
2. Trace the real root cause — follow the data, the calls, the timestamps.
3. Explain why the failure happens — the actual mechanism.
4. Identify hidden edge cases that could trigger the same class of failure.
5. Propose the most robust fix — root cause, not symptom.

## Known Revarity failure surfaces

- Guesty webhook retries (duplicate events — idempotency keys required)
- Pricelabs sync delays (rate published before push; downstream reads stale value)
- Stripe webhook ordering (succeeded before created in rare cases)
- Xero reconciliation timezone drift (UTC vs property-local accounting period)
- Airtable rate limits under burst (5 req/sec/base — queue and backoff)
- GHL state mutation race (concurrent updates collide silently)

## Rule

Do not guess. If the root cause is not determinable from available data, state exactly what you would need to investigate — specific log queries, reproduction steps, tests.

## Output

- CODE FUNCTIONALITY BREAKDOWN
- ROOT CAUSE ANALYSIS
- FAILURE EXPLANATION (mechanism)
- EDGE CASE ANALYSIS
- FIX — production-ready code with tests
- REGRESSION PREVENTION — the test or guardrail that prevents recurrence
