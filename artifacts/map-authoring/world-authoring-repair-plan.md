# World Authoring Repair Plan

Generated: 2026-06-10T12:24:50.666Z
World: `assets/maps/tiled/world.json`
Mode: dry-run

## Summary

| Kind | Count |
| --- | ---: |
| remove_duplicate_covered_paint | 6 |
| remove_accidental_tiny_component | 0 |
| normalize_door_portal_semantics | 0 |
| normalize_target_map | 0 |
| add_map_property | 0 |

## Changes

1. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=43,194
   - reason: Clear duplicate lower paint because render_world/village_biome/mud paints the same gid later at this cell.
2. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=44,194
   - reason: Clear duplicate lower paint because render_world/village_biome/mud paints the same gid later at this cell.
3. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=45,194
   - reason: Clear duplicate lower paint because render_world/village_biome/mud paints the same gid later at this cell.
4. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=4,218
   - reason: Clear duplicate lower paint because render_world/village_biome/lakes paints the same gid later at this cell.
5. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/village_biome/ground; cell=4,220
   - reason: Clear duplicate lower paint because render_world/village_biome/lakes paints the same gid later at this cell.
6. remove_duplicate_covered_paint
   - confidence: high
   - location: layer=render_world/deadlands_biome/dry_ground; cell=80,72
   - reason: Clear duplicate lower paint because render_world/deadlands_biome/dry_ground_2 paints the same gid later at this cell.
