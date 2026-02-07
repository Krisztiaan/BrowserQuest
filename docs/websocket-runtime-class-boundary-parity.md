# Websocket Runtime Class-Boundary Parity

## Current runtime boundary state

- `server/js/ws.js` (CJS runtime): inline class assembly is kept for synchronous CommonJS startup compatibility.
- `server/js/ws-runtime-esm.mjs` (ESM runtime): class assembly is delegated to `createWebSocketRuntimeClasses(...)` in `server/js/ws-runtime-class-factory.mjs`.

## Intentional divergence

The CJS path remains inline until CJS runtime retirement or a dedicated CJS class-factory migration slice lands.  
The ESM path now uses an explicit class-factory seam for dependency injection and future migration flexibility.

Decision record: `docs/websocket-cjs-factory-migration-decision.md`

## Parity guardrail commands

- Scripted drill summary: `bun run test:ws:runtime:drill`
  - optional local summary file:
    - `BQ_WS_DRILL_SUMMARY_PATH=artifacts/ws-boundary-drill-summary.json bun run test:ws:runtime:drill`
- Focused parity: `bun run test:ws:runtime:parity`
- Decision contract: `bun run test:ws:runtime:decision`
- Full modern gate: `bun run verify:modern:node22`
- Full legacy gate: `bun run verify:legacy:node22`
