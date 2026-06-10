# Map Layer Contract

The Tiled world map uses recursive layer paths as the authored contract. A path is the slash-joined group hierarchy plus the leaf layer name, for example:

```text
render_world/beach_biome/sand
gameplay_markup/doors
```

`tools/content/world-map-validator.ts` reports `UNKNOWN_LAYER_PATH` for any path that is not accepted by `shared/maps/layer-contract.ts`.

## Canonical Targets

New map work should move toward these stable top-level contracts:

```text
render_world/terrain
render_world/water
render_world/roads
render_world/floors
render_world/walls
render_world/structures
render_world/props
render_world/foreground
collision
gameplay_markup
```

The current world still has biome-era render paths such as `render_world/beach_biome/sand` and `render_world/forest_region/forest_trees`. Those non-debt paths are listed explicitly in `CURRENT_CANONICAL_LAYER_PATHS` so new accidental names fail validation instead of becoming implicit API.

## Gameplay Markup

Gameplay object layers live under `gameplay_markup`. Current paths include:

```text
gameplay_markup/resource_nodes
gameplay_markup/static_entities
gameplay_markup/chest_spawns
gameplay_markup/chest_areas
gameplay_markup/doors
gameplay_markup/roaming_areas
gameplay_markup/music_zones
gameplay_markup/checkpoints
```

## Legacy Allowlist

These paths are accepted only as visible migration debt:

```text
render_world/village_biome/village_boundaries_level_2
render_world/deadlands_biome/dry_ground_2
render_world/badlands_biome/cliffs_2
render_world/foreground_overlays
render_world/foreground_overlays/cliffs_foreground
render_world/foreground_overlays/cave_walls_foreground
render_world/foreground_overlays/indoor_doors_foreground
render_world/foreground_overlays/bridge_shadows_foreground
render_world/foreground_overlays/maze_walls_foreground
```

Do not add new layers to this list unless they are already present content being migrated. New render layers should use the canonical targets above.
