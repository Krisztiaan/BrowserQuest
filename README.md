BrowserQuest
============

BrowserQuest is a modernized HTML5 multiplayer game runtime on Bun.

Project Goal
------------

A casual co-op RPG server you can run for friends: roughly 16-64 concurrent players per server. This is explicitly NOT a 2000-player MMO; design and review decisions should target the small co-op scale.

Runtime Requirements
--------------------

- The server runtime is **Bun-only**: it uses `Bun.serve` for HTTP/WebSocket and `bun:sqlite` for persistence. Nothing production runs on Node.
- Node.js `>= 22` (see `.nvmrc`) is required only for tooling compatibility (editor/TS/ESLint toolchains); the `engines` field reflects this.
- Bun `>= 1.3.0`
- Package mode: `"type": "module"`

Quickstart
----------

1. Install dependencies: `bun install`
2. Start full-stack dev: `bun run dev`
3. Open `http://localhost:8000/`

Active Scripts
--------------

- `bun run dev`: full-stack dev (Bun runtime + staged client assets)
- `bun run dev:bun:build-client`: build staged client assets for Bun dev serving
- `bun run dev:bun:full`: Bun runtime with staged client assets
- `bun run dev:server`: server-only runtime
- `bun run start:server`: production-style server entry
- `bun run build:client`: production client build to `dist/client`
- `bun run build:server`: runtime server artifact to `dist/server`
- `bun run build:bundle`: deployable bundle artifact to `dist/bundle`
- `bun run typecheck`: TypeScript solution build (`tsc -b tsconfig.json`)
- `bun run typecheck:tools`: Type-check tooling scripts (`tools/**/*.ts`)
- `bun run verify`: full local gate (alias of `verify:modern`)
- `bun run content:prefabs:generate`: regenerate prefab artifact from canonical content
- `bun run check:content:prefabs`: verify generated prefab artifact is up to date
- `bun run build:maps`: compile the Tiled map sources to the runtime map pack
- `bun run check:maps`: verify the runtime map pack is up to date

Verification (Test Lanes)
-------------------------

`bun run verify` is the full local gate. It runs:

- content checks: prefab drift (`check:content:prefabs`), map-pack freshness (`check:maps`), tileset overlay audit (`check:tileset-overlays`), map validators (`check:world-map:target`, `check:world-typed-objects`)
- TypeScript solution build (`typecheck`)
- lint + format check (`lint`, `format:check`)
- unit + smoke tests (`test`, i.e. `bun test`)
- Bun production client + server builds (`build:client`, `build:server`)

Playwright browser tests are a **separate lane**, not part of `verify`:

- `bun run test:browser:modern` runs the browser suite (`playwright.config.ts`); CI runs it in its own workflow (`.github/workflows/verify-modern-browser.yml`).

Metrics tests are another optional lane:

- `bun run test:metrics:healthy` requires a memcached instance on `127.0.0.1:11211` (override via `BQ_TEST_METRICS_HOST`/`BQ_TEST_METRICS_PORT`) and sets `BQ_TEST_METRICS_HEALTH=1` to enable the optional test. Server-side metrics are optional (`metrics_enabled` is `false` by default; `memcached_host`/`memcached_port` knobs live in `server/config_local.json-dist`).

Content Canonicalization (Current)
----------------------------------

- Canonical mob balance source: `assets/content/mob-properties.json`
- Canonical item loot-message source: `assets/content/item-loot-messages.json`
- Generated prefab artifact: `shared/generated/prefabs.generated.ts`
- Workflow:
  - Edit canonical JSON
  - Run `bun run content:prefabs:generate`
  - Validate with `bun run check:content:prefabs` (enforced in `verify:modern`)

Plugins (Server)
----------------

Server config can optionally load trusted plugins:

- Config field: `"plugins": ["./server/plugins/sample-spawner.plugin.ts"]`
- Plugins are ESM modules; paths are resolved relative to the server process cwd.
- Plugin API version is enforced (`apiVersion: 1`).

Runtime Probes and Shutdown
---------------------------

- `/status`: JSON world population distribution (existing contract)
- `/healthz`: JSON readiness payload
  - returns `200` with `{ "status": "ok" }` after worlds are ready
  - returns `503` with `{ "status": "starting" }` while startup is still incomplete
- `/version`: JSON version payload `{ "version": "<value>" }`
  - Source: `BQ_VERSION` env, fallback `npm_package_version`, fallback `"dev"`
- Controlled shutdown signals:
  - `SIGTERM` and `SIGINT` trigger runtime cleanup before process exit (`0`)

Lint/Format Scope
-----------------

`lint` (zero-tolerance via `eslint --max-warnings=0`) runs full TypeScript coverage:

- `client/**/*.ts`
- `server/**/*.ts`
- `shared/**/*.ts`
- `tools/**/*.ts`
- `tests/**/*.ts`
- `lint:authority` remains available as a focused lane for authority-critical modules.
- `lint:client-runtime` remains available for quick runtime-only checks.
- `format`/`format:check` currently target:
  - `server/{log.ts,utils.ts,format.ts}`
  - `client/platform/*.ts`
  - `client/preflight.ts`
  - `shared/gametypes-browser.ts`

Map/Content Pipeline
--------------------

- Authored source of truth: `assets/maps/tiled/` (`world.json` + `tilesheet.wang.tsj`), edited in Tiled.
- Compiled runtime artifact: `assets/maps/runtime/map-pack.json`, generated by `bun run build:maps`; freshness is gated by `bun run check:maps` (part of `verify`).
- Door graph: doors are linked via `door_id`/`target_map`/`target_door` object properties; interiors that are not built yet are declared in `pending_target_maps` (`assets/maps/tiled/map-pack.config.json`), and edges to them are dropped at compile time.

Deployment Bundle
-----------------

`bun run build:bundle` is the intended ship path. It runs the client build, the server build, then `tools/build/bundle.ts`, which assembles `dist/bundle/`:

- server runtime payload at the bundle root: `server/`, `shared/`, `assets/`, `package.json`, `bun.lock`, `.nvmrc` (copied from `dist/server`)
- static client build under `client/` (copied from `dist/client`)
- `VERSION.json` manifest: package name/version, short git commit, build timestamp, and artifact paths (server entry `server/entry.ts`, server config `server/config.json`)

The bundle runs under Bun: from inside `dist/bundle/`, install deps with `bun install` and start with `bun server/entry.ts`.

Tools Layout
------------

- Durable tooling lives in `tools/build/` (client/server/bundle builds), `tools/admin/` (operator CLIs such as claims), `tools/bots/` (soak bots), `tools/bench/` (benchmarks), `tools/dev/` (dev-server helpers), `tools/metrics/` (metrics prereq checks), and `tools/shared/` (shared helpers).
- `tools/content/` mixes durable generators/validators (prefabs, map pack, audits wired into `verify`) with one-off content migration scripts (`*-migrate-*`, standardize/curate pipelines) kept for reference.

Auth Session Secret
-------------------

- The server signs session tokens with a secret that is generated on first run and persisted to `server/.data/auth-session-secret` (so restarts do not log everyone out).
- The `BQ_AUTH_SESSION_SECRET` env var overrides the persisted secret; `BQ_AUTH_SESSION_SECRET_FILE` overrides the secret file path.

Modernization Tracking
----------------------

- Backlog + execution log: `PLAN.md`

Server Config Knobs (Local/VPS)
-------------------------------

`server/config_local.json-dist` includes the common knobs; runtime config is loaded from `server/config.json` (default) and overridden by `server/config_local.json` (or a custom path passed to `bun server/entry.ts <configPath>`).

- `chunk_size` (default `32`): tile chunk size used for overlay persistence + chunk AOI streaming.
- Chunk overlays persistence:
  - `chunk_overlay_db_path` (default `./server/.data/chunk-overlays.{worldId}.sqlite`)
  - `chunk_overlay_flush_interval_ms` (default `10000`)
  - `chunk_overlay_flush_max_chunks` (default `64`)
  - `chunk_overlay_bootstrap_load_limit_chunks` (default `4096`)
- Claims persistence:
  - `claims_db_path` (default `./server/.data/claims.{worldId}.sqlite`)
- Chunk snapshot streaming caps:
  - `chunk_snapshot_payload_max_utf8_bytes` (default `65536`)
  - `chunk_snapshot_max_parts` (default `128`)

Pre-release Data Compatibility
------------------------------

- Current pre-release policy is strict cutover: no legacy localStorage or SQLite schema migration paths are executed at runtime.
- Upgrading between incompatible pre-release builds requires a fresh local browser storage and fresh server DB files (`player_db_path`, `claims_db_path`, `chunk_overlay_db_path`).

Claims Admin CLI
----------------

`admin:claims` is a small operator CLI that reads/writes the same SQLite claims database the server uses.

- List claims (defaults to `./server/.data/claims.<worldId>.sqlite`):
  - `bun run admin:claims -- list --world world1`
- Create a claim:
  - `bun run admin:claims -- create --world world1 --owner alice --x1 10 --y1 10 --x2 30 --y2 30`
- Delete a claim:
  - `bun run admin:claims -- delete --world world1 --id 1`
- If your server config overrides `claims_db_path`, pass the same path explicitly:
  - `bun run admin:claims -- list --db ./server/.data/claims.world1.sqlite`
- JSON output:
  - `bun run admin:claims -- list --world world1 --json`

Documentation
-------------

Documentation is in `client/`, `server/`, and `docs/`.
See `docs/README.md` for an index of the `docs/` directory (protocol specs, logging taxonomy, audits, rollout runbooks).

License
-------

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
See `LICENSE` for details.

Credits
-------

Created by [Little Workshop](http://www.littleworkshop.fr):

- Franck Lecollinet - [@whatthefranck](http://twitter.com/whatthefranck)
- Guillaume Lecollinet - [@glecollinet](http://twitter.com/glecollinet)
