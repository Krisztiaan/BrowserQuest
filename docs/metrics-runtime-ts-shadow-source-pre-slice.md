# Metrics Runtime TS Shadow-Source Pre-Slice (T-332/T-333)

Date: 2026-02-08

Status:

- Pre-slice complete (`T-332`)
- Shadow-source phase-1 execution complete (`T-333`)

## Objective

Define a low-risk pre-slice for promoting `server/js/metrics-runtime.js` to TypeScript-authored shadow source while preserving runtime fallback behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/metrics-runtime.js`
- ESM bridge:
  - `server/js/metrics-runtime-esm.mjs`
- Runtime tests:
  - `tests/unit/metrics-runtime.test.ts`
  - `tests/smoke/server-structured-logs.lifecycle.test.ts`
  - `tests/smoke/server-handshake.test.ts`

## Current dependency inventory (`metrics-runtime.js`)

- `./metrics-adapters/noop`
- `./metrics-adapters/memcache`
- `./log`

## Artifact strategy

1. Authoritative source:
   - `server/js/metrics-runtime.cts`
2. Generated runtime artifact:
   - `server/js/metrics-runtime.js`
3. Deterministic sync tooling:
   - `tools/sync-metrics-runtime.cjs`
   - `tsconfig.build-metrics-runtime.json`
4. Verify-gate wiring:
   - `check:metrics-runtime-sync` in `verify:modern` and `verify:legacy`

## Executed checklist (T-333)

1. Seeded `server/js/metrics-runtime.cts` from runtime module and preserved module export shape.
2. Added sync build/check tooling and generated `server/js/metrics-runtime.js`.
3. Updated docs/runbooks to enforce `.cts` source-of-truth workflow.
4. Ran full verification:
   - `bun run typecheck`
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`

## Rollback checklist

1. Revert metrics-runtime shadow-source files and sync gate wiring.
2. Restore known-good `server/js/metrics-runtime.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
