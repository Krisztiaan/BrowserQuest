> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Item Module TS Shadow-Source Pre-Slice (T-350)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/item.js` to TypeScript-authored shadow source while preserving item despawn/blink/respawn behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/item.js`
- Runtime dependents:
  - `server/js/chest.js`
  - `server/js/worldserver.js`
  - `server/js/entityfactory.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`item.js`)

- `./entity`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/item.cts`
2. Generated runtime artifact:
   - `server/js/item.js`
3. Deterministic sync tooling:
   - `tools/sync-item.cjs`
   - `tsconfig.build-item.json`
4. Verify-gate wiring:
   - add `check:item-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert item shadow-source files and sync gate wiring.
2. Restore known-good `server/js/item.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
