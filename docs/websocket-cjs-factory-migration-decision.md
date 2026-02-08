# Websocket CJS Class-Factory Migration Decision (T-311)

Date: 2026-02-08

## Decision

Adopt a **single-source websocket class-factory seam** for both runtime modes.

- Source of truth: `server/js/ws-runtime-class-factory.cts`
- Generated runtime artifact: `server/js/ws-runtime-class-factory.cjs` (via `bun run build:ws-runtime-factory`)
- CJS runtime path (`server/js/ws.js`) now composes classes from this shared factory.
- ESM runtime path (`server/js/ws-runtime-class-factory.mjs` / `server/js/ws-esm.mjs`) now re-exports the same factory seam.

## Why this decision

1. `ws.js` and ESM runtime had near-duplicate class logic, increasing drift risk and review cost.
2. Shared factory ownership reduces parity break risk across close/error/payload paths.
3. Existing websocket parity tests already provide strong safety coverage for a convergence slice.

## Contract and ownership

- Canonical authored implementation: `server/js/ws-runtime-class-factory.cts`.
- Canonical runtime artifact: `server/js/ws-runtime-class-factory.cjs` (generated; do not edit directly).
- Runtime wrappers (`ws.js`, `ws-runtime-class-factory.mjs`, `ws-esm.mjs`) must stay thin dependency/wiring layers.
- Any websocket class-behavior change must land in the shared factory and pass parity gates.

Owner group: server-runtime maintainers.

## Source ownership workflow

1. Edit `server/js/ws-runtime-class-factory.cts`.
2. Regenerate runtime artifact:
   - `bun run build:ws-runtime-factory`
3. Validate artifact sync:
   - `bun run check:ws-runtime-factory-sync`
4. Run websocket parity checks and full modern gate before merge.

## Rollback notes

If websocket boundary changes regress handshake/protocol behavior:

1. Revert only websocket class-factory convergence commit(s).
2. Re-run:
   - `bun run test:ws:runtime:decision`
   - `bun run test:ws:runtime:parity`
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
3. Restore previous wrapper wiring while keeping protocol close-code/event contracts unchanged.

## Operator checklist

Run this checklist for websocket boundary-touching changes:

1. Confirm runtime-mode signals in logs:
   - `server.esm.ws_runtime_mode` reports expected `status=ok|failed`.
   - `server.esm.ws_bridge_probe` reports expected `status=ok|failed` when probe mode is enabled.
2. Run focused boundary contract checks:
   - `bun run test:ws:runtime:drill` (scripted drill summary runner)
   - `bun run test:ws:runtime:decision`
   - `bun run test:ws:runtime:parity`
   - `bun run check:ws:runbooks` (runbook backlink consistency check)
3. Run full gate checks:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`

## Owner handoff trigger

Escalate to server-runtime maintainers when any of the following occurs:

1. `test:ws:runtime:decision` fails.
2. websocket handshake/protocol smokes fail in either modern or legacy verification tracks.
3. ESM runtime signal events (`server.esm.ws_runtime_mode` / `server.esm.ws_bridge_probe`) are missing or inconsistent with requested startup mode.

CI/advisory trigger policy:

1. Run `.github/workflows/verify-ws-boundary-drill.yml` manually on demand (`workflow_dispatch`) after boundary-touching refactors.
2. Let PR path triggers run automatically when websocket boundary files change.
3. Owner group for interpreting/adopting outcomes: server-runtime maintainers.
4. CI drill summary artifact name pattern:
   - `ws-boundary-drill-summary-<run_id>` containing:
     - `artifacts/ws-boundary-drill-summary.json`
     - `artifacts/ws-boundary-drill-summary.md`
5. Escalation template:
   - `docs/websocket-boundary-escalation-template.md`.
