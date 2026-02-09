# WebSocket Factory TS Source Promotion Plan (Archived)

Original plan date: 2026-02-08  
Superseded state date: 2026-02-09

This plan is closed.

## Final state

- Websocket runtime is operated through modern ESM runtime paths.
- Legacy CJS artifact-promotion workflow is no longer active.
- Ongoing operational validation is via:
  - `bun run test:ws:runtime:drill`
  - `bun run test:ws:runtime:decision`
  - `bun run test:ws:runtime:parity`
  - `bun run verify:modern:node22`

For current operational guidance, use `docs/websocket-runtime-class-boundary-parity.md`.
