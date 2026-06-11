# Map Layer Contract

The Tiled map contract is now semantic first. A layer's path still matters while the world
map is being migrated, but the authored meaning must live in Tiled properties that can be
validated and reused by tools.

A recursive path is the slash-joined group hierarchy plus the leaf layer name, for example:

```text
render_world/beach_biome/sand
gameplay_markup/doors
```

`tools/content/world-map-validator.ts` reports `UNKNOWN_LAYER_PATH` for any path that is not
accepted by `shared/maps/layer-contract.ts`. It also requires every flattened target-profile
world layer to carry the semantic properties below.

## Semantic Properties

Every target layer/group must declare:

| Property | Tiled type | Meaning |
|---|---|---|
| `layer_role` | enum `LayerRole` | Render/gameplay role: `base`, `transition`, `hazard`, `decal`, `structure`, `object_depth`, `object_fixed`, `foreground`, `occluder`, `lighting`, `gameplay`, or `debug`. |
| `collision_source` | enum `CollisionSource` | Collision source: `none`, `tile`, `object`, or `explicit`. |
| `occlusion` | enum `OcclusionMode` | Occlusion behavior: `none`, `always_front`, `fade`, `cutaway`, or `hide`. |
| `material` | string | Material or asset family carried by the layer. |
| `biome` | string | Biome/visual context for audits and render-prop metadata. |
| `area_id` | string | Area ownership for review slices, selective audits, and future room/region tooling. |

The validator checks both enum values and Tiled `propertytype` metadata for the three enum
properties. A plain string value is not enough for target-profile authoring.

## Structural Rules

Semantic role also constrains the layer's shape:

| Role | Allowed layer shape | Visibility | Collision | Occlusion | Required class |
|---|---|---:|---|---|---|
| `base` | tile layer | visible | `tile` | `none` | |
| `transition` | tile layer | visible | `tile` | `none` | |
| `hazard` | tile layer | visible | `tile` | `none` | |
| `decal` | tile layer | visible | `none` | `none` | |
| `structure` | tile layer | visible | `tile` | `none` | |
| `object_depth` | object layer | visible | `object` | `none` | `DepthSorted` |
| `object_fixed` | tile or object layer | visible | `none`, `tile`, or `object` | `none` | |
| `foreground` | tile or object layer | visible | `none` | `always_front` | `Foreground` |
| `occluder` | tile or object layer | visible | `none`, `tile`, or `object` | `fade`, `cutaway`, or `hide` | |
| `lighting` | tile, object, or image layer | visible | `none` | `none` | |
| `gameplay` | object layer | hidden | `none` | `none` | |
| `debug` | tile, object, or image layer | hidden | `none` | `none` | |

These rules are intentionally stricter than the old path snapshot. For example, an authored
gameplay layer must be hidden and non-colliding even if its path is accepted, and a
depth-sorted prop layer must be a visible `DepthSorted` object layer.

## Phase Order

Flattened leaf layers must move forward through these broad phases:

1. Render body: `base`, `transition`, `hazard`, `decal`, `structure`, `object_depth`, `object_fixed`
2. Overlays: `foreground`, `occluder`, `lighting`
3. Markup: `gameplay`, `debug`

The validator does not currently require strict ordering inside the render body because the
legacy world still groups layers by biome and local visual composition. It does require that
foreground/overlay layers never appear before normal render layers, and that hidden gameplay
markup stays after renderable content.

## Canonical Targets

New map work should move toward these stable top-level paths:

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

The current world still has biome-era render paths such as `render_world/beach_biome/sand`
and `render_world/forest_region/forest_trees`. Those non-debt paths are listed explicitly in
`CURRENT_CANONICAL_LAYER_PATHS` so new accidental names fail validation instead of becoming
implicit API. These path checks are a migration guard, not the final source of meaning.

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
