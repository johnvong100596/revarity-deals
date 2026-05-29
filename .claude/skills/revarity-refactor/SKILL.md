---
name: revarity-refactor
description: Refactor a messy Revarity module into clean, modular, maintainable architecture WITHOUT changing product behavior. Use between build phases or on identified problem modules. Writes characterization tests first if coverage is missing. Behavior-preserving only.
---

# Revarity Refactor

Senior architecture refactoring for Revarity. **Run on Sonnet 4.6.**

## Mission

- Separate concerns properly
- Increase modularity
- Reduce tight coupling
- Improve scalability
- Make the module easier to maintain long-term

## Absolute rule

Do NOT change product behavior. Only improve architecture and code quality. If a refactor would alter behavior, STOP and surface the question to the human dev.

## Before refactoring

- Confirm tests exist for the module. If not, write characterization tests first that lock down current behavior.
- Read `/docs/locked-decisions.md` — the refactor must respect every locked entry.

## After refactoring

- All existing tests pass unchanged.
- Public API of the module is unchanged.
- File structure may change, but imports from outside the module still resolve (or provide a migration note).

## Output

- NEW FOLDER STRUCTURE (if applicable)
- CLEAN ARCHITECTURE BREAKDOWN (what changed and why)
- REFACTORED PRODUCTION-GRADE CODE
- EXPLANATION OF ARCHITECTURAL IMPROVEMENTS
- VERIFICATION — tests pass, behavior unchanged
