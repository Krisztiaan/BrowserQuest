BrowserQuest
============

BrowserQuest is a modernized HTML5 multiplayer game runtime on Bun + Vite.

Runtime Requirements
--------------------

- Node.js `22.x` (see `.nvmrc`)
- Bun `>= 1.3.0`
- Package mode: `"type": "module"`

Quickstart
----------

1. Install dependencies: `bun install`
2. Start full-stack dev: `bun run dev`
3. Open `http://localhost:5173/` (redirects to `client/modern.html`)

Active Scripts
--------------

- `bun run dev`: full-stack dev (`server/entry.ts` + Vite)
- `bun run dev:client`: Vite-only dev server
- `bun run dev:server`: server-only runtime
- `bun run start:server`: production-style server entry
- `bun run build:vite`: production client build to `dist/vite`
- `bun run build:server`: runtime server artifact to `dist/server`
- `bun run build:bundle`: deployable bundle artifact to `dist/bundle`
- `bun run typecheck`: TypeScript solution build (`tsc -b tsconfig.json`)
- `bun run typecheck:tools`: Type-check tooling scripts (`tools/**/*.ts`)
- `bun run verify:modern`: canonical modern verify lane
- `bun run content:prefabs:generate`: regenerate prefab artifact from canonical content
- `bun run check:content:prefabs`: verify generated prefab artifact is up to date
Verification
------------

`verify:modern` runs:

- generated-content drift checks
- TypeScript solution build
- lint + format check
- test suite
- Vite production build

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
- `/healthz`: JSON liveness payload `{ "status": "ok" }`
- `/version`: JSON version payload `{ "version": "<value>" }`
  - Source: `BQ_VERSION` env, fallback `npm_package_version`, fallback `"dev"`
- Controlled shutdown signals:
  - `SIGTERM` and `SIGINT` trigger runtime cleanup before process exit (`0`)

Lint/Format Scope
-----------------

Current lint/format scope is intentionally bounded while legacy modules are incrementally modernized:

- `lint` currently targets an explicit modern-runtime allowlist in `package.json` (server/shared/client boundary-critical modules).
- `format`/`format:check` currently target:
  - `server/{log.ts,utils.ts,format.ts}`
  - `client/platform/*.ts`
  - `client/preflight.ts`
  - `shared/gametypes-browser.ts`
  - `tests/**/*.ts`

Unlisted runtime files are treated as explicit temporary exclusions and should be expanded via Ticket 9 follow-up slices, not ad-hoc.

Runtime map loading now consumes Tiled source JSON directly:

- Client runtime loads `assets/maps/tiled/world.json` and transforms it in-browser.
- Server runtime loads `assets/maps/tiled/world.json` and transforms it on load.
There is no legacy/rollback support path in active scripts.

Modernization Tracking
----------------------

- Backlog + execution log: `TODO.md`

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
