> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# ChestArea Module TS Shadow-Source Pre-Slice (T-356)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/chestarea.js` to TypeScript-authored shadow source while preserving chest-area containment behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/chestarea.js`
- Runtime dependents:
  - `server/js/worldserver.js`
  - `server/js/map.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`chestarea.js`)

- `./area`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/chestarea.cts`
2. Generated runtime artifact:
   - `server/js/chestarea.js`
3. Deterministic sync tooling:
   - `tools/sync-chestarea.cjs`
   - `tsconfig.build-chestarea.json`
4. Verify-gate wiring:
   - add `check:chestarea-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert chestarea shadow-source files and sync gate wiring.
2. Restore known-good `server/js/chestarea.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
