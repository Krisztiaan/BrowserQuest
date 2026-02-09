# Runtime Boundary Inventory (Modern)

Status date: 2026-02-09

## Current state

No active CJS runtime boundary remains in supported server startup/runtime lanes.

Active runtime paths:

- Startup entry: `server/js/main-esm.ts`
- Runtime core: `server/js/main-runtime.cts`
- WebSocket runtime: `server/js/ws-runtime-esm.ts`
- Shared websocket class factory seam: `server/js/ws-runtime-class-factory.ts`

## Supported verification

- `bun run typecheck`
- `bun run test:ws:runtime:decision`
- `bun run test:ws:runtime:parity`
- `bun run test:ws:runtime:drill`
- `bun run verify:modern:node22`

## Historical note

Previous CJS-boundary migration records are retained in historical tickets and `MODERNIZE.md`.
They are not active operational guidance.
