# Format Module TS Shadow-Source Pre-Slice

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/format.js` to TypeScript-authored shadow source while preserving message shape validation and protocol type checks.

## Existing contract baseline

- Runtime module:
  - `server/js/format.js`
- Runtime dependents:
  - `server/js/player.js`
  - `server/js/ws.js`
- Runtime tests:
  - `tests/unit/server-format-esm.test.ts`
  - `tests/smoke/server-payload-guards.test.ts`

## Current dependency inventory (`format.js`)

- `./log`
- `../../shared/js/gametypes`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/format.cts`
2. Generated runtime artifact:
   - `server/js/format.js`
3. Deterministic sync tooling:
   - `tools/sync-format.cjs`
   - `tsconfig.build-format.json`
4. Verify-gate wiring:
   - add `check:format-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert format shadow-source files and sync gate wiring.
2. Restore known-good `server/js/format.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
