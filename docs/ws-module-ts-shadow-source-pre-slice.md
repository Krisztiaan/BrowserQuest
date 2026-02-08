# Websocket Module TS Shadow-Source Pre-Slice (T-330/T-331)

Date: 2026-02-08

Status:

- Pre-slice complete (`T-330`)
- Shadow-source phase-1 execution complete (`T-331`)

## Objective

Define a low-risk pre-slice for promoting `server/js/ws.js` to TypeScript-authored shadow source while preserving websocket runtime behavior and existing class-factory ownership.

## Existing contract baseline

- Module seam contracts:
  - `server/js/ws-module-types.ts`
- Module seam tests:
  - `tests/unit/ws-module-contract.test.ts`
- Websocket class-factory source-of-truth:
  - `server/js/ws-runtime-class-factory.cts`

## Current dependency inventory (`ws.js`)

- `url`
- `http`
- `./log`
- `./utils`
- `../../shared/js/protocol-contract`
- `../../shared/js/ws-close-codes`
- `ws`
- `./ws-runtime-class-factory.cjs`

## Artifact strategy

1. Authoritative source:
   - `server/js/ws.cts`
2. Generated runtime artifact:
   - `server/js/ws.js`
3. Deterministic sync tooling:
   - `tools/sync-ws-module.cjs`
   - `tsconfig.build-ws-module.json`
4. Verify-gate wiring:
   - `check:ws-module-sync` in `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert websocket module shadow-source files and sync gate wiring.
2. Restore known-good `server/js/ws.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
