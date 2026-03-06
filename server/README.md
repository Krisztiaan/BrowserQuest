BrowserQuest server documentation
=================================

The game server runtime baseline is Node.js `22.x` (recommended) or Bun `>= 1.3.0`.

Dependencies are managed at the repository root via Bun:

- Install: `bun install`
- Run: `bun run start:server` (or `bun server/entry.ts`)


Configuration
-------------

The server settings (number of worlds, number of players per world, etc.) can be configured.
Copy `config_local.json-dist` to a new `config_local.json` file, then edit it. The server will override default settings with this file.
The distributed template already includes metrics-related keys so toggling `metrics_enabled` does not require guessing field names.
Startup runs config preflight validation; invalid configs fail fast with structured event `server.config.invalid`.

Pre-release compatibility note: runtime persistence expects current schema only. Legacy DB schema migration is intentionally not performed in-process. For incompatible pre-release updates, start with fresh DB files.

Metrics mode (`metrics_enabled`)
--------------------------------

Metrics are optional. This project is self-contained and does not require any external metrics consumers.
World admission is always decided from local runtime world capacity (least-populated available world).
If `metrics_enabled` is `false`, metrics writes/reads are disabled and gameplay still runs normally.

If `metrics_enabled` is `true`, all fields below are required:

- `memcached_host` (non-empty string)
- `memcached_port` (positive integer)
- `server_name` (non-empty string)
- `game_servers` (non-empty array of `{ "name": "..." }`)

Example (metrics disabled, default-safe):

```json
{
  "port": 8000,
  "debug_level": "info",
  "nb_players_per_world": 2000,
  "nb_worlds": 1,
  "map_filepath": "./assets/maps/tiled/world.json",
  "metrics_enabled": false
}
```

Example (metrics enabled):

```json
{
  "port": 8000,
  "debug_level": "info",
  "nb_players_per_world": 2000,
  "nb_worlds": 1,
  "map_filepath": "./assets/maps/tiled/world.json",
  "metrics_enabled": true,
  "memcached_host": "127.0.0.1",
  "memcached_port": 11211,
  "server_name": "local",
  "game_servers": [{ "name": "local" }]
}
```

Fallback behavior:

- Invalid metrics config emits structured event `server.metrics.unavailable` with `reason: "invalid_config"` and `invalidFields`.
- Metrics adapter init failure emits structured event `server.metrics.unavailable` with `reason: "init_failed"` and `error`.
- Metrics connect/runtime failures emit structured event `server.metrics.unavailable` with:
  - `reason: "connect_failed"` or `reason: "read_failed"` or `reason: "write_failed"`
  - `error` (and `operation`/`key` for read/write failures)
- In both fallback cases, gameplay and handshake paths continue normally.
- No external `world_count_*` key is required for player admission.
- Structured event taxonomy: `docs/server-logging-taxonomy.md`

Metrics dependency policy and troubleshooting:

1. Metrics are optional for local/default development and CI.
2. For metrics-enabled deployment, install lockfile-managed runtime dependencies and backend service:
   - package dependency: `memcache` is committed in `package.json`/`bun.lock`; install with `bun install --frozen-lockfile`
   - memcached daemon reachable at `memcached_host:memcached_port`
3. If you see `server.metrics.unavailable`:
   - `reason: "invalid_config"`:
     - fix keys listed in `invalidFields`.
   - `reason: "init_failed"`:
      - verify `memcache` package is installed in deployment artifact.
      - verify memcached is running and reachable from the server host/network.
   - `reason: "connect_failed"`:
      - verify memcached daemon/network reachability and firewall rules.
      - verify host/port values match deployment topology.
   - `reason: "read_failed"` or `reason: "write_failed"`:
      - inspect `operation` and `key` fields for failing metric path.
      - verify memcached health/capacity and network stability under load.
4. Optional healthy-path smoke strategy:
   - `docs/archive/legacy/metrics-health-smoke-plan.md`
   - command: `bun run test:metrics:healthy` (runs prerequisites preflight + healthy smoke)
   - preflight only: `bun run check:metrics:healthy-prereqs`


Deployment
----------

Runtime source deploy (direct):

1. Copy `server/`, `shared/`, and `assets/` to the target host.
2. Start with `bun server/entry.ts server/config.json`.

Bundle deploy (recommended baseline):

1. From repo root: `bun run build:bundle`.
2. Deploy `dist/bundle/**`.
3. Start from bundle root with `bun server/entry.ts server/config.json`.

`assets/maps/tiled/world.json` is the default runtime map source via `map_filepath`. The server now compiles and serves the runtime map payload directly from authored Tiled data.
Generate/update it with `bun run build:maps`; validate freshness with `bun run check:maps`.
Multi-map rollout and transition error-budget runbook: `docs/map-transition-rollout.md`.
Structured event taxonomy (including map transition telemetry): `docs/server-logging-taxonomy.md`.


Monitoring
----------

The server has a status URL which can be used as a health check or simply as a way to monitor player population.

Send a GET request to: `http://[host]:[port]/status`

It will return a JSON array containing the number of players in all instanced worlds on this game server.

`/healthz` returns readiness state for the gameplay world:

- `200` with `{ "status": "ok" }` once worlds are ready
- `503` with `{ "status": "starting" }` while startup is still incomplete

WebSocket gameplay endpoint
---------------------------

Clients connect to the game server via WebSocket at: `ws(s)://[host]:[port]/ws`
