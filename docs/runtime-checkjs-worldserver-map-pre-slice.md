# Runtime CheckJs Wave 7 Pre-Slice (`worldserver.js` / `map.js`)

Status: executed via `T-233` to `T-235` on 2026-02-07; this document is retained as the pre-slice planning artifact.

## Goal

Define an executable, low-risk path to extend runtime CheckJs coverage from current gameplay pilots into `server/js/map.js` and then `server/js/worldserver.js`.

## Baseline commands

1. `bun run typecheck`
2. `bun x tsc --allowJs --checkJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler server/js/map.js`
3. `bun x tsc --allowJs --checkJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler server/js/worldserver.js`
4. `bun run verify:legacy:node22`

## Current findings

`server/js/map.js` currently passes isolated CheckJs.

`server/js/worldserver.js` currently surfaces dependent blockers:

- `server/js/worldserver.js:407`
  - `chest.setItems(...)` on value inferred as `Item` (needs explicit chest narrowing/typing).
- `server/js/worldserver.js:595-596`
  - `mob.area` shape assumptions depend on `Mob` property declarations.
- `server/js/mob.js:111-117`
  - `area` property not declared on `Mob` under CheckJs.

## Staged execution plan

1. Promote `map.js` first
- Add `server/js/map.js` to `tsconfig.typecheck-runtime.json`.
- Verify `bun run typecheck` + `bun run verify:legacy:node22`.

2. Unblock dependent property shapes
- Add explicit `area` initialization in `server/js/mob.js` constructor.
- Add explicit narrowing around `createChest(...)` / `setItems(...)` in `server/js/worldserver.js`.

3. Promote `worldserver.js`
- Add `server/js/worldserver.js` to `tsconfig.typecheck-runtime.json`.
- Re-run full gates (`typecheck`, `verify:legacy:node22`, browser protocol suite).

## Rollback guardrails

- If `worldserver.js` admission introduces non-trivial new type debt beyond the identified blockers:
  - keep `map.js` promoted,
  - defer `worldserver.js` back out of runtime scope,
  - log blockers in `MODERNIZE.md` before continuing.
