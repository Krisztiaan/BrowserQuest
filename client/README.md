BrowserQuest client documentation
=================================

Local development
-----------------

From the project root:

- `bun install`
- `bun run dev`
- Open `http://localhost:8123/client/modern.html`

Vite (modern tooling):

- `bun run dev:vite:full`
- Open `http://localhost:8123/client/modern.html`

Build and verification
----------------------

- Production client build: `bun run build:vite` (output: `dist/vite`)
- Full modern verify lane: `bun run verify:modern`

Support policy
--------------

- Only modern ESM client entry is supported (`client/modern.html`).
- Legacy AMD/RequireJS build flow has been removed.
- Active support matrix: `docs/client-build-support.md`.
