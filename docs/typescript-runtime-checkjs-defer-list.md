# TypeScript Runtime CheckJs Defer List (2026-02-08)

## Active runtime check scope

### CJS runtime lane (`tsconfig.typecheck-runtime.json`)

- `server/js/ws-runtime-class-factory-types.ts`
- `server/js/main-runtime-types.ts`
- `server/js/worldserver-types.ts`
- `server/js/player-types.ts`
- `server/js/ws-module-types.ts`
- `server/js/ws-runtime-class-factory.cts`
- `shared/js/gametypes.js`
- `shared/js/protocol-contract.js`
- `shared/js/ws-close-codes.js`
- `server/js/log.cts`
- `server/js/log.js`
- `server/js/format.cts`
- `server/js/format.js`
- `server/js/formulas.cts`
- `server/js/formulas.js`
- `server/js/utils.cts`
- `server/js/utils.js`
- `server/js/main-runtime.cts`
- `server/js/main-runtime.js`
- `server/js/main.cts`
- `server/js/main.js`
- `server/js/metrics.cts`
- `server/js/metrics.js`
- `server/js/metrics-runtime.cts`
- `server/js/metrics-runtime.js`
- `server/js/metrics-client.cts`
- `server/js/metrics-client.js`
- `server/js/entity.cts`
- `server/js/entity.js`
- `server/js/item.cts`
- `server/js/item.js`
- `server/js/player.js`
- `server/js/mob.cts`
- `server/js/mob.js`
- `server/js/mobarea.cts`
- `server/js/mobarea.js`
- `server/js/npc.cts`
- `server/js/npc.js`
- `server/js/area.cts`
- `server/js/area.js`
- `server/js/character.cts`
- `server/js/character.js`
- `server/js/checkpoint.cts`
- `server/js/checkpoint.js`
- `server/js/chest.cts`
- `server/js/chest.js`
- `server/js/chestarea.cts`
- `server/js/chestarea.js`
- `server/js/properties.js`
- `server/js/properties.cts`
- `server/js/map.cts`
- `server/js/map.js`
- `server/js/message.cts`
- `server/js/message.js`
- `server/js/worldserver.cts`
- `server/js/worldserver.js`
- `server/js/player.cts`
- `server/js/config-preflight.cts`
- `server/js/config-preflight.js`
- `server/js/ws-runtime-class-factory.cjs`
- `server/js/ws.cts`
- `server/js/ws.js`

Note:
- `server/js/ws-runtime-class-factory.cts` is the authored source.
- `server/js/ws-runtime-class-factory.cjs` is generated runtime artifact (`bun run build:ws-runtime-factory`) and guarded by `bun run check:ws-runtime-factory-sync`.
- `server/js/worldserver.cts` is the authored source.
- `server/js/worldserver.js` is generated runtime artifact (`bun run build:worldserver`) and guarded by `bun run check:worldserver-sync`.
- `server/js/player.cts` is the authored source.
- `server/js/player.js` is generated runtime artifact (`bun run build:player`) and guarded by `bun run check:player-sync`.
- `server/js/mob.cts` is the authored source.
- `server/js/mob.js` is generated runtime artifact (`bun run build:mob`) and guarded by `bun run check:mob-sync`.
- `server/js/mobarea.cts` is the authored source.
- `server/js/mobarea.js` is generated runtime artifact (`bun run build:mobarea`) and guarded by `bun run check:mobarea-sync`.
- `server/js/map.cts` is the authored source.
- `server/js/map.js` is generated runtime artifact (`bun run build:map`) and guarded by `bun run check:map-sync`.
- `server/js/chest.cts` is the authored source.
- `server/js/chest.js` is generated runtime artifact (`bun run build:chest`) and guarded by `bun run check:chest-sync`.
- `server/js/properties.cts` is the authored source.
- `server/js/properties.js` is generated runtime artifact (`bun run build:properties`) and guarded by `bun run check:properties-sync`.
- `server/js/character.cts` is the authored source.
- `server/js/character.js` is generated runtime artifact (`bun run build:character`) and guarded by `bun run check:character-sync`.
- `server/js/main-runtime.cts` is the authored source.
- `server/js/main-runtime.js` is generated runtime artifact (`bun run build:main-runtime`) and guarded by `bun run check:main-runtime-sync`.
- `server/js/metrics.cts` is the authored source.
- `server/js/metrics.js` is generated runtime artifact (`bun run build:metrics`) and guarded by `bun run check:metrics-sync`.
- `server/js/ws.cts` is the authored source.
- `server/js/ws.js` is generated runtime artifact (`bun run build:ws-module`) and guarded by `bun run check:ws-module-sync`.
- `server/js/metrics-runtime.cts` is the authored source.
- `server/js/metrics-runtime.js` is generated runtime artifact (`bun run build:metrics-runtime`) and guarded by `bun run check:metrics-runtime-sync`.
- `server/js/entity.cts` is the authored source.
- `server/js/entity.js` is generated runtime artifact (`bun run build:entity`) and guarded by `bun run check:entity-sync`.
- `server/js/item.cts` is the authored source.
- `server/js/item.js` is generated runtime artifact (`bun run build:item`) and guarded by `bun run check:item-sync`.
- `server/js/npc.cts` is the authored source.
- `server/js/npc.js` is generated runtime artifact (`bun run build:npc`) and guarded by `bun run check:npc-sync`.
- `server/js/message.cts` is the authored source.
- `server/js/message.js` is generated runtime artifact (`bun run build:message`) and guarded by `bun run check:message-sync`.
- `server/js/chestarea.cts` is the authored source.
- `server/js/chestarea.js` is generated runtime artifact (`bun run build:chestarea`) and guarded by `bun run check:chestarea-sync`.
- `server/js/checkpoint.cts` is the authored source.
- `server/js/checkpoint.js` is generated runtime artifact (`bun run build:checkpoint`) and guarded by `bun run check:checkpoint-sync`.
- `server/js/area.cts` is the authored source.
- `server/js/area.js` is generated runtime artifact (`bun run build:area`) and guarded by `bun run check:area-sync`.
- `server/js/formulas.cts` is the authored source.
- `server/js/formulas.js` is generated runtime artifact (`bun run build:formulas`) and guarded by `bun run check:formulas-sync`.
- `server/js/log.cts` is the authored source.
- `server/js/log.js` is generated runtime artifact (`bun run build:log`) and guarded by `bun run check:log-sync`.
- `server/js/utils.cts` is the authored source.
- `server/js/utils.js` is generated runtime artifact (`bun run build:utils`) and guarded by `bun run check:utils-sync`.
- `server/js/format.cts` is the authored source.
- `server/js/format.js` is generated runtime artifact (`bun run build:format`) and guarded by `bun run check:format-sync`.
- `server/js/metrics-client.cts` is the authored source.
- `server/js/metrics-client.js` is generated runtime artifact (`bun run build:metrics-client`) and guarded by `bun run check:metrics-client-sync`.
- `server/js/config-preflight.cts` is the authored source.
- `server/js/config-preflight.js` is generated runtime artifact (`bun run build:config-preflight`) and guarded by `bun run check:config-preflight-sync`.
- `server/js/main.cts` is the authored source.
- `server/js/main.js` is generated runtime artifact (`bun run build:main`) and guarded by `bun run check:main-sync`.

### ESM bridge/runtime lane (`tsconfig.typecheck-server-esm.json`)

- `shared/js/gametypes-esm.mjs`
- `shared/js/protocol-contract-esm.mjs`
- `shared/js/ws-close-codes-esm.mjs`
- `server/js/utils-esm.mjs`
- `server/js/log-esm.mjs`
- `server/js/format-esm.mjs`
- `server/js/config-preflight-esm.mjs`
- `server/js/metrics-esm.mjs`
- `server/js/metrics-runtime-esm.mjs`
- `server/js/main-runtime-esm.mjs`
- `server/js/ws-runtime-class-factory.mjs`
- `server/js/ws-runtime-esm.mjs`
- `server/js/ws-esm.mjs`
- `server/js/main-esm-bridge-probe.mjs`
- `server/js/main-esm-runtime-options.mjs`
- `server/js/main-esm-config-source.mjs`
- `server/js/main-esm-preflight-failures.mjs`
- `server/js/main-esm-startup-runner.mjs`
- `server/js/main-esm-structured-event.mjs`
- `server/js/main-esm-boot-envelope.mjs`
- `server/js/main-esm.mjs`

## Deferred for later waves

- No currently deferred files in active server runtime/bridge lanes.

## Next-candidate queue

1. Remove remaining `@ts-nocheck` coverage from low-risk gameplay/value modules (`area`, `checkpoint`, `properties`, `entity`) and add explicit contracts.
2. Continue CJS-to-ESM convergence by shrinking default CJS startup dependencies after full shadow-source coverage.

## Reopen criteria

- Both runtime lanes remain green across `bun run typecheck`, `bun run verify:modern:node22`, and `bun run verify:legacy:node22`.
- Validate new runtime candidates with isolated `bun x tsc --allowJs --checkJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler <file>`.
- Add each new module to the correct lane (`tsconfig.typecheck-runtime.json` or `tsconfig.typecheck-server-esm.json`) only after local checkJs and verification gates pass.
