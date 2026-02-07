# Runtime CJS Boundary Inventory (2026-02-07)

## Purpose

Document intentional CommonJS boundaries after server-side class modernization, to support staged package-mode migration.

## Current boundary map

### Keep as CJS (`.cjs`) for now

- `tools/check-runtime.cjs`
- `tools/check-modern-jquery-free.cjs`
- `tools/check-metrics-healthy-prereqs.cjs`
- `tools/check-classjs-fanout.cjs`

Reason: simple Node tooling scripts with stable CJS behavior; no migration pressure.

### ESM bridge artifacts already present

- `server/js/main-esm.mjs`
- `shared/js/gametypes-esm.mjs`

Reason: provide safe adoption path without changing default runtime mode.

### Legacy/default runtime entrypoints still CJS-targeted

- `server/js/main.js` (default server boot path)
- `shared/js/gametypes.js` (CJS + global contract)

Reason: compatibility with existing tests and legacy client/server contracts.

## Planned destination

- Tooling `.cjs` scripts:
  - remain CJS unless strong reason to migrate.
- Runtime/server bridge:
  - continue expanding ESM-safe paths before package-mode flip.
- Shared contracts:
  - maintain dual-export compatibility until full package-mode migration is complete.

## Verification when touching boundaries

- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
- `bun run check:class-fanout`
