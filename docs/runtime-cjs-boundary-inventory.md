# Runtime CJS Boundary Inventory (2026-02-07)

## Purpose

Document intentional CommonJS boundaries after server-side class modernization and package-mode adoption, including the current server startup dependency seam shape.

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
- `server/js/main-runtime-esm.mjs`
- `shared/js/gametypes-esm.mjs`
- `shared/js/protocol-contract-esm.mjs`
- `shared/js/ws-close-codes-esm.mjs`
- `server/js/config-preflight-esm.mjs`
- `server/js/utils-esm.mjs`
- `server/js/log-esm.mjs`
- `server/js/format-esm.mjs`
- `server/js/ws-esm.mjs`
- `server/js/ws-runtime-esm.mjs`

Reason: provide safe adoption path without changing default runtime mode.

### Runtime entrypoints under ESM package mode

- `server/js/main.js` (default server boot path)
- `server/js/main-runtime.js` (default startup dependency graph assembly)
- `server/js/main-esm.mjs` (opt-in ESM preflight/probe entry that delegates to shared runtime startup contract)
- `shared/js/gametypes.js` (CJS + global contract)
- `shared/js/protocol-contract.js` (CJS protocol constants/parser contract)
- `shared/js/ws-close-codes.js` (CJS websocket close-code contract)

Reason: compatibility with existing tests and legacy client/server contracts.

Websocket boundary decision:

- CJS websocket runtime remains inline (`server/js/ws.js`).
- ESM websocket runtime uses class-factory seam (`server/js/ws-runtime-class-factory.mjs` via `server/js/ws-runtime-esm.mjs`).
- Decision record: `docs/websocket-cjs-factory-migration-decision.md`.
- Operator checklist / owner handoff / rollback drill cadence:
  - `docs/websocket-cjs-factory-migration-decision.md`.

## Startup dependency seam snapshot

- Default server start (`bun run start:server`) remains CJS:
  - `server/js/main.js` -> `server/js/main-runtime.js` -> CJS `ws` dependency.
- Opt-in ESM entry (`bun run start:server:esm`) performs:
  - ESM config preflight,
  - optional websocket bridge probe (`BQ_ESM_WS_BRIDGE_PROBE=1`),
  - optional ESM websocket runtime injection (`BQ_ESM_WS_RUNTIME=1`) by passing `ws-esm` through `createRuntimeDependencies(...)`.
- Extracted helper seams for ESM startup entry:
  - `server/js/main-esm-bridge-probe.mjs` (bridge-probe contract checks + diagnostics),
  - `server/js/main-esm-runtime-options.mjs` (runtime-option/env decision contract).
- Runtime mode signals:
  - `server.esm.ws_bridge_probe` (`status=ok|failed`)
  - `server.esm.ws_runtime_mode` (`mode=esm`, `status=ok|failed`)

## Planned destination

- Tooling `.cjs` scripts:
  - remain CJS unless strong reason to migrate.
- Runtime/server bridge:
  - continue expanding ESM-native startup paths after package-mode adoption, using dependency seam injection before flipping defaults.
- Shared contracts:
  - maintain dual-export compatibility until full package-mode migration is complete.

## Remaining convergence blockers

- `server/js/main-runtime.js` is still CJS and owns default startup assembly.
- Core runtime modules (`worldserver`, `player`, `map`, metrics/runtime graph) remain CJS-backed in default path.
- Several ESM mirrors still rely on bridge wrappers (`createRequire`) outside websocket runtime slice.

## Verification when touching boundaries

- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
- `bun test tests/smoke/server-handshake-esm-ws-runtime.test.ts`
- `bun run check:class-fanout`
- `bun run check:package-mode-boundaries`
- `bun run check:legacy-optimizer-integrity`
- `bun run test:ws:runtime:decision`
