# Area Module TS Shadow-Source Pre-Slice (T-360)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/area.js` to TypeScript-authored shadow source while preserving area membership/spawn behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/area.js`
- Runtime dependents:
  - `server/js/mobarea.js`
  - `server/js/chestarea.js`
  - `server/js/worldserver.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`area.js`)

- `./utils`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/area.cts`
2. Generated runtime artifact:
   - `server/js/area.js`
3. Deterministic sync tooling:
   - `tools/sync-area.cjs`
   - `tsconfig.build-area.json`
4. Verify-gate wiring:
   - add `check:area-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert area shadow-source files and sync gate wiring.
2. Restore known-good `server/js/area.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
