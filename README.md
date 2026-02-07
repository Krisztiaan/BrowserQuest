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
  - `bun run verify:modern:node22` / `bun run verify:legacy:node22`

Quickstart (local dev)
----------------------

1) Check runtime policy: `bun run check:runtime`
2) If Node mismatch, use wrapper commands:
   - `bun run check:runtime:node22`
   - `bun run verify:modern:node22`
3) Install deps: `bun install`
4) Run server + client: `bun run dev`
5) Open: `http://localhost:3000/` (modern client default) — connects to `ws://localhost:8000/`
   - Legacy compatibility entry remains available at `http://localhost:3000/index.html`.

Vite (modern tooling):
- `bun run dev:vite:full` then open `http://localhost:5173/` (modern default redirect)
  - Explicit entries: `http://localhost:5173/client/modern.html` (ESM), `http://localhost:5173/client/index.html` (legacy)
  - Legacy default override: `BQ_VITE_DEFAULT_ENTRY=legacy bun run dev:vite:full`
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
- `bun run build:vite:legacy` builds modern + legacy Vite entries (explicit opt-in).
- `bun run build:client` builds the legacy RequireJS client bundle (`client-build/`).

Verification gates:
- `bun run verify:modern` runs lint + format check + tests + modern Vite build.
- `bun run typecheck` runs incremental TypeScript checks for selected tests/tooling plus runtime-adjacent JS modules (`tsconfig.typecheck.json` + `tsconfig.typecheck-runtime.json`).
- `bun run check:deps:drift` reports direct dependency drift (`npm outdated --depth=0`).
  - Node22 policy variant: `bun run check:deps:drift:node22`.
- `bun run check:class-fanout` guards accidental new `server/js/lib/class.js` dependencies during native-class migration.
- `bun run check:package-mode-boundaries` guards ESM package-mode assumptions (`"type": "module"` + legacy `bin/r.cjs` boundary wiring).
- `bun run check:legacy-optimizer-integrity` guards vendored legacy optimizer/wrapper/config integrity and expected `bin/r.js` version header.
- `bun run check:modern-jquery-free` enforces that modern ESM runtime (`client/js-esm/**/*.js`) stays jQuery-free.
- `bun run verify:legacy` runs tests + legacy RequireJS build + legacy-inclusive Vite build.
- `bun run test:modern-browser:install` (one-time) then `bun run test:browser:modern` runs a headless Playwright smoke against `client/modern.html`.
- `bun run test:browser:legacy` runs the legacy compatibility browser smoke against `client/index.html`.
- `bun run test:browser:legacy:hook-probe` is an opt-in legacy test-hook observability probe (`BQ_TEST_LEGACY_HOOK=1`) for deterministic-start API availability checks.
- `bun run test:browser:protocol` runs protocol-focused browser tests (`modern-protocol-actions` + `protocol-invariant`) for faster protocol triage loops.
- `bun run test:browser:protocol-invariant` replays deterministic `go`/`HELLO`/`WELCOME`/`CHAT` + `MOVE`/`ZONE` protocol flow plus invalid `MOVE` rejection behavior against both modern and legacy entry paths and asserts invariant parity.
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

Modernization snapshot
----------------------

- Live roadmap and ticket log: `MODERNIZE.md`
- Support matrix and verify commands: `docs/client-build-support.md`
- Dependency/runtime audit: `docs/dependency-modernization-audit.md`
- Legacy jQuery migration risk scan: `docs/legacy-jquery4-risk-scan.md`
- Modern ESM jQuery surface audit: `docs/modern-jquery-surface-audit.md`
- Server logging taxonomy: `docs/server-logging-taxonomy.md`
- Server CJS->ESM readiness inventory: `docs/server-cjs-esm-readiness-inventory.md`
- TypeScript runtime CheckJs defer list: `docs/typescript-runtime-checkjs-defer-list.md`
- Server `lib/class.js` fanout map: `docs/server-classjs-fanout-map.md`
- Server core class-migration plan: `docs/server-core-class-migration-plan.md`
- Package-mode migration checklist: `docs/package-mode-migration-checklist.md`
- Runtime CJS boundary inventory: `docs/runtime-cjs-boundary-inventory.md`
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
- CI gates: `verify-modern`, `verify-legacy`, `verify-modern-browser`, `verify-legacy-browser`, `verify-protocol-invariant`
  - Optional drift visibility workflow: `verify-dependency-drift`
  - Optional/manual healthy metrics workflow: `verify-metrics-healthy`
  - Trigger/triage guide: `docs/metrics-health-smoke-plan.md`
- Primary verification commands:
  - `bun run verify:modern` (or `bun run verify:modern:node22`)
  - `bun run verify:legacy` (or `bun run verify:legacy:node22`)
  - `bun run test:browser:modern` / `bun run test:browser:legacy` / `bun run test:browser:protocol` / `bun run test:browser:protocol-invariant`


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
