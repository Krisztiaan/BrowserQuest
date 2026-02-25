# Map Transition Rollout Plan (Ticket 653)

This runbook defines the production rollout sequence for multi-map interiors and the transition safety budget.

## Scope

- Roll out map transitions in incremental slices (one interior pair first, then batches).
- Require build-time map-pack checks before deploy.
- Gate progression on transition telemetry and repeat-crossing stability tests.

## Rollout slices

### Slice 0: Preflight-only

- Keep current content.
- Ensure `assets/maps/runtime/map-pack.json` is generated and fresh.
- Verify telemetry capture pipeline for `world.map.transition.*` events.

Commands:
- `bun run build:maps`
- `bun run check:maps`
- `bun run verify:modern`

### Slice 1: First interior pair

- Move one interior/room to a dedicated map file in `assets/maps/tiled/`.
- Wire door links with `target_map` + `target_door`.
- Update `assets/maps/tiled/map-pack.config.json` with the new map entry.

Gate:
- `tests/unit/mmo/server-map-transition.test.ts` passes (includes repeated threshold crossing).
- No sustained increase in transition rejects beyond budget.

### Slice 2+: Batched migrations

- Migrate additional interiors in small batches.
- Run the same gate per batch.
- Stop batch progression if any error budget threshold is exceeded.

## Error budget and alert thresholds

Use structured logs from `docs/server-logging-taxonomy.md`.

- **Commit ratio**: `commits / attempts >= 99.5%` over 15m rolling window.
- **Invalid destination rejects** (`reason=invalid_destination`): `< 0.2%` of attempts over 15m.
- **Destination occupied rejects** (`reason=destination_occupied`): `< 0.5%` of attempts over 15m.
- **Player missing rejects** (`reason=player_missing`): absolute count `0`; alert immediately on first event.
- **Client stuck-loading incidents**: `0` tolerated for rollout slice promotion; any incident blocks next slice.

## Rollback contract

If any threshold is breached:

1. Freeze new map migrations.
2. Revert `assets/maps/tiled/map-pack.config.json` to last known-good slice.
3. Rebuild runtime assets (`bun run build:maps`) and redeploy.
4. Re-run:
   - `bun run check:maps`
   - `bun test --timeout 20000 tests/unit/mmo/server-map-transition.test.ts`
5. Resume only after thresholds recover in steady-state.

## Verification checklist per deploy

- `bun run check:maps`
- `bun test --timeout 20000 tests/unit/mmo/server-map-transition.test.ts tests/unit/mmo/server-map-registry.test.ts`
- `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts`
- `bun run verify:modern`
