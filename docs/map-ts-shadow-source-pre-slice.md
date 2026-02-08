# Map Module TS Shadow-Source Pre-Slice (T-342)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/map.js` to TypeScript-authored shadow source while preserving map loading, collision-grid generation, and checkpoint/zone behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/map.js`
- Runtime dependents:
  - `server/js/worldserver.js`
  - `server/js/main-runtime.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`map.js`)

- `fs`
- `./log`
- `./utils`
- `./checkpoint`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/map.cts`
2. Generated runtime artifact:
   - `server/js/map.js`
3. Deterministic sync tooling:
   - `tools/sync-map.cjs`
   - `tsconfig.build-map.json`
4. Verify-gate wiring:
   - add `check:map-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert map shadow-source files and sync gate wiring.
2. Restore known-good `server/js/map.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
