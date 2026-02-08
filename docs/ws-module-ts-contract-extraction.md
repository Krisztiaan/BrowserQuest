# Websocket Module TS Contract Extraction (T-327)

Date: 2026-02-08

## Objective

Extract TypeScript-first contracts for `server/js/ws.js` module boundaries and exported runtime seam without runtime behavior changes.

## Extracted artifacts

- Contract module: `server/js/ws-module-types.ts`
- Contract test: `tests/unit/ws-module-contract.test.ts`

## Captured boundaries

### Runtime dependencies

- `url`
- `http`
- `./log`
- `./utils`
- `../../shared/js/protocol-contract`
- `../../shared/js/ws-close-codes`
- `ws`
- `./ws-runtime-class-factory.cjs`

### Export seam keys

- `CLOSE_CODES`
- `createWebSocketRuntimeClasses`
- `MultiVersionWebsocketServer`
- `wsWebSocketConnection`

## Verification

1. `bun run typecheck`
2. `bun run verify:modern:node22`
3. `bun run verify:legacy:node22`
