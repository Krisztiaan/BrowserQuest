BrowserQuest server documentation
=================================

The game server runtime baseline is Node.js `22.x` (recommended) or Bun `>= 1.3.0`.

Dependencies are managed at the repository root via Bun:

- Install: `bun install`
- Run: `bun run start:server` (or `bun server/js/main.js`)


Configuration
-------------

The server settings (number of worlds, number of players per world, etc.) can be configured.
Copy `config_local.json-dist` to a new `config_local.json` file, then edit it. The server will override default settings with this file.
The distributed template already includes metrics-related keys so toggling `metrics_enabled` does not require guessing field names.

Metrics mode (`metrics_enabled`)
--------------------------------

Metrics are optional. If `metrics_enabled` is `false`, the server runs in local-only population mode.

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
  "nb_players_per_world": 200,
  "nb_worlds": 5,
  "map_filepath": "./server/maps/world_server.json",
  "metrics_enabled": false
}
```

Example (metrics enabled):

```json
{
  "port": 8000,
  "debug_level": "info",
  "nb_players_per_world": 200,
  "nb_worlds": 5,
  "map_filepath": "./server/maps/world_server.json",
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
- In both fallback cases, gameplay and handshake paths continue normally.
- Structured event taxonomy: `docs/server-logging-taxonomy.md`

Metrics dependency policy and troubleshooting:

1. Metrics are optional for local/default development and CI.
2. For metrics-enabled deployment, install runtime dependency and backend service:
   - package dependency: `bun add memcache`
   - memcached daemon reachable at `memcached_host:memcached_port`
3. If you see `server.metrics.unavailable`:
   - `reason: "invalid_config"`:
     - fix keys listed in `invalidFields`.
   - `reason: "init_failed"`:
     - verify `memcache` package is installed in deployment artifact.
     - verify memcached is running and reachable from the server host/network.
4. Optional healthy-path smoke strategy:
   - `docs/metrics-health-smoke-plan.md`
   - command: `bun run test:metrics:healthy` (runs prerequisites preflight + healthy smoke)
   - preflight only: `bun run check:metrics:healthy-prereqs`


Deployment
----------

In order to deploy the server, simply copy the `server` and `shared` directories to the staging/production server.

Then run `node server/js/main.js` in order to start the server.


Note: the `shared` directory is the only one in the project which is a server dependency.


Monitoring
----------

The server has a status URL which can be used as a health check or simply as a way to monitor player population.

Send a GET request to: `http://[host]:[port]/status`

It will return a JSON array containing the number of players in all instanced worlds on this game server.
