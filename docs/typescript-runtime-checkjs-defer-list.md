# TypeScript Runtime CheckJs Defer List (2026-02-07)

## Active runtime check scope

`tsconfig.typecheck-runtime.json` currently checks:

- `shared/js/gametypes.js`
- `shared/js/protocol-contract.js`
- `shared/js/ws-close-codes.js`
- `server/js/log.js`
- `server/js/format.js`
- `server/js/formulas.js`
- `server/js/utils.js`
- `server/js/entity.js`
- `server/js/item.js`
- `server/js/player.js`
- `server/js/mob.js`
- `server/js/mobarea.js`
- `server/js/npc.js`
- `server/js/area.js`
- `server/js/character.js`
- `server/js/checkpoint.js`
- `server/js/chest.js`
- `server/js/chestarea.js`
- `server/js/properties.js`
- `server/js/map.js`
- `server/js/message.js`
- `server/js/worldserver.js`
- `server/js/config-preflight.js`
- `server/js/ws.js`

These files were selected because they are runtime-adjacent and passed `allowJs` + `checkJs` without behavior changes.

## Deferred for later waves

- `server/js/main.js`
- `server/js/metrics.js`
- `server/js/metrics-runtime.js`
- `server/js/metrics-client.js`

## Next-candidate queue (post-wave-8C baseline)

1. Resolve metrics typing blockers before promoting `server/js/main.js`, `server/js/metrics.js`, `server/js/metrics-runtime.js`, and then `server/js/metrics-client.js`.

## Defer rationale

- Remaining gameplay/runtime files are deferred to keep promotion batches small and verification deterministic.
- Metrics/entrypoint files are deferred behind explicit blocker cleanup: optional `memcache` module typing and `Metrics` method-shape checks under CheckJs.

## Reopen criteria

- Runtime-adjacent scope remains stable across `verify:modern:node22` and `verify:legacy:node22`.
- Validate candidate modules with isolated `bun x tsc --allowJs --checkJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler <file>`.
- Add each module to `tsconfig.typecheck-runtime.json` only after local `bun run typecheck` is green.
