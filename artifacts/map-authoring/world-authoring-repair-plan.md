# World Authoring Repair Plan

Generated: 2026-06-10T12:19:07.564Z
World: `assets/maps/tiled/world.json`
Mode: dry-run

## Summary

| Kind | Count |
| --- | ---: |
| remove_duplicate_covered_paint | 6 |
| remove_accidental_tiny_component | 0 |
| normalize_door_portal_semantics | 0 |
| normalize_target_map | 0 |
| add_map_property | 4 |

## Changes

1. add_map_property
   - confidence: high
   - location: map
   - reason: Add required terrain-authoring map property "map_id" with conservative value.
2. add_map_property
   - confidence: high
   - location: map
   - reason: Add required terrain-authoring map property "authoring_version" with conservative value.
3. add_map_property
   - confidence: high
   - location: map
   - reason: Add required terrain-authoring map property "default_music" with conservative value.
4. add_map_property
   - confidence: high
   - location: map
   - reason: Add required terrain-authoring map property "default_biome" with conservative value.
5. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=43,194
   - reason: Clear duplicate lower paint because render_world/village_biome/mud paints the same gid later at this cell.
6. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=44,194
   - reason: Clear duplicate lower paint because render_world/village_biome/mud paints the same gid later at this cell.
7. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=45,194
   - reason: Clear duplicate lower paint because render_world/village_biome/mud paints the same gid later at this cell.
8. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=4,218
   - reason: Clear duplicate lower paint because render_world/village_biome/lakes paints the same gid later at this cell.
9. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=4,220
   - reason: Clear duplicate lower paint because render_world/village_biome/lakes paints the same gid later at this cell.
10. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/deadlands_biome/dry_ground; cell=80,72
   - reason: Clear duplicate lower paint because render_world/deadlands_biome/dry_ground_2 paints the same gid later at this cell.
