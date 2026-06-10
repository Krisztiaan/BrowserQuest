# Client Build Decision

The project keeps the current Bun-based client build for now.

This is an intentional modernization choice, not an accidental default. The active product work is still concentrated on runtime map consistency, door graph correctness, persistence, server authority, and browser coverage for the MVP friend-server gameplay loop. A build-tool migration does not directly reduce risk in those areas.

Vite remains a candidate for browser development ergonomics, HMR, and asset pipeline simplification. It is deferred until the map-pack, passability, persistence, and MVP gameplay loop are stable under `bun run verify:modern` and browser smoke coverage.

Existing build scripts remain unchanged:

- `bun run dev:bun:build-client`
- `bun run build:client`
- `bun run verify:modern`
