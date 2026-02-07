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
