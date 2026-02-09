> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Character Module TS Shadow-Source Pre-Slice (T-336)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/character.js` to TypeScript-authored shadow source while preserving entity inheritance and combat-state behavior.

## Existing contract baseline

- Runtime module:
  - `server/js/character.js`
- Runtime dependents:
  - `server/js/player.js`
  - `server/js/mob.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`character.js`)

- `./entity`
- `./message`
- `./log`
- `./utils`
- `./properties`
- `../../shared/js/gametypes`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/character.cts`
2. Generated runtime artifact:
   - `server/js/character.js`
3. Deterministic sync tooling:
   - `tools/sync-character.cjs`
   - `tsconfig.build-character.json`
4. Verify-gate wiring:
   - add `check:character-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert character shadow-source files and sync gate wiring.
2. Restore known-good `server/js/character.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
