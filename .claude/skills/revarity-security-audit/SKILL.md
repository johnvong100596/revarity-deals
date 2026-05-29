---
name: revarity-security-audit
description: Run a security and compliance audit on Revarity code. MANDATORY before any Stone 02 (Lease Acquisition) or RevDeal merge, and before any pre-launch deploy on other stones. Checks vulnerabilities plus stone-specific compliance gates (CAN-SPAM, TCPA, Fair Housing, accreditation, audit logging). Flags when counsel review is required.
---

# Revarity Security & Compliance Audit

Senior security engineering for a compliance-heavy STR operator handling landlord/tenant PII, skip-trace data, Stripe flows, ACH/wire instructions, scraping infrastructure, and email outreach. **Run on Sonnet 4.6; escalate to Opus 4.8 for deep audits.**

## Inspect for

### 1. Security vulnerabilities
Injection (SQL, command, prompt), XSS, CSRF, SSRF, auth bypass, IDOR, sensitive data exposure in logs or error responses.

### 2. Compliance gates per stone
- **Stone 02 (Lease Acquisition):** CAN-SPAM headers on every email; TCPA email-only at Phase 01 (no SMS without counsel review); Fair Housing — no zip-code proxies for protected-class filtering; scraping ToS adherence; US-region hosting for any PII; documented deletion workflow.
- **RevDeal:** accredited self-attestation gate before any deposit collection; deposits framed as service fee, not return on capital; ACH/wire only (no cards for $10K+); public WhatsApp surface as teaser only.
- **RevOS:** AI escalation governance — force-escalate on complaint language, refund requests, legal keywords (lawsuit/attorney/injury/hazard), minor or infant mentioned, claim above per-property threshold, review <= 3 stars.
- **RevAtelier:** no itemized markup exposed to client; designer-as-gatekeeper enforced in code; 50% deposit at design approval.
- **Stone 03:** portal login active day-of-signing; Stripe billing live; no GHL data loss on prospect-to-client transition.

### 3. Infrastructure
Secrets in code, unrotated keys, public buckets, missing rate limits, missing audit logs.

### 4. Dependencies
Known CVEs, unmaintained packages.

## Output

- VULNERABILITIES (severity CRITICAL/HIGH/MEDIUM/LOW, attack scenario, fix)
- COMPLIANCE GATE STATUS (per applicable stone: PASS/FAIL with specifics)
- INFRASTRUCTURE FINDINGS
- DEPENDENCY FINDINGS
- VERDICT: SHIP / FIX-AND-RESHIP / BLOCK

CRITICAL always BLOCKS. Any Stone 02 or RevDeal compliance FAIL requires counsel review — flag it clearly.
