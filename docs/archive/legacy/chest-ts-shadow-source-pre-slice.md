> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Chest Module TS Shadow-Source Pre-Slice (T-344)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/chest.js` to TypeScript-authored shadow source while preserving loot selection and item-drop behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/chest.js`
- Runtime dependents:
  - `server/js/worldserver.js`
  - `server/js/chestarea.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`chest.js`)

- `./utils`
- `./item`
- `../../shared/js/gametypes`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/chest.cts`
2. Generated runtime artifact:
   - `server/js/chest.js`
3. Deterministic sync tooling:
   - `tools/sync-chest.cjs`
   - `tsconfig.build-chest.json`
4. Verify-gate wiring:
   - add `check:chest-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert chest shadow-source files and sync gate wiring.
2. Restore known-good `server/js/chest.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
