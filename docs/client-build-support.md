# Client Build Support Matrix

This project currently ships two client build paths while modernization is in progress.

## Runtime baseline

- Node.js `22.x` (policy target; CI-enforced)
- Bun `>= 1.3.0`
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
  - `bun run build:client` (RequireJS optimizer output in `client-build/`)
  - `bun run build:vite:legacy` (legacy-inclusive Vite bundle for migration verification)
- Local static dev legacy entry: `/index.html` (or set `BQ_CLIENT_DEFAULT_ENTRY=index.html` before `bun run dev`)
- Vite dev legacy default override: `BQ_VITE_DEFAULT_ENTRY=legacy bun run dev:vite:full`
- Target: migration fallback only; no new feature work should start here unless required for parity/bugfixes

## Build/verification gates

- Modern gate: `bun run verify:modern`
  - Runs `check:modern-jquery-free` (all `client/js-esm/**/*.js`), `lint`, `format:check`, `test`, and `build:vite`
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
- Structured server log smoke:
  - Lifecycle-only: `bun run test:logs:lifecycle`
  - Fatal taxonomy-only: `bun run test:logs:fatal`
  - Optional healthy metrics path: `bun run test:metrics:healthy` (runs `check:metrics:healthy-prereqs` before executing the env-gated smoke)
  - Shared harness: `tests/smoke/server-structured-logs.harness.ts`
- Legacy gate: `bun run verify:legacy`
  - Runs `test`, `build:client`, and `build:vite:legacy`

## CI mapping

- `verify-modern` workflow:
  - Runs `verify:modern` on all push/PR events.
- `verify-legacy` workflow:
  - Runs `verify:legacy` on legacy/build-sensitive path changes.
- `verify-modern-browser` workflow:
  - Runs `test:browser:modern` on browser/runtime-sensitive path changes.
- `verify-legacy-browser` workflow:
  - Runs `test:browser:legacy` on legacy/browser-sensitive path changes.
- `verify-metrics-healthy` workflow:
  - Manual/optional (`workflow_dispatch`) job that provisions memcached and runs `test:metrics:healthy`.
  - Run/triage guide: `docs/metrics-health-smoke-plan.md`
- Local parity for the legacy browser CI gate:
  - `bun run test:browser:legacy:node22`

## Change policy

- New features and refactors must target the modern ESM path first.
- Legacy path changes should be minimal, behavior-preserving, and motivated by compatibility.
- Any change touching client boot/build behavior should run both verification gates before merge.
