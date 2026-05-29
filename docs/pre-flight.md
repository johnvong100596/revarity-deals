# Pre-flight Checklists — Revarity Marketing Engine (standalone module)

The human signs every box. Subagent verdicts inform; they do not gate.

## Before starting a feature

- [ ] Linear ticket exists with acceptance criteria
- [ ] Spec read in Notion (or written and approved if new)
- [ ] `@stone-context` output reviewed — relevant locked decisions and risk gates surfaced
- [ ] `@architect` run; output reviewed; clarifying questions resolved
- [ ] No locked decision is being silently worked around
- [ ] Estimated cost of agent work is in proportion to feature value

## Before merging a PR

- [ ] All tests pass in CI
- [ ] `@reviewer` verdict reviewed — BLOCKER and MAJOR items addressed
- [ ] `@security-auditor` verdict reviewed if Stone 02, RevDeal, or pre-launch — CRITICAL and HIGH addressed
- [ ] No TODOs left in diff
- [ ] PR description summarizes what was done and what was NOT done
- [ ] Migration files included for schema changes
- [ ] Human dev has read the diff end-to-end (not just the summary)
- [ ] Linear ticket updated with merge status

## Before deploying to production

- [ ] Staging environment exercised with realistic data
- [ ] `@devops` verifies monitoring and alerting is wired before traffic flips
- [ ] Rollback path documented and tested
- [ ] Secrets rotated if any new credential was added
- [ ] Slack incident channel notified of deploy window
- [ ] Stone-specific gates (compliance for Stone 02 / RevDeal) signed off by counsel if applicable
