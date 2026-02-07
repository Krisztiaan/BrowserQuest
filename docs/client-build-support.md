# Client Build Support Matrix

This project currently ships two client build paths while modernization is in progress.

## Runtime baseline

- Node.js `22.x` (policy target; CI-enforced)
- Bun `>= 1.3.0`
- Package mode: `"type": "module"` (with explicit CJS boundary scripts where required)
- CI verify workflows pin Bun `1.3.8` for reproducibility.
- Runtime preflight command: `bun run check:runtime`
- Node 22 wrapper for mismatched shells: `bash tools/node22-run.sh <command ...>`
- Runbook: `docs/runtime-preflight.md`

## Support tiers

1. Primary (`Tier 1`): Modern ESM client
- Entry page: `client/modern.html`
- Build command: `bun run build:vite`
- Dev command: `bun run dev:vite:full` then open `/` (modern redirect) or `/client/modern.html`
- Local static dev (`bun run dev`): `/` resolves to modern entry by default.
- Target: current browsers with native ESM support

2. Compatibility (`Tier 2`): Legacy AMD/RequireJS client
- Entry page: `client/index.html`
- Build commands:
  - `bun run build:client` (RequireJS optimizer output in `client-build/`, invoked via `bin/r.cjs` compatibility runner)
  - `bun run build:vite:legacy` (legacy-inclusive Vite bundle for migration verification)
- Local static dev legacy entry: `/index.html` (or set `BQ_CLIENT_DEFAULT_ENTRY=index.html` before `bun run dev`)
- Vite dev legacy default override: `BQ_VITE_DEFAULT_ENTRY=legacy bun run dev:vite:full`
- Target: migration fallback only; no new feature work should start here unless required for parity/bugfixes

## Build/verification gates

- Server entrypoint options:
  - Default compatibility path: `bun run start:server` (`server/js/main.js`).
  - Opt-in ESM bridge path: `bun run start:server:esm` (`server/js/main-esm.mjs`).
  - Extracted ESM startup helper contracts:
    - `server/js/main-esm-bridge-probe.mjs` (bridge-probe decision contract)
    - `server/js/main-esm-runtime-options.mjs` (runtime-option decision contract)
  - Optional websocket startup-mode flags for ESM entry:
    - Bridge parity probe: `bun run start:server:esm:ws-bridge:probe` (emits `server.esm.ws_bridge_probe`).
    - ESM websocket runtime mode: `bun run start:server:esm:ws-runtime` (emits `server.esm.ws_runtime_mode`, `status=ok`).
    - Forced-failure diagnostics: `bun run start:server:esm:ws-runtime:fail` (emits `server.esm.ws_runtime_mode`, `status=failed`, then exits non-zero).
  - Helper-to-command mapping:
    - Bridge probe helper -> `start:server:esm:ws-bridge:probe`.
    - Runtime-options helper -> `start:server:esm:ws-runtime` and `start:server:esm:ws-runtime:fail`.
- Modern gate: `bun run verify:modern`
  - Runs `check:package-mode-boundaries`, `check:modern-jquery-free` (all `client/js-esm/**/*.js`), `lint`, `format:check`, `test`, and `build:vite`
- Incremental TypeScript gate: `bun run typecheck`
  - Runs `tsconfig.typecheck.json` (tests/tooling surface) plus `tsconfig.typecheck-runtime.json` (selected runtime-adjacent JS modules under `shared/js` and `server/js`).
- Dependency drift check: `bun run check:deps:drift`
  - Node22 policy variant: `bun run check:deps:drift:node22`
- Class fanout guard: `bun run check:class-fanout`
  - Fails only on newly introduced `server/js/lib/class.js` imports outside tracked allowlist.
- Legacy optimizer integrity guard: `bun run check:legacy-optimizer-integrity`
  - Verifies vendored optimizer/wrapper/config hashes and expected `bin/r.js` version header.
- Modern gameplay parity smoke: `bun run test:modern-parity`
  - Covers login, move, chat, zone, combat-path signaling, lootmove, and reconnect against a live server.
- Static dev entry smoke: `bun run test:static-entry`
  - Asserts `bun run dev` serves modern entry at `/` by default, keeps legacy at `/index.html`, and supports `BQ_CLIENT_DEFAULT_ENTRY=index.html` override.
- Modern browser UI smoke: `bun run test:browser:modern`
  - Headless Playwright smoke for `client/modern.html` that validates UI boot, websocket handshake, first playable session, in-game UI controls, and live protocol actions (`HELLO`/`CHAT`).
  - Browser protocol parity includes deterministic `MOVE`/`ZONE`, `ATTACK`/`HIT`/`LOOTMOVE`, plus reconnect (`go` + second `HELLO`/`WELCOME`) checks.
  - First-time local setup: `bun run test:modern-browser:install`
- Legacy browser UI smoke: `bun run test:browser:legacy`
  - Targeted Playwright smoke for `client/index.html` intro/event wiring (name input keyup -> play enablement and chatbar active toggle) to guard legacy compatibility changes.
- Protocol invariant replay guard: `bun run test:browser:protocol-invariant`
  - Replays deterministic `go` -> `HELLO` -> `WELCOME` -> `CHAT` -> `MOVE` -> `ZONE` protocol path plus invalid-`MOVE` rejection behavior in both `client/modern.html` and `client/index.html` and asserts invariant parity.
- Protocol-focused browser suite: `bun run test:browser:protocol`
  - Runs `tests/browser/modern-protocol-actions.playwright.ts` and `tests/browser/protocol-invariant.playwright.ts` without full browser-smoke breadth for faster protocol triage.
  - CI variant: `bun run test:browser:protocol:ci` (adds JUnit reporter output for artifact capture).
- Legacy deterministic-start test hook (test-only):
  - Legacy runtime now exposes `window.__BQ_LEGACY_TEST_API` only when `window.__BQ_LEGACY_TEST_MODE__` (or `window.__BQ_TEST_MODE__`) is enabled before boot.
  - Observability probe command: `bun run test:browser:legacy:hook-probe` (Node22 wrapper: `bun run test:browser:legacy:hook-probe:node22`).
  - Intended for future optional legacy protocol assertions once deterministic legacy-start controls are fully stabilized.
- Deferred optional legacy protocol smoke reopen criteria:
  - Keep protocol assertions opt-in; baseline legacy smoke (`test:browser:legacy`) remains intro wiring only.
  - Reopen only when deterministic-start evidence is stable:
    - `test:browser:legacy:hook-probe:node22` passes consistently across repeated local runs.
    - Hook probe confirms `startSession(...)` callability without timing retries outside bounded test polling.
    - Baseline guardrail `test:browser:legacy:node22` stays green in the same change set.
  - After criteria are met, add optional legacy protocol smoke behind explicit env gate and document its non-blocking CI posture.
- Structured server log smoke:
  - Lifecycle-only: `bun run test:logs:lifecycle`
  - Fatal taxonomy-only: `bun run test:logs:fatal`
  - Optional healthy metrics path: `bun run test:metrics:healthy` (runs `check:metrics:healthy-prereqs` before executing the env-gated smoke)
  - Shared harness: `tests/smoke/server-structured-logs.harness.ts`
  - ESM websocket runtime mode smoke:
    - `bun run test:smoke:esm:ws-runtime`
    - Covers success-mode handshake and forced-failure diagnostics for `BQ_ESM_WS_RUNTIME` flags.
  - Websocket boundary decision/parity checks:
    - `bun run test:ws:runtime:drill` (scripted summary runner)
    - `bun run test:ws:runtime:decision`
    - `bun run test:ws:runtime:parity`
    - `bun run check:ws:runbooks` (runbook backlink consistency check)
    - Decision record: `docs/websocket-cjs-factory-migration-decision.md`
- Legacy gate: `bun run verify:legacy`
  - Runs `check:package-mode-boundaries`, `check:legacy-optimizer-integrity`, `test`, `build:client`, and `build:vite:legacy`

## CI mapping

- `verify-modern` workflow:
  - Runs `verify:modern` on all push/PR events.
- `verify-legacy` workflow:
  - Runs `verify:legacy` on legacy/build-sensitive path changes.
- `verify-modern-browser` workflow:
  - Runs `test:browser:modern` on browser/runtime-sensitive path changes.
- `verify-legacy-browser` workflow:
  - Runs `test:browser:legacy` on legacy/browser-sensitive path changes.
- `verify-protocol-invariant` workflow:
  - Runs `test:browser:protocol:ci` on browser/runtime-sensitive path changes.
  - Supports manual execution via `workflow_dispatch` when validating suspected protocol regressions outside changed-path triggers.
  - Uploads protocol diagnostics artifacts (`test-results/**`, `playwright-report/**`) for easier failure triage.
  - Artifact naming pattern: `protocol-invariant-diagnostics-<run_id>`.
  - Triage path:
    - Open the workflow run -> `Artifacts` -> download `protocol-invariant-diagnostics-<run_id>`.
    - Check `test-results/protocol-invariant-junit.xml` first for failing test case and stack metadata.
    - Use `playwright-report/**` for detailed trace/report context when available.
- `verify-ws-boundary-drill` workflow:
  - Advisory websocket boundary drill workflow:
    - manual trigger (`workflow_dispatch`) for post-refactor validation,
    - automatic PR trigger on websocket boundary path changes.
  - Runs `bun run test:ws:runtime:drill`.
  - Uploads summary artifact:
    - `ws-boundary-drill-summary-<run_id>/artifacts/ws-boundary-drill-summary.json`
    - `ws-boundary-drill-summary-<run_id>/artifacts/ws-boundary-drill-summary.md`
  - Triage path:
    - Open workflow run -> `Artifacts` -> download `ws-boundary-drill-summary-<run_id>`.
    - Quick scan `artifacts/ws-boundary-drill-summary.md`, then use `artifacts/ws-boundary-drill-summary.json` for per-check detail.
    - On failures, read `failureSnapshot.failedCheckKeys` and `failureSnapshot.failedChecks[*].{exitCode,logTailHint}` first for escalation handoff.
    - If escalation is required, use `docs/websocket-boundary-escalation-template.md`.
  - Decision/owner policy source: `docs/websocket-cjs-factory-migration-decision.md`.
- `verify-dependency-drift` workflow:
  - Manual + weekly snapshot (`workflow_dispatch` and Monday cron) for direct dependency drift visibility.
  - Captures `npm outdated --depth=0` output as artifacts:
    - `dependency-drift-<run_id>/dependency-drift.txt`
    - `dependency-drift-<run_id>/dependency-drift.json`
  - Workflow always publishes the snapshot; dependency drift itself is reported in summary/artifacts, not treated as infra failure.
- `verify-metrics-healthy` workflow:
  - Manual/optional (`workflow_dispatch`) job that provisions memcached and runs `test:metrics:healthy`.
  - Run/triage guide: `docs/metrics-health-smoke-plan.md`
- Local parity for the legacy browser CI gate:
  - `bun run test:browser:legacy:node22`

## Change policy

- New features and refactors must target the modern ESM path first.
- Legacy path changes should be minimal, behavior-preserving, and motivated by compatibility.
- Any change touching client boot/build behavior should run both verification gates before merge.
