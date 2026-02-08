# Config Preflight Module TS Shadow-Source Pre-Slice

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/config-preflight.js` to TypeScript-authored shadow source while preserving startup config validation contracts.

## Existing contract baseline

- Runtime module:
  - `server/js/config-preflight.js`
- Runtime dependents:
  - `server/js/main-runtime.js`
  - `server/js/main-esm-preflight-failures.mjs`
- Runtime tests:
  - `tests/unit/server-config-preflight.test.ts`
  - `tests/smoke/server-config-preflight.test.ts`

## Current dependency inventory (`config-preflight.js`)

- none

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/config-preflight.cts`
2. Generated runtime artifact:
   - `server/js/config-preflight.js`
3. Deterministic sync tooling:
   - `tools/sync-config-preflight.cjs`
   - `tsconfig.build-config-preflight.json`
4. Verify-gate wiring:
   - add `check:config-preflight-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert config-preflight shadow-source files and sync gate wiring.
2. Restore known-good `server/js/config-preflight.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
