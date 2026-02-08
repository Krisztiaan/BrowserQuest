# Message Module TS Shadow-Source Pre-Slice (T-354)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/message.js` to TypeScript-authored shadow source while preserving protocol message serialization behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/message.js`
- Runtime dependents:
  - `server/js/entity.js`
  - `server/js/worldserver.js`
  - `server/js/player.js`
  - `server/js/mob.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`message.js`)

- `../../shared/js/gametypes`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/message.cts`
2. Generated runtime artifact:
   - `server/js/message.js`
3. Deterministic sync tooling:
   - `tools/sync-message.cjs`
   - `tsconfig.build-message.json`
4. Verify-gate wiring:
   - add `check:message-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert message shadow-source files and sync gate wiring.
2. Restore known-good `server/js/message.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
