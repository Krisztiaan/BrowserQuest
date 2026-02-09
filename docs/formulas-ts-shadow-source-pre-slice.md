> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Formulas Module TS Shadow-Source Pre-Slice

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/formulas.js` to TypeScript-authored shadow source while preserving combat damage and health formula behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/formulas.js`
- Runtime dependents:
  - `server/js/player.js`
  - `server/js/mob.js`
- Runtime tests:
  - `tests/unit/server-main-module.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`

## Current dependency inventory (`formulas.js`)

- `./utils`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/formulas.cts`
2. Generated runtime artifact:
   - `server/js/formulas.js`
3. Deterministic sync tooling:
   - `tools/sync-formulas.cjs`
   - `tsconfig.build-formulas.json`
4. Verify-gate wiring:
   - add `check:formulas-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert formulas shadow-source files and sync gate wiring.
2. Restore known-good `server/js/formulas.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
