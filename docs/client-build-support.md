# Client Build Support Matrix

## Status (2026-02-08)

Modern-only mode is active.

- No legacy client/runtime support.
- No rollback CJS server entry support.
- Runtime map artifacts are synced by active modern lanes (Vite serve/build hooks + map export tooling).
- Vite build outputs are under `dist/**`.
- Generated runtime map artifacts are under `generated/maps/**` and are auto-synced in modern lanes.

## Runtime Baseline

- Node.js: `22.x`
- Bun: `>= 1.3.0`
- Package mode: `"type": "module"`

## Supported Entrypoints

- Client: `client/modern.html`
- Server: `bun run start:server` (`server/js/main-esm.ts`)
- Dev (full stack): `bun run dev`

`client/index.html` redirects to `client/modern.html`.

## Build and Verify

- Build client bundle: `bun run build:vite`
- TypeScript solution build: `bun run typecheck`
- Verify (canonical): `bun run verify:modern`
- Verify with Node22 policy wrapper: `bun run verify:modern:node22`

`verify:modern` runs:

- runtime/tooling guard checks (`check:*` modern lane)
- TypeScript solution build (`tsc -b tsconfig.projects.json`)
- lint/format/test
- Vite production build

## Notes

- Browser smoke and protocol tests remain modern-entry focused.
- Optional CI advisory workflow for websocket runtime seams: `verify-ws-runtime-drill`.
- Legacy verification/build commands are removed from active scripts.
