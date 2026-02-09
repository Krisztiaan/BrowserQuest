> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Mob Module TS Shadow-Source Pre-Slice (T-338)

Date: 2026-02-08

## Objective

Define a low-risk pre-slice for promoting `server/js/mob.js` to TypeScript-authored shadow source while preserving mob combat/respawn behavior and hate-list semantics.

## Existing contract baseline

- Runtime module:
  - `server/js/mob.js`
- Runtime dependents:
  - `server/js/worldserver.js`
  - `server/js/mobarea.js`
- Runtime tests:
  - `tests/smoke/server-handshake.test.ts`
  - `tests/smoke/modern-gameplay-parity.test.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`

## Current dependency inventory (`mob.js`)

- `./character`
- `./message`
- `./properties`
- `./utils`
- `../../shared/js/gametypes`

## Proposed artifact strategy

1. Authoritative source:
   - `server/js/mob.cts`
2. Generated runtime artifact:
   - `server/js/mob.js`
3. Deterministic sync tooling:
   - `tools/sync-mob.cjs`
   - `tsconfig.build-mob.json`
4. Verify-gate wiring:
   - add `check:mob-sync` to `verify:modern` and `verify:legacy`

## Rollback checklist

1. Revert mob shadow-source files and sync gate wiring.
2. Restore known-good `server/js/mob.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
