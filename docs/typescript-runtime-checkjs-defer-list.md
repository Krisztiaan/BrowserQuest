# TypeScript Runtime CheckJs Defer List (2026-02-07)

## Active runtime check scope

`tsconfig.typecheck-runtime.json` currently checks:

- `shared/js/gametypes.js`
- `shared/js/protocol-contract.js`
- `shared/js/ws-close-codes.js`
- `server/js/log.js`
- `server/js/format.js`
- `server/js/utils.js`
- `server/js/entity.js`
- `server/js/config-preflight.js`
- `server/js/ws.js`

These files were selected because they are runtime-adjacent and passed `allowJs` + `checkJs` without behavior changes.

## Deferred for later waves

- `server/js/player.js`
- `server/js/item.js`
- `server/js/worldserver.js`
- `server/js/map.js`

## Defer rationale

- High-churn gameplay surfaces still rely on dynamic runtime fields and legacy class patterns that create noisy `checkJs` property-shape errors.
- Expanding checks there now would require broader JSDoc/property-model refactors and would slow migration throughput.

## Reopen criteria

- Runtime-adjacent scope remains stable across `verify:modern:node22` and `verify:legacy:node22`.
- Introduce focused property-shape cleanup for one deferred module at a time.
- Add each module to `tsconfig.typecheck-runtime.json` only after local `bun run typecheck` is green.
