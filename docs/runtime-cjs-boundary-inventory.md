# Runtime CJS Boundary Inventory (2026-02-07)

## Purpose

Document intentional CommonJS boundaries after server-side class modernization and package-mode adoption.

## Current boundary map

### Keep as CJS (`.cjs`) for now

- `tools/check-runtime.cjs`
- `tools/check-modern-jquery-free.cjs`
- `tools/check-metrics-healthy-prereqs.cjs`
- `tools/check-classjs-fanout.cjs`
- `tools/check-package-mode-boundaries.cjs`
- `tools/check-legacy-optimizer-integrity.cjs`
- `bin/r.cjs` (legacy RequireJS optimizer runner wrapper)

Reason: these scripts are intentionally CJS compatibility boundaries while package mode is ESM.

### ESM bridge artifacts already present

- `server/js/main-esm.mjs`
- `shared/js/gametypes-esm.mjs`
- `shared/js/protocol-contract-esm.mjs`
- `server/js/config-preflight-esm.mjs`
- `server/js/utils-esm.mjs`

Reason: provide safe adoption path without changing default runtime mode.

### Runtime entrypoints under ESM package mode

- `server/js/main.js` (default server boot path)
- `shared/js/gametypes.js` (CJS + global contract)
- `shared/js/protocol-contract.js` (CJS protocol constants/parser contract)

Reason: compatibility with existing tests and legacy client/server contracts.

## Planned destination

- Tooling `.cjs` scripts:
  - remain CJS unless strong reason to migrate.
- Runtime/server bridge:
  - continue expanding ESM-safe paths after package-mode adoption.
- Shared contracts:
  - maintain dual-export compatibility until full package-mode migration is complete.

## Verification when touching boundaries

- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
- `bun run check:class-fanout`
- `bun run check:package-mode-boundaries`
- `bun run check:legacy-optimizer-integrity`
