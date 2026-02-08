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

- CJS websocket runtime uses shared class-factory artifact (`server/js/ws-runtime-class-factory.cjs` via `server/js/ws.js`).
- ESM websocket runtime uses the same shared class-factory artifact (`server/js/ws-runtime-class-factory.mjs` via `server/js/ws-runtime-esm.mjs`).
- Authored source for that artifact: `server/js/ws-runtime-class-factory.cts`.
- Artifact workflow:
  - regenerate: `bun run build:ws-runtime-factory`
  - validate sync: `bun run check:ws-runtime-factory-sync`
- Decision record: `docs/websocket-cjs-factory-migration-decision.md`.
- Parity runbook: `docs/websocket-runtime-class-boundary-parity.md`.
- Escalation template: `docs/websocket-boundary-escalation-template.md`.
- Operator checklist / owner handoff / rollback drill cadence:
  - `docs/websocket-cjs-factory-migration-decision.md`.

Websocket module boundary decision:

- CJS runtime consumes generated `server/js/ws.js` artifact.
- Authored source for that artifact: `server/js/ws.cts`.
- Artifact workflow:
  - regenerate: `bun run build:ws-module`
  - validate sync: `bun run check:ws-module-sync`
- Contract + pre-slice artifacts:
  - `docs/ws-module-ts-contract-extraction.md`
  - `docs/ws-module-ts-shadow-source-pre-slice.md`

Worldserver boundary decision:

- CJS runtime consumes generated `server/js/worldserver.js` artifact.
- Authored source for that artifact: `server/js/worldserver.cts`.
- Artifact workflow:
  - regenerate: `bun run build:worldserver`
  - validate sync: `bun run check:worldserver-sync`
- Pre-slice inventory/checklist: `docs/worldserver-ts-shadow-source-pre-slice.md`.

Player boundary decision:

- CJS runtime consumes generated `server/js/player.js` artifact.
- Authored source for that artifact: `server/js/player.cts`.
- Artifact workflow:
  - regenerate: `bun run build:player`
  - validate sync: `bun run check:player-sync`
- Contract extraction artifact: `docs/player-ts-contract-extraction.md`.

Character boundary decision:

- CJS runtime consumes generated `server/js/character.js` artifact.
- Authored source for that artifact: `server/js/character.cts`.
- Artifact workflow:
  - regenerate: `bun run build:character`
  - validate sync: `bun run check:character-sync`
- Pre-slice checklist: `docs/character-ts-shadow-source-pre-slice.md`.

Mob boundary decision:

- CJS runtime consumes generated `server/js/mob.js` artifact.
- Authored source for that artifact: `server/js/mob.cts`.
- Artifact workflow:
  - regenerate: `bun run build:mob`
  - validate sync: `bun run check:mob-sync`
- Pre-slice checklist: `docs/mob-ts-shadow-source-pre-slice.md`.

MobArea boundary decision:

- CJS runtime consumes generated `server/js/mobarea.js` artifact.
- Authored source for that artifact: `server/js/mobarea.cts`.
- Artifact workflow:
  - regenerate: `bun run build:mobarea`
  - validate sync: `bun run check:mobarea-sync`
- Pre-slice checklist: `docs/mobarea-ts-shadow-source-pre-slice.md`.

Map boundary decision:

- CJS runtime consumes generated `server/js/map.js` artifact.
- Authored source for that artifact: `server/js/map.cts`.
- Artifact workflow:
  - regenerate: `bun run build:map`
  - validate sync: `bun run check:map-sync`
- Pre-slice checklist: `docs/map-ts-shadow-source-pre-slice.md`.

Chest boundary decision:

- CJS runtime consumes generated `server/js/chest.js` artifact.
- Authored source for that artifact: `server/js/chest.cts`.
- Artifact workflow:
  - regenerate: `bun run build:chest`
  - validate sync: `bun run check:chest-sync`
- Pre-slice checklist: `docs/chest-ts-shadow-source-pre-slice.md`.

Properties boundary decision:

- CJS runtime consumes generated `server/js/properties.js` artifact.
- Authored source for that artifact: `server/js/properties.cts`.
- Artifact workflow:
  - regenerate: `bun run build:properties`
  - validate sync: `bun run check:properties-sync`
- Pre-slice checklist: `docs/properties-ts-shadow-source-pre-slice.md`.

Entity boundary decision:

- CJS runtime consumes generated `server/js/entity.js` artifact.
- Authored source for that artifact: `server/js/entity.cts`.
- Artifact workflow:
  - regenerate: `bun run build:entity`
  - validate sync: `bun run check:entity-sync`
- Pre-slice checklist: `docs/entity-ts-shadow-source-pre-slice.md`.

Item boundary decision:

- CJS runtime consumes generated `server/js/item.js` artifact.
- Authored source for that artifact: `server/js/item.cts`.
- Artifact workflow:
  - regenerate: `bun run build:item`
  - validate sync: `bun run check:item-sync`
- Pre-slice checklist: `docs/item-ts-shadow-source-pre-slice.md`.

NPC boundary decision:

- CJS runtime consumes generated `server/js/npc.js` artifact.
- Authored source for that artifact: `server/js/npc.cts`.
- Artifact workflow:
  - regenerate: `bun run build:npc`
  - validate sync: `bun run check:npc-sync`
- Pre-slice checklist: `docs/npc-ts-shadow-source-pre-slice.md`.

Message boundary decision:

- CJS runtime consumes generated `server/js/message.js` artifact.
- Authored source for that artifact: `server/js/message.cts`.
- Artifact workflow:
  - regenerate: `bun run build:message`
  - validate sync: `bun run check:message-sync`
- Pre-slice checklist: `docs/message-ts-shadow-source-pre-slice.md`.

ChestArea boundary decision:

- CJS runtime consumes generated `server/js/chestarea.js` artifact.
- Authored source for that artifact: `server/js/chestarea.cts`.
- Artifact workflow:
  - regenerate: `bun run build:chestarea`
  - validate sync: `bun run check:chestarea-sync`
- Pre-slice checklist: `docs/chestarea-ts-shadow-source-pre-slice.md`.

Checkpoint boundary decision:

- CJS runtime consumes generated `server/js/checkpoint.js` artifact.
- Authored source for that artifact: `server/js/checkpoint.cts`.
- Artifact workflow:
  - regenerate: `bun run build:checkpoint`
  - validate sync: `bun run check:checkpoint-sync`
- Pre-slice checklist: `docs/checkpoint-ts-shadow-source-pre-slice.md`.

Area boundary decision:

- CJS runtime consumes generated `server/js/area.js` artifact.
- Authored source for that artifact: `server/js/area.cts`.
- Artifact workflow:
  - regenerate: `bun run build:area`
  - validate sync: `bun run check:area-sync`
- Pre-slice checklist: `docs/area-ts-shadow-source-pre-slice.md`.

Formulas boundary decision:

- CJS runtime consumes generated `server/js/formulas.js` artifact.
- Authored source for that artifact: `server/js/formulas.cts`.
- Artifact workflow:
  - regenerate: `bun run build:formulas`
  - validate sync: `bun run check:formulas-sync`
- Pre-slice checklist: `docs/formulas-ts-shadow-source-pre-slice.md`.

Log boundary decision:

- CJS runtime consumes generated `server/js/log.js` artifact.
- Authored source for that artifact: `server/js/log.cts`.
- Artifact workflow:
  - regenerate: `bun run build:log`
  - validate sync: `bun run check:log-sync`
- Pre-slice checklist: `docs/log-ts-shadow-source-pre-slice.md`.

Utils boundary decision:

- CJS runtime consumes generated `server/js/utils.js` artifact.
- Authored source for that artifact: `server/js/utils.cts`.
- Artifact workflow:
  - regenerate: `bun run build:utils`
  - validate sync: `bun run check:utils-sync`
- Pre-slice checklist: `docs/utils-ts-shadow-source-pre-slice.md`.

Format boundary decision:

- CJS runtime consumes generated `server/js/format.js` artifact.
- Authored source for that artifact: `server/js/format.cts`.
- Artifact workflow:
  - regenerate: `bun run build:format`
  - validate sync: `bun run check:format-sync`
- Pre-slice checklist: `docs/format-ts-shadow-source-pre-slice.md`.

Metrics-client boundary decision:

- CJS runtime consumes generated `server/js/metrics-client.js` artifact.
- Authored source for that artifact: `server/js/metrics-client.cts`.
- Artifact workflow:
  - regenerate: `bun run build:metrics-client`
  - validate sync: `bun run check:metrics-client-sync`
- Pre-slice checklist: `docs/metrics-client-ts-shadow-source-pre-slice.md`.

Config-preflight boundary decision:

- CJS runtime consumes generated `server/js/config-preflight.js` artifact.
- Authored source for that artifact: `server/js/config-preflight.cts`.
- Artifact workflow:
  - regenerate: `bun run build:config-preflight`
  - validate sync: `bun run check:config-preflight-sync`
- Pre-slice checklist: `docs/config-preflight-ts-shadow-source-pre-slice.md`.

Main boundary decision:

- CJS runtime consumes generated `server/js/main.js` artifact.
- Authored source for that artifact: `server/js/main.cts`.
- Artifact workflow:
  - regenerate: `bun run build:main`
  - validate sync: `bun run check:main-sync`
- Pre-slice checklist: `docs/main-ts-shadow-source-pre-slice.md`.

Main-runtime boundary decision:

- CJS runtime consumes generated `server/js/main-runtime.js` artifact.
- Authored source for that artifact: `server/js/main-runtime.cts`.
- Artifact workflow:
  - regenerate: `bun run build:main-runtime`
  - validate sync: `bun run check:main-runtime-sync`
- Pre-slice checklist: `docs/main-runtime-ts-shadow-source-pre-slice.md`.

Metrics boundary decision:

- CJS runtime consumes generated `server/js/metrics.js` artifact.
- Authored source for that artifact: `server/js/metrics.cts`.
- Artifact workflow:
  - regenerate: `bun run build:metrics`
  - validate sync: `bun run check:metrics-sync`
- Pre-slice checklist: `docs/metrics-ts-shadow-source-pre-slice.md`.

Metrics-runtime boundary decision:

- CJS runtime consumes generated `server/js/metrics-runtime.js` artifact.
- Authored source for that artifact: `server/js/metrics-runtime.cts`.
- Artifact workflow:
  - regenerate: `bun run build:metrics-runtime`
  - validate sync: `bun run check:metrics-runtime-sync`
- Pre-slice checklist: `docs/metrics-runtime-ts-shadow-source-pre-slice.md`.

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

- `server/js/main-runtime.js` remains the default CJS startup artifact and owns runtime assembly (source-of-truth is now `server/js/main-runtime.cts`).
- Core runtime modules (`worldserver`, `player`, `map`, metrics/runtime graph) remain CJS-backed in default path.
- Several ESM mirrors still rely on bridge wrappers (`createRequire`) outside websocket runtime slice.
- Worldserver TS shadow-source pre-slice inventory/checklist:
  - `docs/worldserver-ts-shadow-source-pre-slice.md`
- Player TS seam contract extraction:
  - `docs/player-ts-contract-extraction.md`
- Character module TS shadow-source pre-slice:
  - `docs/character-ts-shadow-source-pre-slice.md`
- Mob module TS shadow-source pre-slice:
  - `docs/mob-ts-shadow-source-pre-slice.md`
- MobArea module TS shadow-source pre-slice:
  - `docs/mobarea-ts-shadow-source-pre-slice.md`
- Map module TS shadow-source pre-slice:
  - `docs/map-ts-shadow-source-pre-slice.md`
- Chest module TS shadow-source pre-slice:
  - `docs/chest-ts-shadow-source-pre-slice.md`
- Properties module TS shadow-source pre-slice:
  - `docs/properties-ts-shadow-source-pre-slice.md`
- Entity module TS shadow-source pre-slice:
  - `docs/entity-ts-shadow-source-pre-slice.md`
- Item module TS shadow-source pre-slice:
  - `docs/item-ts-shadow-source-pre-slice.md`
- NPC module TS shadow-source pre-slice:
  - `docs/npc-ts-shadow-source-pre-slice.md`
- Message module TS shadow-source pre-slice:
  - `docs/message-ts-shadow-source-pre-slice.md`
- ChestArea module TS shadow-source pre-slice:
  - `docs/chestarea-ts-shadow-source-pre-slice.md`
- Checkpoint module TS shadow-source pre-slice:
  - `docs/checkpoint-ts-shadow-source-pre-slice.md`
- Area module TS shadow-source pre-slice:
  - `docs/area-ts-shadow-source-pre-slice.md`
- Formulas module TS shadow-source pre-slice:
  - `docs/formulas-ts-shadow-source-pre-slice.md`
- Log module TS shadow-source pre-slice:
  - `docs/log-ts-shadow-source-pre-slice.md`
- Utils module TS shadow-source pre-slice:
  - `docs/utils-ts-shadow-source-pre-slice.md`
- Format module TS shadow-source pre-slice:
  - `docs/format-ts-shadow-source-pre-slice.md`
- Metrics-client module TS shadow-source pre-slice:
  - `docs/metrics-client-ts-shadow-source-pre-slice.md`
- Config-preflight module TS shadow-source pre-slice:
  - `docs/config-preflight-ts-shadow-source-pre-slice.md`
- Main module TS shadow-source pre-slice:
  - `docs/main-ts-shadow-source-pre-slice.md`
- Websocket module TS seam contract extraction:
  - `docs/ws-module-ts-contract-extraction.md`
- Websocket module TS shadow-source pre-slice:
  - `docs/ws-module-ts-shadow-source-pre-slice.md`
- Main runtime TS shadow-source pre-slice:
  - `docs/main-runtime-ts-shadow-source-pre-slice.md`
- Metrics module TS shadow-source pre-slice:
  - `docs/metrics-ts-shadow-source-pre-slice.md`

## Verification when touching boundaries

- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
- `bun test tests/smoke/server-handshake-esm-ws-runtime.test.ts`
- `bun run check:class-fanout`
- `bun run check:package-mode-boundaries`
- `bun run check:legacy-optimizer-integrity`
- `bun run check:ws:runbooks`
- `bun run test:ws:runtime:drill`
- `bun run test:ws:runtime:decision`
