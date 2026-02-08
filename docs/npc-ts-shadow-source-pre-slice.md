# NPC Module TS Shadow-Source Pre-Slice (T-352)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/npc.js` to TypeScript-authored shadow source while preserving NPC entity initialization behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/npc.js`
- Runtime dependents:
  - `server/js/worldserver.js`
  - `server/js/entityfactory.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`npc.js`)

- `./entity`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/npc.cts`
2. Generated runtime artifact:
   - `server/js/npc.js`
3. Deterministic sync tooling:
   - `tools/sync-npc.cjs`
   - `tsconfig.build-npc.json`
4. Verify-gate wiring:
   - add `check:npc-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert NPC shadow-source files and sync gate wiring.
2. Restore known-good `server/js/npc.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
