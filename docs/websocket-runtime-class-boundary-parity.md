# Websocket Runtime Class-Boundary Parity

## Current runtime boundary state

- `server/js/ws.js` (CJS runtime): inline class assembly is kept for synchronous CommonJS startup compatibility.
- `server/js/ws-runtime-esm.mjs` (ESM runtime): class assembly is delegated to `createWebSocketRuntimeClasses(...)` in `server/js/ws-runtime-class-factory.mjs`.

## Intentional divergence

The CJS path remains inline until CJS runtime retirement or a dedicated CJS class-factory migration slice lands.  
The ESM path now uses an explicit class-factory seam for dependency injection and future migration flexibility.

## Parity guardrail commands

- Focused parity: `bun run test:ws:runtime:parity`
- Full modern gate: `bun run verify:modern:node22`
- Full legacy gate: `bun run verify:legacy:node22`
