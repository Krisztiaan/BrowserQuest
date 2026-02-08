# Server CJS Hotspot Index (T-320/T-325)

Date: 2026-02-08

## Purpose

Provide a migration-order baseline for remaining server/shared CommonJS runtime edges after websocket and worldserver TS-source adoption slices.

## Measurement method

Command:

```bash
rg -n -o "module\\.exports|require\\(" server/js shared/js --glob "*.js" | awk -F: '{print $1}' | sort | uniq -c | sort -nr
```

Note:
- occurrence-based counting (`-o`) is required so transpiler formatting changes do not hide hotspot fanout.

Current total edge count: `114`

## Top hotspots (by edge count)

1. `server/js/worldserver.js` - 16
2. `server/js/player.js` - 10
3. `server/js/ws.js` - 9
4. `server/js/main-runtime.js` - 7
5. `server/js/character.js` - 7 (generated artifact; source-of-truth `server/js/character.cts`)
6. `server/js/mob.js` - 6 (generated artifact; source-of-truth `server/js/mob.cts`)
7. `server/js/mobarea.js` - 5 (generated artifact; source-of-truth `server/js/mobarea.cts`)
8. `server/js/map.js` - 5 (generated artifact; source-of-truth `server/js/map.cts`)
9. `server/js/metrics.js` - 4 (generated artifact; source-of-truth `server/js/metrics.cts`)
10. `server/js/metrics-runtime.js` - 4 (generated artifact; source-of-truth `server/js/metrics-runtime.cts`)
11. `server/js/chest.js` - 4 (generated artifact; source-of-truth `server/js/chest.cts`)
12. `server/js/properties.js` - 3 (generated artifact; source-of-truth `server/js/properties.cts`)
13. `server/js/main.js` - 3 (generated artifact; source-of-truth `server/js/main.cts`)
14. `server/js/entity.js` - 3 (generated artifact; source-of-truth `server/js/entity.cts`)
15. `server/js/utils.js` - 2 (generated artifact; source-of-truth `server/js/utils.cts`)
16. `server/js/npc.js` - 2 (generated artifact; source-of-truth `server/js/npc.cts`)
17. `server/js/message.js` - 2 (generated artifact; source-of-truth `server/js/message.cts`)
18. `server/js/item.js` - 2 (generated artifact; source-of-truth `server/js/item.cts`)
19. `server/js/formulas.js` - 2 (generated artifact; source-of-truth `server/js/formulas.cts`)
20. `server/js/format.js` - 2 (generated artifact; source-of-truth `server/js/format.cts`)
21. `server/js/chestarea.js` - 2 (generated artifact; source-of-truth `server/js/chestarea.cts`)
22. `server/js/checkpoint.js` - 2 (generated artifact; source-of-truth `server/js/checkpoint.cts`)
23. `server/js/area.js` - 2 (generated artifact; source-of-truth `server/js/area.cts`)

## Priority order for migration slices

### P0: startup and protocol boundaries

- `server/js/main-runtime.js`
- `server/js/ws.js`
- `server/js/player.js`
- `server/js/worldserver.cts`

Reason: highest startup/protocol blast radius and strongest leverage for future CJS->TS/ESM waves.
`server/js/worldserver.js` remains a generated runtime artifact; migration ownership is now at `server/js/worldserver.cts`.

### P1: shadow-source contract hardening

- `server/js/area.cts`
- `server/js/checkpoint.cts`
- `server/js/properties.cts`
- `server/js/entity.cts`

Reason: startup/config utility hardening is complete; next leverage is removing `@ts-nocheck` incrementally on low-risk gameplay/value seams while preserving behavior.

Recently completed generated-artifact coverage:

- `server/js/area.js` via `server/js/area.cts`
- `server/js/formulas.js` via `server/js/formulas.cts`
- `server/js/log.js` via `server/js/log.cts`
- `server/js/utils.js` via `server/js/utils.cts`
- `server/js/format.js` via `server/js/format.cts`
- `server/js/metrics-client.js` via `server/js/metrics-client.cts`
- `server/js/config-preflight.js` via `server/js/config-preflight.cts`
- `server/js/main.js` via `server/js/main.cts`

Recently completed `@ts-nocheck` retirement slices:

- `server/js/formulas.cts`
- `server/js/config-preflight.cts`
- `server/js/metrics-client.cts`
- `server/js/log.cts`
- `server/js/utils.cts`
- `server/js/format.cts`
- `server/js/main.cts`

### P2: metrics and shared contracts

- `server/js/metrics.js`
- `server/js/metrics-runtime.js`
- `shared/js/protocol-contract.js`
- `shared/js/gametypes.js`

Reason: lower immediate gameplay risk; keep stable while P0/P1 convergence lands.

## Owner map

- P0/P1: server-runtime maintainers.
- P2: server-runtime maintainers + protocol-contract owners.

## Verification baseline for each migration ticket

1. `bun run typecheck`
2. `bun run verify:modern:node22`
3. `bun run verify:legacy:node22`
4. `bun run test:browser:protocol:node22`
