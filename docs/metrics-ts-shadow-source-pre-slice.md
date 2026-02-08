# Metrics Module TS Shadow-Source Pre-Slice (T-334)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/metrics.js` to TypeScript-authored shadow source while preserving metrics availability and fallback behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/metrics.js`
- ESM bridge:
  - `server/js/metrics-esm.mjs`
- Runtime tests:
  - `tests/unit/metrics-client.test.ts`
  - `tests/unit/metrics-runtime.test.ts`
  - `tests/unit/server-metrics-esm.test.ts`
  - `tests/smoke/server-structured-logs.lifecycle.test.ts`
  - `tests/smoke/server-handshake.test.ts`

## Current dependency inventory (`metrics.js`)

- `./metrics-client`
- `./log`
- runtime optional package: `memcache` (via `require("memcache")`)

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/metrics.cts`
2. Generated runtime artifact:
   - `server/js/metrics.js`
3. Deterministic sync tooling:
   - `tools/sync-metrics.cjs`
   - `tsconfig.build-metrics.json`
4. Verify-gate wiring:
   - add `check:metrics-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert metrics shadow-source files and sync gate wiring.
2. Restore known-good `server/js/metrics.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
