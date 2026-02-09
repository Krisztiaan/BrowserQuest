> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Metrics Client Module TS Shadow-Source Pre-Slice

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/metrics-client.js` to TypeScript-authored shadow source while preserving legacy/modern memcache adapter compatibility behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/metrics-client.js`
- Runtime dependents:
  - `server/js/metrics-adapters/memcache.js`
- Runtime tests:
  - `tests/unit/metrics-client.test.ts`
  - `tests/unit/metrics-runtime.test.ts`

## Current dependency inventory (`metrics-client.js`)

- none (module receives adapter dependency via arguments)

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/metrics-client.cts`
2. Generated runtime artifact:
   - `server/js/metrics-client.js`
3. Deterministic sync tooling:
   - `tools/sync-metrics-client.cjs`
   - `tsconfig.build-metrics-client.json`
4. Verify-gate wiring:
   - add `check:metrics-client-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert metrics-client shadow-source files and sync gate wiring.
2. Restore known-good `server/js/metrics-client.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
