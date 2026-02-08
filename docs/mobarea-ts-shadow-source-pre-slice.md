# MobArea Module TS Shadow-Source Pre-Slice (T-340)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/mobarea.js` to TypeScript-authored shadow source while preserving spawn/respawn and area roaming behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/mobarea.js`
- Runtime dependents:
  - `server/js/worldserver.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`mobarea.js`)

- `./area`
- `./mob`
- `./utils`
- `../../shared/js/gametypes`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/mobarea.cts`
2. Generated runtime artifact:
   - `server/js/mobarea.js`
3. Deterministic sync tooling:
   - `tools/sync-mobarea.cjs`
   - `tsconfig.build-mobarea.json`
4. Verify-gate wiring:
   - add `check:mobarea-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert mobarea shadow-source files and sync gate wiring.
2. Restore known-good `server/js/mobarea.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
