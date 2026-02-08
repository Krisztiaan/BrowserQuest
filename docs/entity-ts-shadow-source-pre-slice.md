# Entity Module TS Shadow-Source Pre-Slice (T-348)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/entity.js` to TypeScript-authored shadow source while preserving shared entity state serialization and spawn/despawn behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/entity.js`
- Runtime dependents:
  - `server/js/item.js`
  - `server/js/character.js`
  - `server/js/npc.js`
  - `server/js/player.js`
  - `server/js/mob.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`entity.js`)

- `./message`
- `./utils`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/entity.cts`
2. Generated runtime artifact:
   - `server/js/entity.js`
3. Deterministic sync tooling:
   - `tools/sync-entity.cjs`
   - `tsconfig.build-entity.json`
4. Verify-gate wiring:
   - add `check:entity-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert entity shadow-source files and sync gate wiring.
2. Restore known-good `server/js/entity.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
