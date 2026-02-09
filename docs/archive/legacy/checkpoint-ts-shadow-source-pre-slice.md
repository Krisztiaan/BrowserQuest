> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Checkpoint Module TS Shadow-Source Pre-Slice (T-358)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/checkpoint.js` to TypeScript-authored shadow source while preserving random checkpoint-position behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/checkpoint.js`
- Runtime dependents:
  - `server/js/map.js`
  - `server/js/worldserver.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`checkpoint.js`)

- `./utils`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/checkpoint.cts`
2. Generated runtime artifact:
   - `server/js/checkpoint.js`
3. Deterministic sync tooling:
   - `tools/sync-checkpoint.cjs`
   - `tsconfig.build-checkpoint.json`
4. Verify-gate wiring:
   - add `check:checkpoint-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert checkpoint shadow-source files and sync gate wiring.
2. Restore known-good `server/js/checkpoint.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
