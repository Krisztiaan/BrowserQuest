BrowserQuest
============

BrowserQuest is a modernized HTML5 multiplayer game runtime on Bun.

The current product target is a casual co-op friend-server RPG for 16-64 concurrent players per world, not a 2000-player MMO shard. See `docs/product-target.md`.

Runtime Requirements
--------------------

- Node.js `22.x` (see `.nvmrc`)
- Bun `>= 1.3.0`
- Package mode: `"type": "module"`

Quickstart
----------

1. Install dependencies: `bun install`
2. Start full-stack dev: `bun run dev`
3. Open `http://localhost:8000/`

Documentation starts at `docs/README.md`. Historical audits are archived under `docs/archive/` and should be treated as evidence, not current implementation instructions.

Before starting a new implementation slice, run `bun run check:clean-base-state` after the Phase 0A cleanup lands. It verifies that active scripts, docs, archived audits, external audit evidence, and generated artifact policy are in a known state.

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
- `bun run check:clean-base-state`: pre-work hygiene gate for active scripts, docs, archived audits, external audit evidence, and generated artifact policy
- `bun run verify:modern`: canonical modern verify lane
- `bun run content:prefabs:generate`: regenerate prefab artifact from canonical content
- `bun run check:content:prefabs`: verify generated prefab artifact is up to date

Client build tooling intentionally stays on the current Bun-based pipeline for now. See `docs/client-build-decision.md`.

Script Lanes
------------

- `check:*`: read-only content or project checks.
- `audit:*`: read-only inventory and review reports that usually write artifacts under `artifacts/`.
- `repair:*`: write-capable maintenance scripts. Prefer dry-run variants when available.
- `legacy:*`: preserved migration or historical scripts. Do not use for new work unless the current plan explicitly says to.
- `verify:*`: aggregate release gates; these must not call `legacy:*` scripts.
Verification
------------

`verify:modern` runs:

- generated-content drift checks
- TypeScript solution build
- lint + format check
- test suite
- Bun production client + server builds

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

`lint` (error-only via `eslint --quiet`) runs full TypeScript coverage:

- `client/**/*.ts`
- `server/**/*.ts`
- `shared/**/*.ts`
- `tests/**/*.ts`
- `lint:authority` remains available as a focused lane for authority-critical modules.
- `lint:client-runtime` remains available for quick runtime-only checks.
- `format`/`format:check` currently target:
  - `server/{log.ts,utils.ts,format.ts}`
  - `client/platform/*.ts`
  - `client/preflight.ts`
  - `shared/gametypes-browser.ts`

Runtime map loading now consumes Tiled source JSON directly:

- Client runtime loads `assets/maps/tiled/world.json` and transforms it in-browser.
- Server runtime loads `assets/maps/tiled/world.json` and transforms it on load.
There is no legacy/rollback support path in active scripts.

Modernization Tracking
----------------------

- Backlog + execution log: `TODO.md`

Server Config Knobs (Local/VPS)
-------------------------------

`server/config_local.json-dist` includes the common knobs; runtime config is loaded from `server/config.json` (default) and overridden by `server/config_local.json` (or a custom path passed to `bun server/entry.ts <configPath>`).

- `nb_players_per_world` (default `64`): practical friend-server world capacity target. Larger explicit values remain valid for load experiments.
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
Historical migration/runbook docs are archived under `docs/archive/`.

License
-------

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
See `LICENSE` for details.

Credits
-------

Created by [Little Workshop](http://www.littleworkshop.fr):

- Franck Lecollinet - [@whatthefranck](http://twitter.com/whatthefranck)
- Guillaume Lecollinet - [@glecollinet](http://twitter.com/glecollinet)
