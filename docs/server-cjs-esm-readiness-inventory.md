# Server CJS->ESM Readiness Inventory (2026-02-07)

## Goal

Track post-adoption server/runtime ESM migration readiness without breaking legacy compatibility gates.

## Current boundary snapshot

- Package mode is ESM (`package.json` has `"type": "module"`).
- Server module graph is fully CJS:
  - `28 / 28` files in `server/js/*.js` and `server/js/**.js` use `require(...)` / `module.exports` / `exports.*`.
- Shared runtime contract remains dual-environment CJS/global:
  - `shared/js/gametypes.js` writes `globalThis.Types` and also uses `module.exports`.
  - `shared/js/protocol-contract.js` exposes protocol constants/parser via `module.exports`.
- ESM runtime mirrors landed:
  - `server/js/config-preflight-esm.mjs`
  - `server/js/utils-esm.mjs`
  - `server/js/log-esm.mjs`
  - `server/js/format-esm.mjs`
  - `shared/js/protocol-contract-esm.mjs`
- Tooling/runtime edges still CJS:
  - `tools/check-runtime.cjs`
  - `tools/check-modern-jquery-free.cjs`
  - `tools/check-metrics-healthy-prereqs.cjs`
  - `tools/check-package-mode-boundaries.cjs`
  - `tools/maps/processmap.js` (CJS).
- Unit tests currently consume server modules via CJS `require(...)`:
  - `tests/unit/server-config-preflight.test.ts`
  - `tests/unit/metrics-client.test.ts`
  - `tests/unit/metrics-runtime.test.ts`
  - `tests/unit/server-log.test.ts`

## High-risk modules and blockers

1. `server/js/worldserver.js` (869 lines), `server/js/player.js` (409), `server/js/ws.js` (243), `server/js/map.js` (228), and `server/js/main.js` (221) are dense, highly connected entry/core modules.
2. Legacy CommonJS server modules still dominate runtime graph; conversion sequencing must preserve protocol and gameplay invariants.
3. `shared/js/gametypes.js` is a cross-runtime contract for both server and browser; changing export shape can break protocol/runtime parity.
4. `server/js/metrics.js` has optional runtime dependency loading (`require("memcache")`) that must stay lazy/fault-tolerant under ESM.
5. Existing test/runtime launch paths execute `bun server/js/main.js`; entrypoint compatibility must be preserved while reducing CJS runtime debt.

## Recommended migration sequence

### Phase 0: Bridge setup (no behavior changes)

- Add an ESM entry candidate while preserving current entrypoint:
  - Keep `server/js/main.js` as compatibility bootstrap.
  - Introduce ESM runner target (for example `server/js/main.mjs`) behind explicit opt-in command first.
- Introduce `shared/js/gametypes` ESM-compatible export surface without removing existing global/CJS behavior.

### Phase 1: Leaf module conversion

- Convert low-fanout server utilities first:
  - `server/js/log.js`
  - `server/js/utils.js`
  - `server/js/config-preflight.js`
  - `server/js/metrics-runtime.js`
  - `server/js/metrics-client.js`
  - `server/js/metrics-adapters/noop.js`
  - `server/js/metrics-adapters/memcache.js`
- Keep CJS wrappers where required by existing test imports until test migration lands.

### Phase 2: Core gameplay/server graph conversion

- Migrate interconnected gameplay modules in dependency layers:
  - Base entities/areas/messages before `player`/`worldserver`.
  - Convert `ws` and server boot wiring only after gameplay modules are stable.
- Replace `server/js/lib/class.js` usage with native `class` syntax once dependent modules are converted.

### Phase 3: Runtime graph reduction after package adoption

- Switch runtime launch commands to ESM entrypoint after parity evidence.
- Keep package-level `"type": "module"` and continue isolating intentional CJS scripts as `.cjs`.

## Verification gates for each phase

- Runtime/build/test gates:
 - `bun run verify:modern:node22`
 - `bun run verify:legacy:node22`
 - `bun run test:browser:protocol:node22`
 - `bun run test:browser:legacy:node22`
  - `bun run check:package-mode-boundaries`
- Dependency/runtime drift visibility:
  - `bun run check:deps:drift:node22`
  - `verify-dependency-drift` workflow artifact snapshot.
- For each migration slice:
  - Require unchanged protocol invariant behavior before/after slice.
  - Require legacy intro smoke and optional hook probe to remain green.

## Immediate follow-up tickets

1. Keep package-mode boundary checks active in local and CI verification paths.
2. Convert additional server runtime modules from CJS exports/imports where risk is acceptable.
3. Reassess `shared/js/gametypes` dual-export strategy before removing CJS/global compatibility.

Reference artifact: `docs/server-classjs-fanout-map.md`
Core execution plan: `docs/server-core-class-migration-plan.md`
Package-mode checklist: `docs/package-mode-migration-checklist.md`
Runtime CJS boundaries: `docs/runtime-cjs-boundary-inventory.md`
Package-mode trial runbook: `docs/package-mode-trial-runbook.md`
Legacy/package-mode compatibility matrix: `docs/legacy-package-mode-compat-matrix.md`
Package-mode trial decision: `docs/package-mode-trial-decision.md`
