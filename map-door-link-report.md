# Door Link Consistency Report

## Scope
- Audit target relationship: `target_door` must reference an existing `door_id` in `target_map` (or same map when `target_map` is empty).
- Scan set: all tiled map JSON files under `assets/maps/tiled` that contain objectgroup layer `doors`.

## Method
- Collected, per map:
  - all `door_id` values from `doors` objects,
  - all references via `target_door` + `target_map`.
- Resolved each reference against known `door_id` set of the referenced map.

## Pre-Fix Findings (2026-02-26, before nearest-target curation)
- Maps with `doors`: `55`
- Total `door_id` values: `226`
- Total references (`target_door`): `211`
- Resolved: `206`
- Unresolved: `5`

### Unresolved References (pre-fix)
1. `world` object `101`: `door_id=world_portal_166_33` → `target_map=world`, `target_door=world_portal_160_35`
2. `world` object `102`: `door_id=world_portal_158_35` → `target_map=world`, `target_door=world_portal_150_32`
3. `world` object `103`: `door_id=world_portal_148_32` → `target_map=world`, `target_door=world_portal_158_29`
4. `world` object `104`: `door_id=world_portal_155_29` → `target_map=world`, `target_door=world_portal_142_31`
5. `world` object `105`: `door_id=world_portal_142_32` → `target_map=world`, `target_door=world_portal_166_34`

## Curation Applied
- Ran `bun tools/content/world-curate-portals.ts --map assets/maps/tiled/world.json --write`.
- For unresolved world portal references, reassigned `target_door` to nearest existing world portal by Manhattan distance from (`target_tx`,`target_ty`).
- Reassignments:
  - `world_portal_166_33` → `world_portal_158_35`
  - `world_portal_158_35` → `world_portal_148_32`
  - `world_portal_148_32` → `world_portal_155_29`
  - `world_portal_155_29` → `world_portal_142_32`
  - `world_portal_142_32` → `world_portal_166_33`

## Post-Fix Findings (2026-02-26T12:41:36.738Z)
- Maps with `doors`: `55`
- Total `door_id` values: `226`
- Total references (`target_door`): `211`
- Resolved: `211`
- Unresolved: `0`

## Validation
- `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` → `{"errors":0,"warns":0,"infos":0}`
- `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` → `{"errors":0,"warns":0,"infos":0}`
