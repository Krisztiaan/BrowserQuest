# Worldserver TS Shadow-Source Pre-Slice (T-322/T-323)

Date: 2026-02-08

Status:

- Pre-slice inventory complete (`T-322`)
- Phase-1 shadow-source execution complete (`T-323`)

## Objective

Define and execute a low-risk pre-slice for future `server/js/worldserver.js` TypeScript shadow-source promotion by freezing:

- dependency boundaries consumed by `worldserver.js`
- constructor-initialized mutable field inventory
- callback-hook field inventory set by runtime registration methods

No runtime behavior changes are introduced in this slice.

## Executed artifacts

- Typed inventory module: `server/js/worldserver-types.ts`
- Inventory contract test: `tests/unit/worldserver-shadow-source-pre-slice.test.ts`
- Authored shadow source: `server/js/worldserver.cts`
- Generated runtime artifact: `server/js/worldserver.js`
- Sync tooling: `tools/sync-worldserver.cjs`
- Build config: `tsconfig.build-worldserver.json`

The inventory module exports:

- `WORLDSERVER_RUNTIME_DEPENDENCY_BOUNDARIES`
- `WORLDSERVER_CONSTRUCTOR_FIELDS`
- `WORLDSERVER_CALLBACK_FIELDS`
- `WORLDSERVER_SHADOW_SOURCE_PRE_SLICE`

## Current boundary inventory

### Runtime dependency boundaries (`require(...)`)

1. `./entity`
2. `./character`
3. `./log`
4. `./mob`
5. `./map`
6. `./npc`
7. `./player`
8. `./item`
9. `./mobarea`
10. `./chestarea`
11. `./chest`
12. `./message`
13. `./properties`
14. `./utils`
15. `../../shared/js/gametypes`

### Constructor field inventory (`this.*` initialization)

- `id`
- `maxPlayers`
- `server`
- `ups`
- `map`
- `entities`
- `players`
- `mobs`
- `attackers`
- `items`
- `equipping`
- `hurt`
- `npcs`
- `mobAreas`
- `chestAreas`
- `groups`
- `outgoingQueues`
- `itemCount`
- `playerCount`
- `zoneGroupsReady`

### Callback field inventory

- `init_callback`
- `connect_callback`
- `enter_callback`
- `added_callback`
- `removed_callback`
- `regen_callback`
- `attack_callback`

## TS shadow-source staged checklist

1. Keep `server/js/worldserver.cts` as source-of-truth and regenerate artifact after changes:
   - `bun run build:worldserver`
   - `bun run check:worldserver-sync`
2. Keep CJS runtime as default consumer until full startup boundary migration is complete.
3. After startup boundary migration, reassess whether generated `worldserver.js` artifact can be retired.

## Known blockers/risks for promotion

- Large mutable world state surface (`entities`/`groups`/`queues`) can introduce high annotation churn if migrated in one pass.
- Entity subtype narrowing (`Player`, `Mob`, `Item`, `Chest`) is callback-heavy and currently relies on runtime `instanceof` checks.
- Startup/runtime dependencies (`main-runtime` -> `worldserver`) remain CJS-first and must stay synchronous.

## Verification commands for this pre-slice

1. `bun run typecheck`
2. `bun run verify:modern:node22`
3. `bun run verify:legacy:node22`
4. `bun run test:browser:protocol:node22`
