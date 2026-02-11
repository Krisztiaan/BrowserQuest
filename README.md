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

If your shell Node is not `22.x`, use wrapper commands, e.g. `bun run verify:modern:node22`.

Active Scripts
--------------

- `bun run dev`: full-stack dev (`server/js/main-esm.ts` + Vite)
- `bun run dev:client`: Vite-only dev server
- `bun run dev:server`: server-only runtime
- `bun run start:server`: production-style server entry
- `bun run build:vite`: production client build to `dist/vite`
- `bun run build:server`: runtime server artifact to `dist/server`
- `bun run build:bundle`: deployable bundle artifact to `dist/bundle`
- `bun run typecheck`: TypeScript solution build (`tsc -b tsconfig.json`)
- `bun run verify:modern`: canonical modern verify lane
- `bun run verify:modern:node22`: Node22 policy wrapper for verify lane
- `bun run check:browser:workflow-drift`: guard browser CI command/config drift

Verification
------------

`verify:modern` runs:

- runtime/tooling checks (`check:*` modern lane)
- TypeScript solution build
- lint + format check
- test suite
- Vite production build

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

- `lint` currently targets `tests/**/*.ts` and `client/js-esm/**/*.ts`.
- `format`/`format:check` currently target:
  - `server/js/{log.ts,utils.ts,format.ts}`
  - `client/js-esm/compat/*.ts`
  - `client/js-esm/preflight.ts`
  - `shared/js/gametypes-browser.ts`
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
