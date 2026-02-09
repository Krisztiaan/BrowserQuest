# TypeScript Runtime Lane Inventory (Modern)

Status date: 2026-02-09

## Runtime lane (`tsconfig.typecheck-runtime.json`)

This lane covers active server/shared TypeScript-authored runtime modules.

- Core runtime/types: `server/js/main-runtime.cts`, `server/js/main.cts`, `server/js/main-runtime-types.ts`
- WebSocket runtime seam: `server/js/ws-runtime-class-factory.cts`, `server/js/ws-runtime-class-factory-types.ts`
- Metrics/runtime adapters: `server/js/metrics.cts`, `server/js/metrics-runtime.cts`, `server/js/metrics-client.cts`, `server/js/metrics-adapters/*.cts`
- Server entity/world modules: `server/js/{worldserver,player,mob,mobarea,npc,entity,item,area,character,chest,chestarea,checkpoint,map,message,properties}.cts`
- Shared contracts: `shared/js/{gametypes,protocol-contract,ws-close-codes}.cts`, `shared/js/protocol-contract-types.ts`

## ESM lane (`tsconfig.typecheck-server-esm.json`)

This lane covers active ESM runtime/bridge helpers.

- Startup and envelope helpers: `server/js/main-esm*.mjs`
- Runtime ESM bridges: `server/js/{log,utils,format,config-preflight,ws-runtime-class-factory,ws-runtime}.mjs`
- Shared ESM contract bridges: `shared/js/*-esm.mjs`

## Deferred modules

No deferred files are tracked for active server runtime lanes.

## Verification

- `bun run typecheck`
- `bun run verify:modern:node22`
