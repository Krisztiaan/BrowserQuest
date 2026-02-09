# Server Logging Taxonomy

This document defines the structured event names and payload fields emitted by the server logger (`server/js/log.cts` / `server/js/log-esm.mjs`).

## Record envelope

All structured records include:

- `ts`: ISO timestamp
- `level`: `error` | `info` | `debug`
- `event`: event name string

## Event names and fields

### Server lifecycle (`server/js/main-runtime.cts` via `server/js/main-esm.mjs`)

- `server.start`
  - `port`
  - `worlds`
  - `worldCapacity`
  - `metricsEnabled`
- `server.connect.rejected`
  - `reason`
- `server.error`
  - `message`
- `server.config.invalid`
  - `errors` (array of `{ field, reason }` config preflight failures)
- `server.metrics.unavailable`
  - `reason` (`invalid_config` | `init_failed` | `connect_failed` | `read_failed` | `write_failed`)
  - `invalidFields` (for `invalid_config`)
  - `error` (for `init_failed`/`connect_failed`/`read_failed`/`write_failed`)
  - `operation` (for `read_failed`/`write_failed`)
  - `key` (for `read_failed`/`write_failed`, when available)
- `server.metrics.ready`
  - `memcachedHost`
  - `memcachedPort`
  - `serverName`
- `server.fatal.uncaught_exception`
  - `source` (`uncaughtException`)
  - `message`
  - `stack` (when available)
- `server.fatal.unhandled_rejection`
  - `source` (`unhandledRejection`)
  - `message`
  - `stack` (when available)

### WebSocket lifecycle (`server/js/ws-runtime-esm.mjs`)

- `ws.server.listen`
  - `port`
- `ws.server.error`
  - `error`
- `ws.connection.open`
  - `connectionId`
  - `remoteAddress`
- `ws.connection.closed`
  - `connectionId`
  - `remoteAddress`
- `ws.connection.close_request`
  - `connectionId`
  - `remoteAddress`
  - `reason`
- `ws.connection.error`
  - `connectionId`
  - `remoteAddress`
  - `error`

### World/player lifecycle (`server/js/worldserver.cts`)

- `world.player.join`
  - `worldId`
  - `playerId`
  - `playerName`
- `world.player.leave`
  - `worldId`
  - `playerId`
  - `playerName`

## Contract tests

- Lifecycle structured logs:
  - `bun run test:logs:lifecycle`
- Fatal taxonomy structured logs:
  - `bun run test:logs:fatal`
- Shared helper used by both suites:
  - `tests/smoke/server-structured-logs.harness.ts`
