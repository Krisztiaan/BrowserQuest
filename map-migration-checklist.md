# World Map Migration Checklist

## Scope
- Input map: `assets/maps/tiled/world.json`
- Goal: migrate from legacy mixed semantics to a strict, layer-contract model.
- Constraint: no exporter assumptions; migration validity is enforced by `tools/content/world-map-validator.ts`.

## Migration Tickets

### Ticket 1 — Naming + Layer Contract
- Normalize all layer names to lowercase snake_case.
- Remove sentinel/duplicate-authority layers.
- Keep a single canonical layer order.

### Ticket 2 — Metadata Model Cleanup
- Convert sparse functional tilelayers (`minerals`, `entities`) to objectgroups.
- Normalize object property keys (remove ambiguous `x`,`y`,`cx`,`cy`,`o` semantics).
- Require explicit IDs for zoning/checkpoint layers.

### Ticket 3 — Authority Cleanup
- Remove `portals` tilelayer and keep portal authority only in `doors` objects.
- Resolve zone overlaps/duplicates (especially in `mobile_zones`).

### Ticket 4 — Validation Gate
- Run legacy profile to inventory warnings.
- Run target profile and require zero errors before accepting migration.

## Canonical Target Layer Order (68 layers)
1. `sand` (tilelayer, visible)
2. `beach_props` (tilelayer, visible)
3. `ground` (tilelayer, visible)
4. `ground_variations` (tilelayer, visible)
5. `mud` (tilelayer, visible)
6. `grass` (tilelayer, visible)
7. `stone` (tilelayer, visible)
8. `water` (tilelayer, visible)
9. `grass_variations` (tilelayer, visible)
10. `lakes` (tilelayer, visible)
11. `village_boundaries` (tilelayer, visible)
12. `village_boundaries_level_2` (tilelayer, visible)
13. `river` (tilelayer, visible)
14. `houses_layer_2` (tilelayer, visible)
15. `houses` (tilelayer, visible)
16. `dry_ground` (tilelayer, visible)
17. `dry_ground_2` (tilelayer, visible)
18. `big_rocks` (tilelayer, visible)
19. `graveyard_mud` (tilelayer, visible)
20. `dead_grass` (tilelayer, visible)
21. `dead_leaves` (tilelayer, visible)
22. `small_rocks` (tilelayer, visible)
23. `graveyard` (tilelayer, visible)
24. `dead_trees` (tilelayer, visible)
25. `camps` (tilelayer, visible)
26. `bones` (tilelayer, visible)
27. `lava` (tilelayer, visible)
28. `canyon` (tilelayer, visible)
29. `cliffs` (tilelayer, visible)
30. `cliffs_2` (tilelayer, visible)
31. `totems` (tilelayer, visible)
32. `cactus` (tilelayer, visible)
33. `lava_falls` (tilelayer, visible)
34. `lava_boundaries` (tilelayer, visible)
35. `cave` (tilelayer, visible)
36. `trees` (tilelayer, visible)
37. `cave_river` (tilelayer, visible)
38. `cave_walls` (tilelayer, visible)
39. `indoor` (tilelayer, visible)
40. `indoor_walls` (tilelayer, visible)
41. `indoor_doors` (tilelayer, visible)
42. `carpets` (tilelayer, visible)
43. `indoor_props` (tilelayer, visible)
44. `easter_eggs` (tilelayer, visible)
45. `forest_paths` (tilelayer, visible)
46. `forest` (tilelayer, visible)
47. `forest_lakes` (tilelayer, visible)
48. `forest_boundaries` (tilelayer, visible)
49. `forest_trees` (tilelayer, visible)
50. `bridge_shadows` (tilelayer, visible)
51. `bridge` (tilelayer, visible)
52. `forest_props` (tilelayer, visible)
53. `forest_objects_2` (tilelayer, visible)
54. `maze_floor` (tilelayer, visible)
55. `maze_walls` (tilelayer, visible)
56. `sea` (tilelayer, visible)
57. `resource_nodes` (objectgroup, hidden)
58. `static_entities` (objectgroup, hidden)
59. `chest_spawns` (objectgroup, hidden)
60. `chest_areas` (objectgroup, hidden)
61. `doors` (objectgroup, hidden)
62. `roaming_areas` (objectgroup, hidden)
63. `zones` (objectgroup, hidden)
64. `plateau_mask` (tilelayer, hidden)
65. `blocking_mask` (tilelayer, hidden)
66. `music_zones` (objectgroup, hidden)
67. `checkpoints` (objectgroup, hidden)
68. `mobile_zones` (objectgroup, hidden)

## Exact Legacy Layer Edit Matrix

| Legacy ID | Current Layer | Target Layer | Exact Edit |
|---:|---|---|---|
| 1 | `don't remove this layer` (tilelayer, hidden) | _removed_ | Delete layer entirely. |
| 2 | `sand` | `sand` | Keep name/type/visibility. |
| 3 | `sand objects` | `beach_props` | Rename layer only. |
| 4 | `ground` | `ground` | Keep name/type/visibility. |
| 5 | `groundvariations` | `ground_variations` | Rename layer only. |
| 6 | `mud` | `mud` | Keep name/type/visibility. |
| 7 | `grass` | `grass` | Keep name/type/visibility. |
| 8 | `stone` | `stone` | Keep name/type/visibility. |
| 9 | `water` | `water` | Keep name/type/visibility. |
| 10 | `grassvariations` | `grass_variations` | Rename layer only. |
| 11 | `lakes` | `lakes` | Keep name/type/visibility. |
| 12 | `village boundaries` | `village_boundaries` | Rename layer only. |
| 13 | `village boundaries lvl 2` | `village_boundaries_level_2` | Rename layer only. |
| 14 | `river` | `river` | Keep name/type/visibility. |
| 15 | `Houses layer 2` | `houses_layer_2` | Rename layer only. |
| 16 | `Houses` | `houses` | Rename layer only. |
| 17 | `dryground` | `dry_ground` | Rename layer only. |
| 18 | `dryground2` | `dry_ground_2` | Rename layer only. |
| 19 | `Big Rocks` | `big_rocks` | Rename layer only. |
| 20 | `graveyard mud` | `graveyard_mud` | Rename layer only. |
| 21 | `dead grass` | `dead_grass` | Rename layer only. |
| 22 | `dead leaves` | `dead_leaves` | Rename layer only. |
| 23 | `small rocks` | `small_rocks` | Rename layer only. |
| 24 | `graveyard` | `graveyard` | Keep name/type/visibility. |
| 25 | `dead trees` | `dead_trees` | Rename layer only. |
| 26 | `camps` | `camps` | Keep name/type/visibility. |
| 27 | `bones` | `bones` | Keep name/type/visibility. |
| 28 | `lava` | `lava` | Keep name/type/visibility. |
| 29 | `canyon` | `canyon` | Keep name/type/visibility. |
| 30 | `Cliffs` | `cliffs` | Rename layer only. |
| 31 | `Cliffs 2` | `cliffs_2` | Rename layer only. |
| 32 | `totems` | `totems` | Keep name/type/visibility. |
| 33 | `cactus` | `cactus` | Keep name/type/visibility. |
| 34 | `lavafalls` | `lava_falls` | Rename layer only. |
| 35 | `lava boundaries` | `lava_boundaries` | Rename layer only. |
| 36 | `cave` | `cave` | Keep name/type/visibility. |
| 37 | `Trees2` | `trees` | Rename layer only. |
| 38 | `caveriver` | `cave_river` | Rename layer only. |
| 39 | `cavewalls` | `cave_walls` | Rename layer only. |
| 40 | `indoor` | `indoor` | Keep name/type/visibility. |
| 41 | `indoorwalls` | `indoor_walls` | Rename layer only. |
| 42 | `indoor doors` | `indoor_doors` | Rename layer only. |
| 43 | `carpets` | `carpets` | Keep name/type/visibility. |
| 44 | `indoor objects` | `indoor_props` | Rename layer only. |
| 45 | `easter eggs` | `easter_eggs` | Rename layer only. |
| 46 | `forest paths` | `forest_paths` | Rename layer only. |
| 47 | `forest` | `forest` | Keep name/type/visibility. |
| 48 | `forest lakes` | `forest_lakes` | Rename layer only. |
| 49 | `forest boundaries` | `forest_boundaries` | Rename layer only. |
| 50 | `forest trees` | `forest_trees` | Rename layer only. |
| 51 | `bridges shadows` | `bridge_shadows` | Rename layer only. |
| 52 | `Bridge` | `bridge` | Rename layer only. |
| 53 | `forest objects 1` | `forest_props` | Rename layer only. |
| 54 | `forest objects 2` | `forest_objects_2` | Rename layer only. |
| 55 | `mase` | `maze_floor` | Rename layer only. |
| 56 | `mase walls` | `maze_walls` | Rename layer only. |
| 57 | `sea` | `sea` | Keep name/type/visibility. |
| 58 | `minerals` (tilelayer, hidden) | `resource_nodes` (objectgroup, hidden) | Convert each nonzero tile to an object spawn node; drop tilelayer payload. |
| 59 | `entities` (tilelayer, hidden) | `static_entities` (objectgroup, hidden) | Convert each nonzero tile to static entity object; preserve gid in property (`entity_gid`). |
| 60 | `chests` | `chest_spawns` | Rename layer; keep `items` property on each object. |
| 61 | `chestareas` | `chest_areas` | Rename layer; rename properties `x`→`spawn_tx`, `y`→`spawn_ty`. |
| 62 | `doors` | `doors` | Keep layer; rename properties `o`→`orientation`, `x`→`target_tx`, `y`→`target_ty`, `cx`→`local_tx`, `cy`→`local_ty`. |
| 63 | `roaming` | `roaming_areas` | Rename layer; rename `nb` property to `count`. |
| 64 | `portals` (tilelayer, hidden) | _removed_ | Delete layer; retain portals only as `doors` objects (`type=portal`). |
| 65 | `zones` | `zones` | Keep layer; add required properties `zone_id` (int) and `zone_kind` (string) to every object. |
| 66 | `plateau` | `plateau_mask` | Rename layer only. |
| 67 | `blocking` | `blocking_mask` | Rename layer only. |
| 68 | `music` | `music_zones` | Rename layer; rename object property `id`→`track_id`. |
| 69 | `checkpoints` | `checkpoints` | Keep layer; add required `checkpoint_id` property for every object. |
| 70 | `mobile zones` | `mobile_zones` | Rename layer; add required `zone_id` property and remove duplicate rectangle entries. |

## Mandatory Property Contract (Target)
- `doors` objects:
  - required: `orientation`, `target_tx`, `target_ty`
  - portal objects (`type=portal`) also require: `door_id`, `target_door`, `target_map`
  - forbidden legacy keys: `o`, `x`, `y`, `cx`, `cy`
- `chest_areas` objects:
  - required: `items`, `spawn_tx`, `spawn_ty`
  - forbidden legacy keys: `x`, `y`
- `roaming_areas` objects:
  - required: `count` (integer-like)
- `zones` and `mobile_zones` objects:
  - required: `zone_id` (unique per layer)
- `music_zones` objects:
  - required: `track_id`
- `checkpoints` objects:
  - required: `checkpoint_id`
- `static_entities` objects:
  - required: `entity_gid`
- `resource_nodes` objects:
  - required: `resource_gid`

## Validation Commands
- Legacy diagnostics (should run cleanly, may report warnings):
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy`
- Target contract gate (expected to fail until migration is complete):
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target`
