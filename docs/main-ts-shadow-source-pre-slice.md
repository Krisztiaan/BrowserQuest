# Main Module TS Shadow-Source Pre-Slice

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/main.js` to TypeScript-authored shadow source while preserving server startup config-loading behavior and main-runtime contract exports.

## Existing contract baseline

- Runtime module:
  - `server/js/main.js`
- Runtime dependents:
  - direct startup entry (`bun server/js/main.js`)
  - tests importing startup contract
- Runtime tests:
  - `tests/unit/server-main-module.test.ts`
  - `tests/smoke/server-handshake.test.ts`

## Current dependency inventory (`main.js`)

- Node `fs`
- `./main-runtime`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/main.cts`
2. Generated runtime artifact:
   - `server/js/main.js`
3. Deterministic sync tooling:
   - `tools/sync-main.cjs`
   - `tsconfig.build-main.json`
4. Verify-gate wiring:
   - add `check:main-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert main shadow-source files and sync gate wiring.
2. Restore known-good `server/js/main.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
