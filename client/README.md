BrowserQuest client documentation
=================================

Local development
-----------------

From the project root:

- `bun install`
- `bun run dev`
- Open `http://localhost:8000/`

Staged-client refresh (manual):

- `bun run dev:bun:build-client`

Build and verification
----------------------

- Production client build: `bun run build:client` (output: `dist/client`)
- Full modern verify lane: `bun run verify:modern`

Support policy
--------------

- Only modern ESM client entry is supported (`/` canonical; `client/modern.html` compatibility redirect).
- Legacy AMD/RequireJS build flow has been removed.
- Active support matrix: `docs/client-build-support.md`.
