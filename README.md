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
3. Open `http://localhost:5173/client/modern.html`

If your shell Node is not `22.x`, use wrapper commands, e.g. `bun run verify:modern:node22`.

Active Scripts
--------------

- `bun run dev`: full-stack dev (`server/js/main-esm.ts` + Vite)
- `bun run dev:client`: Vite-only dev server
- `bun run dev:server`: server-only runtime
- `bun run start:server`: production-style server entry
- `bun run build:vite`: production client build to `dist/vite`
- `bun run typecheck`: TypeScript solution build (`tsc -b tsconfig.projects.json`)
- `bun run verify:modern`: canonical modern verify lane
- `bun run verify:modern:node22`: Node22 policy wrapper for verify lane

Verification
------------

`verify:modern` runs:

- runtime/tooling checks (`check:*` modern lane)
- TypeScript solution build
- lint + format check
- test suite
- Vite production build

Map artifacts are synced automatically:

- at dev startup and on `tools/maps/tiled/world.json` changes (Vite serve plugin)
- at build start (`vite build` hook)

There is no legacy/rollback support path in active scripts.

Modernization Tracking
----------------------

- Live roadmap: `MODERNIZE.md`
- Status + ticket log: `docs/modernization-readiness-status.md`
- Support matrix: `docs/client-build-support.md`

Documentation
-------------

Documentation is in `client/`, `server/`, and `docs/`.

License
-------

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
See `LICENSE` for details.

Credits
-------

Created by [Little Workshop](http://www.littleworkshop.fr):

- Franck Lecollinet - [@whatthefranck](http://twitter.com/whatthefranck)
- Guillaume Lecollinet - [@glecollinet](http://twitter.com/glecollinet)
