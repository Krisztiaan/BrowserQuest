BrowserQuest
============

BrowserQuest is a HTML5/JavaScript multiplayer game experiment.

Runtime requirements
--------------------

- Node.js `22.x` (see `.nvmrc`)
- Bun `>= 1.3.0`
- Package mode: `"type": "module"` with explicit CJS boundaries for legacy/tooling scripts.
- CI verify workflows pin Bun `1.3.8` for reproducibility.
- Optional preflight: `bun run check:runtime`
- If your shell Node is not `22.x`, run commands with:
  - `bash tools/node22-run.sh bun run check:runtime`
  - `bun run verify:modern:node22`

Quickstart (local dev)
----------------------

1) Check runtime policy: `bun run check:runtime`
2) If Node mismatch, use wrapper commands:
   - `bun run check:runtime:node22`
   - `bun run verify:modern:node22`
3) Install deps: `bun install`
4) Run server + client: `bun run dev`
5) Open: `http://localhost:3000/` (modern client default) — connects to `ws://localhost:8000/`
   - Legacy entry `http://localhost:3000/index.html` remains available only as a retirement fallback path.

Vite (modern tooling):
- `bun run dev:vite:full` then open `http://localhost:5173/` (modern default redirect)
  - Explicit modern entry: `http://localhost:5173/client/modern.html` (ESM)
- Optional server ESM bridge entrypoint: `bun run start:server:esm` (default path remains `bun run start:server`).
  - ESM entry currently runs ESM config preflight before handing off to compatible CJS runtime boot.
  - Optional websocket mirror probe: `bun run start:server:esm:ws-bridge:probe`
    - Emits structured event: `server.esm.ws_bridge_probe` (`status=ok|failed`).
  - Optional ESM websocket runtime mode: `bun run start:server:esm:ws-runtime`
    - Injects ESM websocket runtime through startup dependency seams.
    - Emits structured event: `server.esm.ws_runtime_mode` (`mode=esm`, `status=ok`).
  - Optional forced-failure runtime probe:
    - `bun run start:server:esm:ws-runtime:fail`
    - Emits `server.esm.ws_runtime_mode` with `status=failed` and `reason=forced_failure`, then exits non-zero.
  - Runtime-mode smoke command: `bun run test:smoke:esm:ws-runtime`
  - Helper contract mapping:
    - `server/js/main-esm-bridge-probe.mjs` -> `start:server:esm:ws-bridge:probe`
    - `server/js/main-esm-runtime-options.mjs` -> `start:server:esm:ws-runtime` / `start:server:esm:ws-runtime:fail`

Build profiles (modern vs legacy):
- `bun run build:vite` builds the modern ESM page (`client/modern.html`) and is the default production path.
- `bun run build:vite:legacy` is retired and intentionally exits with guidance.
- `bun run build:client` is retired and intentionally exits with guidance.

Verification gates:
- `bun run verify:modern` runs runtime/package guardrails + server/client coverage guards + server ESM checkJs + lint + format check + tests + modern Vite build.
- `bun run verify` aliases `verify:modern`.
- Current modernization readiness snapshot: `docs/modernization-readiness-status.md`.
- `bun run typecheck` runs incremental TypeScript checks for tests/tooling plus runtime-adjacent JS modules (`tsconfig.typecheck.json` + `tsconfig.typecheck-runtime.json` + `tsconfig.typecheck-server-esm.json` + client lanes).
- `bun run typecheck:server-esm` checks server/shared ESM bridge/runtime modules under `allowJs` + `checkJs` (`tsconfig.typecheck-server-esm.json`).
- `bun run check:deps:drift` reports direct dependency drift via Bun-native audit tooling (`tools/check-dependency-drift.cjs`).
  - Node22 policy variant: `bun run check:deps:drift:node22`.
- External signoff readiness checks:
  - `bun run check:legacy-signoff:report` prints unresolved external signoff blockers without failing.
  - `bun run check:legacy-signoff:report:json` emits machine-readable blocker status (`ready` + issue list).
  - `bun run check:legacy-signoff:ready` fails until T-209/T-210/T-211 docs are fully completed and signed off.
- `bun run check:class-fanout` guards accidental new `server/js/lib/class.js` dependencies during native-class migration.
- `bun run check:package-mode-boundaries` guards ESM package-mode assumptions (`"type": "module"` + legacy `bin/r.cjs` boundary wiring).
- `bun run check:legacy-optimizer-integrity` remains available for rollback artifact integrity validation.
- `bun run check:modern-jquery-free` enforces that modern ESM runtime (`client/js-esm/**/*.js`) stays jQuery-free.
- `bun run check:client-runtime-coverage` enforces that all top-level modern client runtime files (`client/js-esm/*.js`) are reachable from `tsconfig.typecheck-client-runtime.json`.
- `bun run check:client-runtime-alias-drift` enforces that bare import specifiers used by runtime-lane client modules are explicitly covered by `tsconfig.typecheck-client-runtime.json` `paths`.
  - Strict hygiene variant: `bun run check:client-runtime-alias-drift:strict` also fails on unused/stale explicit aliases.
- `bun run check:server-esm-runtime-coverage` enforces that all runtime ESM bridge modules (`server/js/*.mjs` and `shared/js/*-esm.mjs`) are explicitly covered by `tsconfig.typecheck-server-esm.json`.
- `bun run check:server-shadow-hardening` enforces server shadow-source hardening invariants: no `@ts-nocheck` in `server/js/*.cts`, runtime artifact presence, and `.js` runtime artifacts backed by `.cts` sources.
- `bun run check:protocol-contract-sync` enforces that `shared/js/protocol-contract.js` matches generated output from `shared/js/protocol-contract.cts`.
- `bun run build:protocol-contract` regenerates `shared/js/protocol-contract.js` from the `.cts` source.
  - Workflow: edit `shared/js/protocol-contract.cts` -> `bun run build:protocol-contract` -> `bun run check:protocol-contract-sync`.
- `bun run check:ws-runtime-factory-sync` enforces that `server/js/ws-runtime-class-factory.cjs` matches generated output from `server/js/ws-runtime-class-factory.cts`.
- `bun run build:ws-runtime-factory` regenerates `server/js/ws-runtime-class-factory.cjs` from the `.cts` source.
  - Workflow: edit `server/js/ws-runtime-class-factory.cts` -> `bun run build:ws-runtime-factory` -> `bun run check:ws-runtime-factory-sync`.
- `bun run check:worldserver-sync` enforces that `server/js/worldserver.js` matches generated output from `server/js/worldserver.cts`.
- `bun run build:worldserver` regenerates `server/js/worldserver.js` from the `.cts` source.
  - Workflow: edit `server/js/worldserver.cts` -> `bun run build:worldserver` -> `bun run check:worldserver-sync`.
- `bun run check:player-sync` enforces that `server/js/player.js` matches generated output from `server/js/player.cts`.
- `bun run build:player` regenerates `server/js/player.js` from the `.cts` source.
  - Workflow: edit `server/js/player.cts` -> `bun run build:player` -> `bun run check:player-sync`.
- `bun run check:character-sync` enforces that `server/js/character.js` matches generated output from `server/js/character.cts`.
- `bun run build:character` regenerates `server/js/character.js` from the `.cts` source.
  - Workflow: edit `server/js/character.cts` -> `bun run build:character` -> `bun run check:character-sync`.
- `bun run check:mob-sync` enforces that `server/js/mob.js` matches generated output from `server/js/mob.cts`.
- `bun run build:mob` regenerates `server/js/mob.js` from the `.cts` source.
  - Workflow: edit `server/js/mob.cts` -> `bun run build:mob` -> `bun run check:mob-sync`.
- `bun run check:mobarea-sync` enforces that `server/js/mobarea.js` matches generated output from `server/js/mobarea.cts`.
- `bun run build:mobarea` regenerates `server/js/mobarea.js` from the `.cts` source.
  - Workflow: edit `server/js/mobarea.cts` -> `bun run build:mobarea` -> `bun run check:mobarea-sync`.
- `bun run check:map-sync` enforces that `server/js/map.js` matches generated output from `server/js/map.cts`.
- `bun run build:map` regenerates `server/js/map.js` from the `.cts` source.
  - Workflow: edit `server/js/map.cts` -> `bun run build:map` -> `bun run check:map-sync`.
- `bun run check:chest-sync` enforces that `server/js/chest.js` matches generated output from `server/js/chest.cts`.
- `bun run build:chest` regenerates `server/js/chest.js` from the `.cts` source.
  - Workflow: edit `server/js/chest.cts` -> `bun run build:chest` -> `bun run check:chest-sync`.
- `bun run check:properties-sync` enforces that `server/js/properties.js` matches generated output from `server/js/properties.cts`.
- `bun run build:properties` regenerates `server/js/properties.js` from the `.cts` source.
  - Workflow: edit `server/js/properties.cts` -> `bun run build:properties` -> `bun run check:properties-sync`.
- `bun run check:entity-sync` enforces that `server/js/entity.js` matches generated output from `server/js/entity.cts`.
- `bun run build:entity` regenerates `server/js/entity.js` from the `.cts` source.
  - Workflow: edit `server/js/entity.cts` -> `bun run build:entity` -> `bun run check:entity-sync`.
- `bun run check:item-sync` enforces that `server/js/item.js` matches generated output from `server/js/item.cts`.
- `bun run build:item` regenerates `server/js/item.js` from the `.cts` source.
  - Workflow: edit `server/js/item.cts` -> `bun run build:item` -> `bun run check:item-sync`.
- `bun run check:npc-sync` enforces that `server/js/npc.js` matches generated output from `server/js/npc.cts`.
- `bun run build:npc` regenerates `server/js/npc.js` from the `.cts` source.
  - Workflow: edit `server/js/npc.cts` -> `bun run build:npc` -> `bun run check:npc-sync`.
- `bun run check:message-sync` enforces that `server/js/message.js` matches generated output from `server/js/message.cts`.
- `bun run build:message` regenerates `server/js/message.js` from the `.cts` source.
  - Workflow: edit `server/js/message.cts` -> `bun run build:message` -> `bun run check:message-sync`.
- `bun run check:chestarea-sync` enforces that `server/js/chestarea.js` matches generated output from `server/js/chestarea.cts`.
- `bun run build:chestarea` regenerates `server/js/chestarea.js` from the `.cts` source.
  - Workflow: edit `server/js/chestarea.cts` -> `bun run build:chestarea` -> `bun run check:chestarea-sync`.
- `bun run check:checkpoint-sync` enforces that `server/js/checkpoint.js` matches generated output from `server/js/checkpoint.cts`.
- `bun run build:checkpoint` regenerates `server/js/checkpoint.js` from the `.cts` source.
  - Workflow: edit `server/js/checkpoint.cts` -> `bun run build:checkpoint` -> `bun run check:checkpoint-sync`.
- `bun run check:area-sync` enforces that `server/js/area.js` matches generated output from `server/js/area.cts`.
- `bun run build:area` regenerates `server/js/area.js` from the `.cts` source.
  - Workflow: edit `server/js/area.cts` -> `bun run build:area` -> `bun run check:area-sync`.
- `bun run check:formulas-sync` enforces that `server/js/formulas.js` matches generated output from `server/js/formulas.cts`.
- `bun run build:formulas` regenerates `server/js/formulas.js` from the `.cts` source.
  - Workflow: edit `server/js/formulas.cts` -> `bun run build:formulas` -> `bun run check:formulas-sync`.
- `bun run check:log-sync` enforces that `server/js/log.js` matches generated output from `server/js/log.cts`.
- `bun run build:log` regenerates `server/js/log.js` from the `.cts` source.
  - Workflow: edit `server/js/log.cts` -> `bun run build:log` -> `bun run check:log-sync`.
- `bun run check:utils-sync` enforces that `server/js/utils.js` matches generated output from `server/js/utils.cts`.
- `bun run build:utils` regenerates `server/js/utils.js` from the `.cts` source.
  - Workflow: edit `server/js/utils.cts` -> `bun run build:utils` -> `bun run check:utils-sync`.
- `bun run check:format-sync` enforces that `server/js/format.js` matches generated output from `server/js/format.cts`.
- `bun run build:format` regenerates `server/js/format.js` from the `.cts` source.
  - Workflow: edit `server/js/format.cts` -> `bun run build:format` -> `bun run check:format-sync`.
- `bun run check:metrics-client-sync` enforces that `server/js/metrics-client.js` matches generated output from `server/js/metrics-client.cts`.
- `bun run build:metrics-client` regenerates `server/js/metrics-client.js` from the `.cts` source.
  - Workflow: edit `server/js/metrics-client.cts` -> `bun run build:metrics-client` -> `bun run check:metrics-client-sync`.
- `bun run check:config-preflight-sync` enforces that `server/js/config-preflight.js` matches generated output from `server/js/config-preflight.cts`.
- `bun run build:config-preflight` regenerates `server/js/config-preflight.js` from the `.cts` source.
  - Workflow: edit `server/js/config-preflight.cts` -> `bun run build:config-preflight` -> `bun run check:config-preflight-sync`.
- `bun run check:main-sync` enforces that `server/js/main.js` matches generated output from `server/js/main.cts`.
- `bun run build:main` regenerates `server/js/main.js` from the `.cts` source.
  - Workflow: edit `server/js/main.cts` -> `bun run build:main` -> `bun run check:main-sync`.
- `bun run check:main-runtime-sync` enforces that `server/js/main-runtime.js` matches generated output from `server/js/main-runtime.cts`.
- `bun run build:main-runtime` regenerates `server/js/main-runtime.js` from the `.cts` source.
  - Workflow: edit `server/js/main-runtime.cts` -> `bun run build:main-runtime` -> `bun run check:main-runtime-sync`.
- `bun run check:ws-module-sync` enforces that `server/js/ws.js` matches generated output from `server/js/ws.cts`.
- `bun run build:ws-module` regenerates `server/js/ws.js` from the `.cts` source.
  - Workflow: edit `server/js/ws.cts` -> `bun run build:ws-module` -> `bun run check:ws-module-sync`.
- `bun run check:metrics-sync` enforces that `server/js/metrics.js` matches generated output from `server/js/metrics.cts`.
- `bun run build:metrics` regenerates `server/js/metrics.js` from the `.cts` source.
  - Workflow: edit `server/js/metrics.cts` -> `bun run build:metrics` -> `bun run check:metrics-sync`.
- `bun run check:metrics-runtime-sync` enforces that `server/js/metrics-runtime.js` matches generated output from `server/js/metrics-runtime.cts`.
- `bun run build:metrics-runtime` regenerates `server/js/metrics-runtime.js` from the `.cts` source.
  - Workflow: edit `server/js/metrics-runtime.cts` -> `bun run build:metrics-runtime` -> `bun run check:metrics-runtime-sync`.
- `bun run verify:modern` enforces `check:server-shadow-hardening` plus module sync checks (`check:worldserver-sync`, `check:player-sync`, `check:character-sync`, `check:mob-sync`, `check:mobarea-sync`, `check:map-sync`, `check:chest-sync`, `check:properties-sync`, `check:entity-sync`, `check:item-sync`, `check:npc-sync`, `check:message-sync`, `check:chestarea-sync`, `check:checkpoint-sync`, `check:area-sync`, `check:formulas-sync`, `check:log-sync`, `check:utils-sync`, `check:format-sync`, `check:metrics-client-sync`, `check:config-preflight-sync`, `check:main-sync`, `check:main-runtime-sync`, `check:ws-module-sync`, `check:metrics-sync`, and `check:metrics-runtime-sync`).
- `bun run verify:legacy` is retired and intentionally exits with guidance.
- `bun run test:modern-browser:install` (one-time) then `bun run test:browser:modern` runs a headless Playwright smoke against `client/modern.html`.
- `bun run test:browser:protocol` runs protocol-focused browser tests (`modern-protocol-actions` + `protocol-invariant`) for faster protocol triage loops.
- `bun run test:browser:protocol-invariant` replays deterministic `go`/`HELLO`/`WELCOME`/`CHAT` + `MOVE`/`ZONE` protocol flow plus invalid `MOVE` rejection behavior on the modern entry path.
- Protocol triage quick path:
  - Local: `bun run test:browser:protocol:node22` (or `bun run test:browser:protocol-invariant:node22` for invariant-only focus).
  - CI gate: `verify-protocol-invariant` (runs `test:browser:protocol:ci` and uploads `protocol-invariant-diagnostics-<run_id>` artifacts).
- `bun run test:static-entry` validates `bun run dev` entry routing (`/` => modern by default, `/index.html` legacy, env override supported).
- `bun run test:metrics:healthy` runs the opt-in healthy metrics smoke (`BQ_TEST_METRICS_HEALTH=1`) with built-in prerequisites preflight (`check:metrics:healthy-prereqs` for memcache package + memcached reachability).
- `bun run test:logs:lifecycle` / `bun run test:logs:fatal` run split structured-log smoke contracts.

Support policy:
- Primary supported path: modern ESM client + Vite (`build:vite` / `modern.html`).
- Legacy AMD/RequireJS path is compatibility mode and must be explicitly requested via legacy build scripts.
- Details: `docs/client-build-support.md`.
- Runtime preflight runbook: `docs/runtime-preflight.md`.
- Runtime CheckJs worldserver/map pre-slice: `docs/runtime-checkjs-worldserver-map-pre-slice.md`
- Worldserver TS shadow-source pre-slice: `docs/worldserver-ts-shadow-source-pre-slice.md`

Modernization snapshot
----------------------

- Live roadmap and ticket log: `MODERNIZE.md`
- Support matrix and verify commands: `docs/client-build-support.md`
- Dependency/runtime audit: `docs/dependency-modernization-audit.md`
- Legacy jQuery migration risk scan: `docs/legacy-jquery4-risk-scan.md`
- Modern ESM jQuery surface audit: `docs/modern-jquery-surface-audit.md`
- Server logging taxonomy: `docs/server-logging-taxonomy.md`
- Server CJS->ESM readiness inventory: `docs/server-cjs-esm-readiness-inventory.md`
- Server CJS hotspot index: `docs/server-cjs-hotspot-index.md`
- TypeScript runtime CheckJs defer list: `docs/typescript-runtime-checkjs-defer-list.md`
- Worldserver TS shadow-source pre-slice: `docs/worldserver-ts-shadow-source-pre-slice.md`
- Player TS contract extraction: `docs/player-ts-contract-extraction.md`
- Websocket module TS contract extraction: `docs/ws-module-ts-contract-extraction.md`
- Websocket module TS shadow-source pre-slice: `docs/ws-module-ts-shadow-source-pre-slice.md`
- Main runtime TS shadow-source pre-slice: `docs/main-runtime-ts-shadow-source-pre-slice.md`
- Character module TS shadow-source pre-slice: `docs/character-ts-shadow-source-pre-slice.md`
- Mob module TS shadow-source pre-slice: `docs/mob-ts-shadow-source-pre-slice.md`
- MobArea module TS shadow-source pre-slice: `docs/mobarea-ts-shadow-source-pre-slice.md`
- Map module TS shadow-source pre-slice: `docs/map-ts-shadow-source-pre-slice.md`
- Chest module TS shadow-source pre-slice: `docs/chest-ts-shadow-source-pre-slice.md`
- Properties module TS shadow-source pre-slice: `docs/properties-ts-shadow-source-pre-slice.md`
- Entity module TS shadow-source pre-slice: `docs/entity-ts-shadow-source-pre-slice.md`
- Item module TS shadow-source pre-slice: `docs/item-ts-shadow-source-pre-slice.md`
- NPC module TS shadow-source pre-slice: `docs/npc-ts-shadow-source-pre-slice.md`
- Message module TS shadow-source pre-slice: `docs/message-ts-shadow-source-pre-slice.md`
- ChestArea module TS shadow-source pre-slice: `docs/chestarea-ts-shadow-source-pre-slice.md`
- Checkpoint module TS shadow-source pre-slice: `docs/checkpoint-ts-shadow-source-pre-slice.md`
- Area module TS shadow-source pre-slice: `docs/area-ts-shadow-source-pre-slice.md`
- Formulas module TS shadow-source pre-slice: `docs/formulas-ts-shadow-source-pre-slice.md`
- Log module TS shadow-source pre-slice: `docs/log-ts-shadow-source-pre-slice.md`
- Utils module TS shadow-source pre-slice: `docs/utils-ts-shadow-source-pre-slice.md`
- Format module TS shadow-source pre-slice: `docs/format-ts-shadow-source-pre-slice.md`
- Metrics client module TS shadow-source pre-slice: `docs/metrics-client-ts-shadow-source-pre-slice.md`
- Config preflight module TS shadow-source pre-slice: `docs/config-preflight-ts-shadow-source-pre-slice.md`
- Main module TS shadow-source pre-slice: `docs/main-ts-shadow-source-pre-slice.md`
- Metrics module TS shadow-source pre-slice: `docs/metrics-ts-shadow-source-pre-slice.md`
- Metrics runtime TS shadow-source pre-slice: `docs/metrics-runtime-ts-shadow-source-pre-slice.md`
- Server `lib/class.js` fanout map: `docs/server-classjs-fanout-map.md`
- Server core class-migration plan: `docs/server-core-class-migration-plan.md`
- Package-mode migration checklist: `docs/package-mode-migration-checklist.md`
- Runtime CJS boundary inventory: `docs/runtime-cjs-boundary-inventory.md`
- Websocket runtime class-boundary parity runbook: `docs/websocket-runtime-class-boundary-parity.md`
- Websocket CJS class-factory decision record: `docs/websocket-cjs-factory-migration-decision.md`
- Websocket factory TS source-promotion plan: `docs/websocket-factory-ts-source-promotion-plan.md`
- Websocket boundary escalation template: `docs/websocket-boundary-escalation-template.md`
- Legacy optimizer containment assessment: `docs/legacy-optimizer-containment-assessment.md`
- Legacy optimizer provenance + integrity baseline: `docs/legacy-optimizer-provenance.md`
- Legacy artifact consumer inventory: `docs/legacy-artifact-consumer-inventory.md`
- Legacy gate demotion rehearsal plan: `docs/legacy-gate-demotion-rehearsal-plan.md`
- Legacy branch-protection demotion runbook: `docs/legacy-branch-protection-demotion-runbook.md`
- Legacy branch-protection demotion dry-run evidence: `docs/legacy-branch-protection-dry-run-evidence.md`
- Legacy advisory gate incident template: `docs/legacy-advisory-gate-incident-template.md`
- Legacy advisory incident log: `docs/legacy-advisory-incident-log.md`
- Legacy retirement cutover PR checklist: `docs/legacy-retirement-cutover-pr-checklist.md`
- Legacy retirement preflight gaps: `docs/legacy-retirement-preflight-gaps.md`
- Legacy external consumer confirmation protocol: `docs/legacy-external-consumer-confirmation-protocol.md`
- Legacy retirement rollback assignment: `docs/legacy-retirement-rollback-assignment.md`
- Legacy retirement readiness decision gate: `docs/legacy-retirement-readiness-decision.md`
- Package-mode trial runbook: `docs/package-mode-trial-runbook.md`
- Legacy/package-mode compatibility matrix: `docs/legacy-package-mode-compat-matrix.md`
- Package-mode trial decision log: `docs/package-mode-trial-decision.md`
- Metrics healthy-path smoke plan: `docs/metrics-health-smoke-plan.md`
- Metrics healthy-path workflow evidence currently runs on fork `Krisztiaan/BrowserQuest` (upstream `mozilla/BrowserQuest` is read-only in this context).
- CI gates: `verify-modern`, `verify-modern-browser`, `verify-protocol-invariant`
- Legacy verification workflows are retired; active CI gates are `verify-modern`, `verify-modern-browser`, `verify-protocol-invariant`, `verify-dependency-drift`, and `verify-metrics-healthy`.
  - Optional drift visibility workflow: `verify-dependency-drift`
  - Optional/manual healthy metrics workflow: `verify-metrics-healthy`
  - Trigger/triage guide: `docs/metrics-health-smoke-plan.md`
- Primary verification commands:
  - `bun run verify:modern` (or `bun run verify:modern:node22`)
  - `bun run test:ws:runtime:drill` (websocket boundary drill summary)
  - `bun run test:browser:modern` / `bun run test:browser:protocol` / `bun run test:browser:protocol-invariant`


Documentation
-------------

Documentation is located in client and server directories.


License
-------

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
See the LICENSE file for details.


Credits
-------
Created by [Little Workshop](http://www.littleworkshop.fr):

* Franck Lecollinet - [@whatthefranck](http://twitter.com/whatthefranck)
* Guillaume Lecollinet - [@glecollinet](http://twitter.com/glecollinet)
