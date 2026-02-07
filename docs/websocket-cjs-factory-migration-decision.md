# Websocket CJS Class-Factory Migration Decision (T-274)

Date: 2026-02-08

## Decision

Do **not** migrate `server/js/ws.js` (CJS runtime) to the ESM class-factory seam yet.  
Keep CJS websocket runtime class assembly inline, and keep ESM websocket runtime on `createWebSocketRuntimeClasses(...)`.

## Why this decision

1. The default production/server boot path is still CJS-first (`server/js/main.js` -> `server/js/main-runtime.js` -> `server/js/ws.js`).
2. Current parity coverage already protects behavior-critical connection contracts across CJS and ESM runtimes.
3. Forcing CJS factory adoption now increases regression surface in the default path without unlocking immediate user-facing modernization value.

## Owner criteria to revisit this decision

The CJS class-factory migration should be re-opened only when at least one of the following is true:

1. Default server startup no longer depends on CJS `ws.js`.
2. Legacy runtime retirement gate has moved `verify:legacy` from required to advisory.
3. A dedicated CJS websocket migration slice is approved with explicit rollback owner and release window.

Owner group: server-runtime maintainers.

## Rollback notes

If any websocket runtime boundary changes regress handshake/protocol behavior:

1. Revert only the websocket boundary decision slice commit(s).
2. Re-run:
   - `bun run test:ws:runtime:decision`
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
3. Keep CJS inline runtime as the immediate fallback baseline.

## Operator checklist

Run this checklist for websocket boundary-touching changes:

1. Confirm runtime-mode signals in logs:
   - `server.esm.ws_runtime_mode` reports expected `status=ok|failed`.
   - `server.esm.ws_bridge_probe` reports expected `status=ok|failed` when probe mode is enabled.
2. Run focused boundary contract checks:
   - `bun run test:ws:runtime:decision`
   - `bun run test:ws:runtime:parity`
3. Run full gate checks:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`

## Owner handoff trigger

Escalate to server-runtime maintainers when any of the following occurs:

1. `test:ws:runtime:decision` fails.
2. websocket handshake/protocol smokes fail in either modern or legacy verification tracks.
3. ESM runtime signal events (`server.esm.ws_runtime_mode` / `server.esm.ws_bridge_probe`) are missing or inconsistent with requested startup mode.

## Rollback drill cadence

- Execute rollback drill quarterly, and after any websocket boundary refactor touching `server/js/ws.js`, `server/js/ws-runtime-esm.mjs`, or `server/js/ws-runtime-class-factory.mjs`.
- Drill command baseline:
  - `bun run test:ws:runtime:decision`
  - `bun run verify:modern:node22`
  - `bun run verify:legacy:node22`
