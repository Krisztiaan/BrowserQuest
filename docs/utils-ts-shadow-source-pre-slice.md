# Utils Module TS Shadow-Source Pre-Slice

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/utils.js` to TypeScript-authored shadow source while preserving string sanitization, random helpers, and orientation helpers.

## Existing contract baseline

- Runtime module:
  - `server/js/utils.js`
- Runtime dependents:
  - `server/js/area.js`
  - `server/js/formulas.js`
  - `server/js/worldserver.js`
- Runtime tests:
  - `tests/unit/server-utils-esm.test.ts`
  - `tests/smoke/server-payload-guards.test.ts`

## Current dependency inventory (`utils.js`)

- `../../shared/js/gametypes`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/utils.cts`
2. Generated runtime artifact:
   - `server/js/utils.js`
3. Deterministic sync tooling:
   - `tools/sync-utils.cjs`
   - `tsconfig.build-utils.json`
4. Verify-gate wiring:
   - add `check:utils-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert utils shadow-source files and sync gate wiring.
2. Restore known-good `server/js/utils.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
