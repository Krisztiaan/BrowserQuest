# Log Module TS Shadow-Source Pre-Slice

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/log.js` to TypeScript-authored shadow source while preserving structured logging behavior and singleton logger semantics.

## Existing contract baseline

- Runtime module:
  - `server/js/log.js`
- Runtime dependents:
  - `server/js/main-runtime.js`
  - `server/js/format.js`
  - `server/js/metrics-runtime.js`
- Runtime tests:
  - `tests/unit/server-log.test.ts`
  - `tests/smoke/server-structured-logs.lifecycle.test.ts`

## Current dependency inventory (`log.js`)

- none (console/runtime globals only)

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/log.cts`
2. Generated runtime artifact:
   - `server/js/log.js`
3. Deterministic sync tooling:
   - `tools/sync-log.cjs`
   - `tsconfig.build-log.json`
4. Verify-gate wiring:
   - add `check:log-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert log shadow-source files and sync gate wiring.
2. Restore known-good `server/js/log.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
