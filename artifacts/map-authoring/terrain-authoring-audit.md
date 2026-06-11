# Terrain Authoring Audit

Generated: 2026-06-11T09:29:25.432Z
World: assets/maps/tiled/world.json
Tileset: assets/maps/tiled/tilesheet.wang.tsj

## Summary

- map_properties: 0
- wang_tileset: 19
- terrain_paint: 161
- overlay_layering: 6
- wrong_layer: 0
- tile_object: 350
- door_portal_gate: 0
- collision_passability: 1
- spawn_region: 6
- music_region: 1
- asset_reference: 1

## Findings

### TILESET_IMAGE_REFERENCE: Tileset image reference

- Severity: info
- Category: asset_reference
- Detail: The Wang tileset declares an image reference.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: image=../../../client/public/img/1/tilesheet.webp

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=browserquest-terrain; pure=740; total=766; ratio=0.97

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=browserquest-carpets; pure=18; total=18; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=browserquest-carpets; mixed=0

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-shoreline; pure=95; total=95; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-shoreline; mixed=0

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-riverbank; pure=86; total=86; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-riverbank; mixed=0

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-village_ground; pure=109; total=109; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-village_ground; mixed=0

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-field_edges; pure=254; total=254; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-field_edges; mixed=0

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-forest_edges; pure=60; total=66; ratio=0.91

### WANG_PAIR_HAS_TOO_FEW_MIXED_TRANSITIONS: Pair Wang set has too few mixed transitions

- Severity: medium
- Category: wang_tileset
- Detail: A two-color Wang set has some mixed entries but fewer than the review threshold.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-forest_edges; mixed=6; minimum=16

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-cave_rock; pure=362; total=362; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-cave_rock; mixed=0

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-lava_rock; pure=353; total=353; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-lava_rock; mixed=0

### WANG_SET_MOSTLY_PURE: Wang set is mostly pure tiles

- Severity: medium
- Category: wang_tileset
- Detail: A transition Wang set needs enough mixed entries to describe edges and corners.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-lava_cave; pure=35; total=35; ratio=1.00

### WANG_PAIR_HAS_NO_MIXED_TRANSITIONS: Pair Wang set has no mixed transitions

- Severity: high
- Category: wang_tileset
- Detail: A two-color Wang set with no mixed entries cannot paint transitions between its colors.
- Location: `{"tileset":"assets/maps/tiled/tilesheet.wang.tsj"}`
- Evidence: set=scaffold-lava_cave; mixed=0

### BASE_TERRAIN_FILL_COUNT: Base terrain fill count

- Severity: info
- Category: terrain_paint
- Detail: Counts painted base terrain tiles across current terrain-like layers.
- Location: `{"map":"assets/maps/tiled/world.json"}`
- Evidence: layers=24; painted_tiles=37821

### TRANSPARENT_OVERLAY_LAYER: Transparent or foreground overlay layer

- Severity: info
- Category: overlay_layering
- Detail: Overlay-like layers should be reviewed for bucket placement and foreground semantics.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs"}`
- Evidence: opacity=0.99; class=<none>

### TRANSPARENT_OVERLAY_LAYER: Transparent or foreground overlay layer

- Severity: info
- Category: overlay_layering
- Detail: Overlay-like layers should be reviewed for bucket placement and foreground semantics.
- Location: `{"layerPath":"render_world/foreground_overlays/cliffs_foreground"}`
- Evidence: opacity=0.99; class=Foreground

### TRANSPARENT_OVERLAY_LAYER: Transparent or foreground overlay layer

- Severity: info
- Category: overlay_layering
- Detail: Overlay-like layers should be reviewed for bucket placement and foreground semantics.
- Location: `{"layerPath":"render_world/foreground_overlays/cave_walls_foreground"}`
- Evidence: opacity=1; class=Foreground

### TRANSPARENT_OVERLAY_LAYER: Transparent or foreground overlay layer

- Severity: info
- Category: overlay_layering
- Detail: Overlay-like layers should be reviewed for bucket placement and foreground semantics.
- Location: `{"layerPath":"render_world/foreground_overlays/indoor_doors_foreground"}`
- Evidence: opacity=1; class=Foreground

### TRANSPARENT_OVERLAY_LAYER: Transparent or foreground overlay layer

- Severity: info
- Category: overlay_layering
- Detail: Overlay-like layers should be reviewed for bucket placement and foreground semantics.
- Location: `{"layerPath":"render_world/foreground_overlays/bridge_shadows_foreground"}`
- Evidence: opacity=1; class=Foreground

### TRANSPARENT_OVERLAY_LAYER: Transparent or foreground overlay layer

- Severity: info
- Category: overlay_layering
- Detail: Overlay-like layers should be reviewed for bucket placement and foreground semantics.
- Location: `{"layerPath":"render_world/foreground_overlays/maze_walls_foreground"}`
- Evidence: opacity=1; class=Foreground

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/beach_biome/shoreline","x":1,"y":298,"gid":1781}`
- Evidence: painted_tiles=276

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/village_biome/ground_variations","x":12,"y":106,"gid":13}`
- Evidence: painted_tiles=274

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/village_biome/grass_variations","x":10,"y":194,"gid":219}`
- Evidence: painted_tiles=68

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries","x":0,"y":195,"gid":937}`
- Evidence: painted_tiles=876

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries_level_2","x":1,"y":122,"gid":710}`
- Evidence: painted_tiles=228

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/village_biome/river","x":0,"y":191,"gid":409}`
- Evidence: painted_tiles=372

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/badlands_biome/lava","x":51,"y":0,"gid":1181}`
- Evidence: painted_tiles=1506

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":19,"y":0,"gid":1326}`
- Evidence: painted_tiles=4779

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs_2","x":65,"y":0,"gid":1383}`
- Evidence: painted_tiles=487

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/badlands_biome/lava_falls","x":51,"y":1,"gid":1436}`
- Evidence: painted_tiles=6

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/badlands_biome/lava_boundaries","x":70,"y":2,"gid":1727}`
- Evidence: painted_tiles=78

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/subterranean_region/cave_river","x":144,"y":28,"gid":1308}`
- Evidence: painted_tiles=249

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/forest_region/forest_boundaries","x":9,"y":73,"gid":1014}`
- Evidence: painted_tiles=728

### TERRAIN_TRANSITION_LAYER: Terrain transition layer

- Severity: info
- Category: terrain_paint
- Detail: Transition layers are inventoried for later Wang and terrain-family review.
- Location: `{"layerPath":"render_world/foreground_overlays/cliffs_foreground","x":71,"y":11,"gid":1105}`
- Evidence: painted_tiles=4

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/beach_biome/sand","x":69,"y":245,"gid":299}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/beach_biome/sand","x":70,"y":245,"gid":300}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/beach_biome/sand","x":71,"y":245,"gid":299}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/ground","x":0,"y":55,"gid":35}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/ground","x":1,"y":55,"gid":36}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/ground","x":2,"y":55,"gid":35}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/ground_variations","x":12,"y":106,"gid":13}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/ground_variations","x":13,"y":106,"gid":14}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/ground_variations","x":18,"y":106,"gid":714}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/mud","x":42,"y":194,"gid":569}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/mud","x":43,"y":194,"gid":551}`
- Evidence: size=2

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/mud","x":44,"y":194,"gid":552}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/grass","x":53,"y":190,"gid":114}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/grass","x":54,"y":190,"gid":93}`
- Evidence: size=2

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/grass","x":56,"y":190,"gid":94}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/stone","x":36,"y":195,"gid":374}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/stone","x":37,"y":195,"gid":375}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/stone","x":38,"y":195,"gid":376}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/grass_variations","x":10,"y":194,"gid":219}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/grass_variations","x":11,"y":194,"gid":220}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/grass_variations","x":2,"y":195,"gid":159}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/lakes","x":4,"y":217,"gid":649}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/lakes","x":5,"y":217,"gid":669}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/lakes","x":6,"y":217,"gid":747}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries","x":0,"y":195,"gid":937}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries","x":1,"y":195,"gid":959}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries","x":2,"y":195,"gid":960}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries_level_2","x":1,"y":122,"gid":710}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries_level_2","x":2,"y":122,"gid":711}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/village_boundaries_level_2","x":1,"y":123,"gid":730}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/river","x":4,"y":191,"gid":410}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/river","x":5,"y":191,"gid":411}`
- Evidence: size=2

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/village_biome/river","x":7,"y":191,"gid":448}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":109,"y":0,"gid":419}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":110,"y":0,"gid":420}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":111,"y":0,"gid":419}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground_2","x":105,"y":4,"gid":1715}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground_2","x":106,"y":4,"gid":1716}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground_2","x":102,"y":5,"gid":1754}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/graveyard_mud","x":18,"y":102,"gid":552}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/graveyard_mud","x":19,"y":102,"gid":553}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/graveyard_mud","x":13,"y":103,"gid":552}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dead_grass","x":141,"y":59,"gid":567}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dead_grass","x":158,"y":72,"gid":567}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/deadlands_biome/dead_grass","x":89,"y":107,"gid":505}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava","x":81,"y":2,"gid":1181}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava","x":107,"y":2,"gid":1421}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava","x":108,"y":2,"gid":1181}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/canyon","x":0,"y":0,"gid":1378}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/canyon","x":1,"y":0,"gid":1379}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/canyon","x":2,"y":0,"gid":1378}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":19,"y":0,"gid":1326}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":20,"y":0,"gid":1327}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":21,"y":0,"gid":1328}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs_2","x":65,"y":0,"gid":1383}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs_2","x":66,"y":0,"gid":1342}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs_2","x":67,"y":0,"gid":1322}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava_falls","x":51,"y":1,"gid":1436}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava_falls","x":53,"y":1,"gid":1438}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava_falls","x":87,"y":1,"gid":1436}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava_boundaries","x":70,"y":2,"gid":1727}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava_boundaries","x":71,"y":2,"gid":1728}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/badlands_biome/lava_boundaries","x":72,"y":2,"gid":1729}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave","x":141,"y":28,"gid":28}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave","x":146,"y":28,"gid":4}`
- Evidence: size=2

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave","x":156,"y":28,"gid":553}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave_river","x":144,"y":28,"gid":1308}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave_river","x":145,"y":28,"gid":1309}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave_river","x":146,"y":28,"gid":1310}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave_walls","x":141,"y":26,"gid":1328}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave_walls","x":142,"y":26,"gid":1346}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/cave_walls","x":143,"y":26,"gid":1829}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor","x":154,"y":19,"gid":1507}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor","x":155,"y":19,"gid":1508}`
- Evidence: size=2

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor","x":155,"y":20,"gid":1488}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor_walls","x":152,"y":15,"gid":1445}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor_walls","x":153,"y":15,"gid":1446}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor_walls","x":154,"y":15,"gid":1447}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor_doors","x":154,"y":19,"gid":1606}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor_doors","x":155,"y":19,"gid":1607}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/indoor_doors","x":156,"y":19,"gid":1608}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/carpets","x":124,"y":135,"gid":825}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/carpets","x":128,"y":135,"gid":827}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/subterranean_region/carpets","x":150,"y":135,"gid":1609}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_paths","x":40,"y":136,"gid":552}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_paths","x":41,"y":136,"gid":513}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_paths","x":44,"y":136,"gid":510}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest","x":40,"y":137,"gid":156}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest","x":41,"y":137,"gid":116}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest","x":39,"y":138,"gid":175}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_lakes","x":23,"y":145,"gid":670}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_lakes","x":25,"y":145,"gid":668}`
- Evidence: size=2

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_lakes","x":16,"y":146,"gid":669}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_boundaries","x":9,"y":73,"gid":1014}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_boundaries","x":10,"y":73,"gid":1032}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/forest_boundaries","x":10,"y":74,"gid":1052}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/bridge_shadows","x":72,"y":4,"gid":63}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/bridge_shadows","x":72,"y":9,"gid":103}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/bridge_shadows","x":44,"y":27,"gid":63}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/bridge","x":44,"y":194,"gid":8}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/bridge","x":137,"y":224,"gid":1440}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/bridge","x":138,"y":224,"gid":1460}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/maze_floor","x":125,"y":183,"gid":552}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/maze_floor","x":126,"y":183,"gid":553}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/maze_floor","x":127,"y":183,"gid":552}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/maze_walls","x":154,"y":85,"gid":1704}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/maze_walls","x":134,"y":87,"gid":1704}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/forest_region/maze_walls","x":125,"y":181,"gid":1328}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/cliffs_foreground","x":71,"y":11,"gid":1105}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/cliffs_foreground","x":91,"y":29,"gid":1105}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/cliffs_foreground","x":79,"y":45,"gid":1105}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/cave_walls_foreground","x":166,"y":36,"gid":1184}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/cave_walls_foreground","x":166,"y":37,"gid":1204}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/cave_walls_foreground","x":117,"y":94,"gid":1184}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/indoor_doors_foreground","x":155,"y":20,"gid":1627}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/indoor_doors_foreground","x":155,"y":21,"gid":1647}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/indoor_doors_foreground","x":126,"y":143,"gid":1627}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/bridge_shadows_foreground","x":69,"y":54,"gid":62}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/maze_walls_foreground","x":127,"y":190,"gid":1184}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/maze_walls_foreground","x":127,"y":191,"gid":1204}`
- Evidence: size=1

### TINY_SUSPICIOUS_PAINT_COMPONENT: Tiny suspicious paint component

- Severity: medium
- Category: terrain_paint
- Detail: A one- or two-tile paint island should be reviewed as possible accidental brush noise.
- Location: `{"layerPath":"render_world/foreground_overlays/maze_walls_foreground","x":120,"y":200,"gid":1184}`
- Evidence: size=1

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":83,"y":294,"gid":1033}`
- Evidence: lower=render_world/village_biome/village_boundaries; higher=render_world/badlands_biome/cliffs

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":83,"y":295,"gid":1053}`
- Evidence: lower=render_world/village_biome/village_boundaries; higher=render_world/badlands_biome/cliffs

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":84,"y":295,"gid":1054}`
- Evidence: lower=render_world/village_biome/village_boundaries; higher=render_world/badlands_biome/cliffs

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":83,"y":296,"gid":1073}`
- Evidence: lower=render_world/village_biome/village_boundaries; higher=render_world/badlands_biome/cliffs

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":84,"y":296,"gid":1074}`
- Evidence: lower=render_world/village_biome/village_boundaries; higher=render_world/badlands_biome/cliffs

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":83,"y":297,"gid":1093}`
- Evidence: lower=render_world/village_biome/village_boundaries; higher=render_world/badlands_biome/cliffs

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/badlands_biome/cliffs","x":84,"y":297,"gid":1094}`
- Evidence: lower=render_world/village_biome/village_boundaries; higher=render_world/badlands_biome/cliffs

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":60,"y":66,"gid":35}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":61,"y":66,"gid":36}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":60,"y":68,"gid":35}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":61,"y":68,"gid":36}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":60,"y":70,"gid":35}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":61,"y":70,"gid":36}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":60,"y":71,"gid":15}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":61,"y":71,"gid":16}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":60,"y":72,"gid":35}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":61,"y":72,"gid":36}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":60,"y":84,"gid":15}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":61,"y":84,"gid":16}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":62,"y":84,"gid":15}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":63,"y":84,"gid":16}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":67,"y":84,"gid":16}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":79,"y":84,"gid":16}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":60,"y":85,"gid":35}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### DUPLICATE_FULLY_COVERED_PAINT: Duplicate paint stack

- Severity: low
- Category: terrain_paint
- Detail: The same gid appears in multiple layers at the same coordinate.
- Location: `{"layerPath":"render_world/deadlands_biome/dry_ground","x":61,"y":85,"gid":36}`
- Evidence: lower=render_world/village_biome/ground; higher=render_world/deadlands_biome/dry_ground

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5056,"x":69,"y":255,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5057,"x":70,"y":255,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5058,"x":46,"y":257,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5059,"x":47,"y":257,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5060,"x":58,"y":258,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5061,"x":59,"y":258,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5062,"x":16,"y":261,"gid":161}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5063,"x":17,"y":261,"gid":162}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5064,"x":16,"y":262,"gid":181}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5065,"x":17,"y":262,"gid":182}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5066,"x":64,"y":262,"gid":1901}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5067,"x":65,"y":262,"gid":1902}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5068,"x":16,"y":263,"gid":201}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5069,"x":17,"y":263,"gid":202}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5070,"x":18,"y":263,"gid":203}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5071,"x":70,"y":265,"gid":161}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5072,"x":71,"y":265,"gid":162}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5073,"x":70,"y":266,"gid":181}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5074,"x":71,"y":266,"gid":182}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5075,"x":17,"y":267,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5076,"x":18,"y":267,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5077,"x":70,"y":267,"gid":201}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5078,"x":71,"y":267,"gid":202}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5079,"x":72,"y":267,"gid":203}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/beach_biome/beach_props","objectId":5080,"x":81,"y":267,"gid":1846}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1930,"x":36,"y":193,"gid":66}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1931,"x":37,"y":193,"gid":67}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1932,"x":38,"y":193,"gid":68}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1933,"x":39,"y":193,"gid":69}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1934,"x":36,"y":194,"gid":86}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1935,"x":37,"y":194,"gid":87}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1936,"x":38,"y":194,"gid":88}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1937,"x":39,"y":194,"gid":89}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1938,"x":36,"y":195,"gid":106}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1939,"x":37,"y":195,"gid":107}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1940,"x":38,"y":195,"gid":108}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1941,"x":39,"y":195,"gid":109}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1942,"x":34,"y":196,"gid":124}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1943,"x":35,"y":196,"gid":125}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1944,"x":36,"y":196,"gid":126}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1945,"x":37,"y":196,"gid":127}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1946,"x":38,"y":196,"gid":128}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1947,"x":39,"y":196,"gid":129}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1948,"x":40,"y":196,"gid":130}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1949,"x":34,"y":197,"gid":144}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1950,"x":35,"y":197,"gid":145}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1951,"x":36,"y":197,"gid":146}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1952,"x":37,"y":197,"gid":147}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1953,"x":38,"y":197,"gid":148}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/village_biome/houses","objectId":1954,"x":39,"y":197,"gid":149}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":600,"x":51,"y":65,"gid":777}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":601,"x":52,"y":65,"gid":778}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":602,"x":53,"y":65,"gid":779}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":603,"x":51,"y":66,"gid":797}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":604,"x":52,"y":66,"gid":798}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":605,"x":53,"y":66,"gid":799}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":606,"x":51,"y":67,"gid":817}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":607,"x":52,"y":67,"gid":818}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":608,"x":53,"y":67,"gid":819}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":609,"x":1,"y":103,"gid":777}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":610,"x":2,"y":103,"gid":778}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":611,"x":3,"y":103,"gid":779}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":612,"x":1,"y":104,"gid":797}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":613,"x":2,"y":104,"gid":798}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":614,"x":3,"y":104,"gid":799}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":615,"x":83,"y":104,"gid":98}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":616,"x":84,"y":104,"gid":99}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":617,"x":1,"y":105,"gid":817}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":618,"x":2,"y":105,"gid":818}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":619,"x":3,"y":105,"gid":819}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":620,"x":32,"y":105,"gid":98}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":621,"x":33,"y":105,"gid":99}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":622,"x":42,"y":110,"gid":777}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":623,"x":43,"y":110,"gid":778}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/big_rocks","objectId":624,"x":44,"y":110,"gid":779}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5148,"x":50,"y":109,"gid":119}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5149,"x":48,"y":112,"gid":119}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5150,"x":28,"y":113,"gid":119}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5151,"x":24,"y":114,"gid":717}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5152,"x":27,"y":114,"gid":720}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5153,"x":52,"y":115,"gid":118}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5154,"x":21,"y":116,"gid":140}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5155,"x":25,"y":116,"gid":120}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5156,"x":43,"y":116,"gid":118}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5157,"x":47,"y":118,"gid":140}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5158,"x":18,"y":119,"gid":138}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5159,"x":28,"y":120,"gid":140}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5160,"x":32,"y":121,"gid":119}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5161,"x":18,"y":122,"gid":119}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5162,"x":28,"y":122,"gid":717}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5163,"x":31,"y":122,"gid":720}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5164,"x":48,"y":122,"gid":119}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5165,"x":14,"y":123,"gid":717}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5166,"x":17,"y":123,"gid":720}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5167,"x":44,"y":123,"gid":717}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5168,"x":47,"y":123,"gid":720}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5169,"x":25,"y":124,"gid":140}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5170,"x":29,"y":124,"gid":120}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5171,"x":11,"y":125,"gid":140}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_leaves","objectId":5172,"x":15,"y":125,"gid":120}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":685,"x":20,"y":110,"gid":1860}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":686,"x":17,"y":111,"gid":1877}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":687,"x":18,"y":111,"gid":1878}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":688,"x":19,"y":111,"gid":1879}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":689,"x":20,"y":111,"gid":1880}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":690,"x":17,"y":112,"gid":1897}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":691,"x":18,"y":112,"gid":1898}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":692,"x":19,"y":112,"gid":1899}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":693,"x":20,"y":112,"gid":1900}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":694,"x":31,"y":112,"gid":601}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":695,"x":33,"y":112,"gid":603}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":696,"x":34,"y":112,"gid":604}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":697,"x":17,"y":113,"gid":1917}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":698,"x":18,"y":113,"gid":1918}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":699,"x":19,"y":113,"gid":1919}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":700,"x":20,"y":113,"gid":1920}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":701,"x":34,"y":113,"gid":624}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":702,"x":15,"y":114,"gid":121}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":703,"x":22,"y":114,"gid":81}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":704,"x":31,"y":114,"gid":641}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":705,"x":32,"y":114,"gid":642}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":706,"x":33,"y":114,"gid":643}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":707,"x":34,"y":114,"gid":644}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":708,"x":28,"y":115,"gid":81}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/graveyard","objectId":709,"x":31,"y":115,"gid":661}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":799,"x":12,"y":107,"gid":617}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":800,"x":15,"y":107,"gid":620}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":801,"x":12,"y":111,"gid":697}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":802,"x":13,"y":111,"gid":698}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":803,"x":14,"y":111,"gid":699}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":804,"x":15,"y":111,"gid":700}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":805,"x":12,"y":112,"gid":717}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":806,"x":13,"y":112,"gid":718}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":807,"x":14,"y":112,"gid":719}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":808,"x":15,"y":112,"gid":720}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":809,"x":26,"y":114,"gid":617}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":810,"x":29,"y":114,"gid":620}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":811,"x":51,"y":116,"gid":617}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":812,"x":54,"y":116,"gid":620}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":813,"x":65,"y":117,"gid":617}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":814,"x":68,"y":117,"gid":620}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":815,"x":26,"y":118,"gid":697}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":816,"x":27,"y":118,"gid":698}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":817,"x":28,"y":118,"gid":699}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":818,"x":29,"y":118,"gid":700}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":819,"x":26,"y":119,"gid":717}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":820,"x":27,"y":119,"gid":718}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":821,"x":28,"y":119,"gid":719}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":822,"x":29,"y":119,"gid":720}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/dead_trees","objectId":823,"x":51,"y":120,"gid":697}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":904,"x":3,"y":75,"gid":161}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":905,"x":4,"y":75,"gid":162}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":906,"x":3,"y":76,"gid":181}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":907,"x":4,"y":76,"gid":182}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":908,"x":3,"y":77,"gid":201}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":909,"x":4,"y":77,"gid":202}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":910,"x":5,"y":77,"gid":203}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":911,"x":4,"y":78,"gid":241}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":912,"x":4,"y":79,"gid":261}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":913,"x":15,"y":83,"gid":736}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":914,"x":16,"y":83,"gid":737}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":915,"x":17,"y":83,"gid":738}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":916,"x":18,"y":83,"gid":739}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":917,"x":19,"y":83,"gid":737}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":918,"x":20,"y":83,"gid":740}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":919,"x":47,"y":88,"gid":81}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":920,"x":11,"y":97,"gid":241}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":921,"x":11,"y":98,"gid":261}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":922,"x":49,"y":104,"gid":241}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":923,"x":49,"y":105,"gid":261}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":924,"x":55,"y":120,"gid":161}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":925,"x":56,"y":120,"gid":162}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":926,"x":55,"y":121,"gid":181}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":927,"x":56,"y":121,"gid":182}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/camps","objectId":928,"x":55,"y":122,"gid":201}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":984,"x":34,"y":60,"gid":782}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":985,"x":34,"y":61,"gid":802}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":986,"x":35,"y":61,"gid":803}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":987,"x":33,"y":62,"gid":821}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":988,"x":34,"y":62,"gid":822}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":989,"x":35,"y":62,"gid":823}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":990,"x":36,"y":62,"gid":824}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":991,"x":33,"y":63,"gid":841}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":992,"x":34,"y":63,"gid":842}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":993,"x":35,"y":63,"gid":843}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":994,"x":36,"y":63,"gid":844}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":995,"x":33,"y":64,"gid":861}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":996,"x":34,"y":64,"gid":862}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":997,"x":35,"y":64,"gid":863}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":998,"x":36,"y":64,"gid":864}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":999,"x":14,"y":65,"gid":921}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1000,"x":15,"y":65,"gid":922}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1001,"x":16,"y":65,"gid":923}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1002,"x":17,"y":65,"gid":924}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1003,"x":18,"y":65,"gid":925}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1004,"x":33,"y":65,"gid":881}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1005,"x":34,"y":65,"gid":882}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1006,"x":35,"y":65,"gid":883}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1007,"x":36,"y":65,"gid":884}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/deadlands_biome/bones","objectId":1008,"x":15,"y":66,"gid":942}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1082,"x":154,"y":60,"gid":1565}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1083,"x":154,"y":61,"gid":1585}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1084,"x":154,"y":63,"gid":1625}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1085,"x":153,"y":64,"gid":1644}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1086,"x":154,"y":64,"gid":1645}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1087,"x":152,"y":66,"gid":1564}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1088,"x":153,"y":66,"gid":1565}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1089,"x":162,"y":66,"gid":1565}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1090,"x":162,"y":67,"gid":1585}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1091,"x":153,"y":69,"gid":1625}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1092,"x":162,"y":69,"gid":1625}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1093,"x":152,"y":70,"gid":1644}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1094,"x":153,"y":70,"gid":1645}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1095,"x":161,"y":70,"gid":1644}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1096,"x":162,"y":70,"gid":1645}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1097,"x":65,"y":71,"gid":1564}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1098,"x":66,"y":71,"gid":1565}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1099,"x":71,"y":71,"gid":1564}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1100,"x":66,"y":74,"gid":1625}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1101,"x":72,"y":74,"gid":1625}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1102,"x":72,"y":75,"gid":1645}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1103,"x":11,"y":93,"gid":762}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1104,"x":9,"y":94,"gid":761}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1105,"x":13,"y":94,"gid":763}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/totems","objectId":1106,"x":63,"y":95,"gid":1621}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1135,"x":50,"y":75,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1136,"x":7,"y":78,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1137,"x":8,"y":78,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1138,"x":25,"y":78,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1139,"x":26,"y":78,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1140,"x":42,"y":79,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1141,"x":43,"y":79,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1142,"x":33,"y":80,"gid":372}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1143,"x":34,"y":80,"gid":373}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1144,"x":14,"y":81,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1145,"x":15,"y":81,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1146,"x":11,"y":82,"gid":372}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1147,"x":12,"y":82,"gid":373}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1148,"x":55,"y":86,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1149,"x":56,"y":86,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1150,"x":1,"y":87,"gid":372}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1151,"x":2,"y":87,"gid":373}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1152,"x":9,"y":89,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1153,"x":10,"y":89,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1154,"x":1,"y":90,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1155,"x":2,"y":90,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1156,"x":23,"y":90,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1157,"x":24,"y":90,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1158,"x":39,"y":92,"gid":312}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/badlands_biome/cactus","objectId":1159,"x":40,"y":92,"gid":313}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2544,"x":52,"y":8,"gid":1738}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2545,"x":53,"y":8,"gid":1739}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2546,"x":54,"y":8,"gid":1740}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2547,"x":90,"y":8,"gid":1738}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2548,"x":91,"y":8,"gid":1739}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2549,"x":92,"y":8,"gid":1740}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2550,"x":52,"y":9,"gid":1758}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2551,"x":53,"y":9,"gid":1759}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2552,"x":54,"y":9,"gid":1760}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2553,"x":90,"y":9,"gid":1758}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2554,"x":91,"y":9,"gid":1759}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2555,"x":92,"y":9,"gid":1760}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2556,"x":41,"y":10,"gid":1738}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2557,"x":42,"y":10,"gid":1739}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2558,"x":43,"y":10,"gid":1740}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2559,"x":18,"y":11,"gid":1738}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2560,"x":19,"y":11,"gid":1739}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2561,"x":20,"y":11,"gid":1740}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2562,"x":41,"y":11,"gid":1758}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2563,"x":42,"y":11,"gid":1759}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2564,"x":43,"y":11,"gid":1760}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2565,"x":18,"y":12,"gid":1758}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2566,"x":19,"y":12,"gid":1759}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2567,"x":20,"y":12,"gid":1760}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/trees","objectId":2568,"x":96,"y":16,"gid":1738}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1183,"x":154,"y":51,"gid":905}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1184,"x":155,"y":51,"gid":906}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1185,"x":156,"y":51,"gid":907}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1186,"x":151,"y":135,"gid":1689}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1187,"x":152,"y":135,"gid":1690}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1188,"x":153,"y":135,"gid":1691}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1189,"x":158,"y":135,"gid":1668}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1190,"x":125,"y":136,"gid":905}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1191,"x":126,"y":136,"gid":906}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1192,"x":127,"y":136,"gid":907}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1193,"x":151,"y":136,"gid":1709}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1194,"x":152,"y":136,"gid":1710}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1195,"x":153,"y":136,"gid":1711}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1196,"x":156,"y":136,"gid":1686}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1197,"x":157,"y":136,"gid":1687}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1198,"x":158,"y":136,"gid":1688}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1199,"x":156,"y":137,"gid":1706}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1200,"x":157,"y":137,"gid":1707}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1201,"x":158,"y":137,"gid":1708}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1828,"x":154,"y":50,"gid":885}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1829,"x":155,"y":50,"gid":886}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1830,"x":156,"y":50,"gid":887}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1831,"x":151,"y":134,"gid":1669}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1832,"x":152,"y":134,"gid":1670}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/subterranean_region/indoor_props","objectId":1833,"x":153,"y":134,"gid":1671}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2884,"x":37,"y":143,"gid":294}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2885,"x":38,"y":143,"gid":295}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2886,"x":37,"y":144,"gid":314}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2887,"x":38,"y":144,"gid":315}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2888,"x":39,"y":144,"gid":140}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2889,"x":57,"y":144,"gid":138}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2890,"x":32,"y":145,"gid":294}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2891,"x":33,"y":145,"gid":295}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2892,"x":32,"y":146,"gid":314}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2893,"x":33,"y":146,"gid":315}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2894,"x":31,"y":147,"gid":138}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2895,"x":49,"y":147,"gid":294}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2896,"x":50,"y":147,"gid":295}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2897,"x":55,"y":147,"gid":140}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2898,"x":13,"y":148,"gid":294}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2899,"x":14,"y":148,"gid":295}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2900,"x":19,"y":148,"gid":7}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2901,"x":20,"y":148,"gid":9}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2902,"x":21,"y":148,"gid":10}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2903,"x":49,"y":148,"gid":314}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2904,"x":50,"y":148,"gid":315}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2905,"x":58,"y":148,"gid":118}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2906,"x":82,"y":148,"gid":294}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2907,"x":83,"y":148,"gid":295}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_trees","objectId":2908,"x":13,"y":149,"gid":314}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1202,"x":72,"y":147,"gid":762}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1203,"x":76,"y":147,"gid":761}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1839,"x":72,"y":144,"gid":702}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1840,"x":76,"y":144,"gid":701}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1841,"x":72,"y":145,"gid":722}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1842,"x":74,"y":145,"gid":685}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1843,"x":76,"y":145,"gid":721}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1844,"x":77,"y":145,"gid":725}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1845,"x":78,"y":145,"gid":685}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1846,"x":70,"y":146,"gid":703}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1847,"x":72,"y":146,"gid":742}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1848,"x":73,"y":146,"gid":745}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1849,"x":74,"y":146,"gid":705}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1850,"x":76,"y":146,"gid":741}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1851,"x":77,"y":146,"gid":745}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1852,"x":78,"y":146,"gid":704}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1853,"x":70,"y":147,"gid":723}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1854,"x":72,"y":147,"gid":685}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1855,"x":73,"y":147,"gid":765}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1856,"x":77,"y":147,"gid":765}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1857,"x":78,"y":147,"gid":724}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1858,"x":79,"y":147,"gid":725}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1859,"x":80,"y":147,"gid":685}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1860,"x":70,"y":148,"gid":743}`
- Evidence: missing name/type/class/template/properties

### BLANK_TILE_OBJECT: Blank tile object

- Severity: medium
- Category: tile_object
- Detail: Renderable tile objects should have a class, type, template, name, or semantic properties.
- Location: `{"objectLayerPath":"render_world/forest_region/forest_props","objectId":1861,"x":71,"y":148,"gid":745}`
- Evidence: missing name/type/class/template/properties

### SPAWN_REGION_LAYER_COUNT: Spawn and region layer inventory

- Severity: info
- Category: spawn_region
- Detail: Gameplay object layer counts are included for authoring review.
- Location: `{"map":"assets/maps/tiled/world.json","objectLayerPath":"resource_nodes"}`
- Evidence: objects=6

### SPAWN_REGION_LAYER_COUNT: Spawn and region layer inventory

- Severity: info
- Category: spawn_region
- Detail: Gameplay object layer counts are included for authoring review.
- Location: `{"map":"assets/maps/tiled/world.json","objectLayerPath":"static_entities"}`
- Evidence: objects=233

### SPAWN_REGION_LAYER_COUNT: Spawn and region layer inventory

- Severity: info
- Category: spawn_region
- Detail: Gameplay object layer counts are included for authoring review.
- Location: `{"map":"assets/maps/tiled/world.json","objectLayerPath":"chest_spawns"}`
- Evidence: objects=13

### SPAWN_REGION_LAYER_COUNT: Spawn and region layer inventory

- Severity: info
- Category: spawn_region
- Detail: Gameplay object layer counts are included for authoring review.
- Location: `{"map":"assets/maps/tiled/world.json","objectLayerPath":"chest_areas"}`
- Evidence: objects=8

### SPAWN_REGION_LAYER_COUNT: Spawn and region layer inventory

- Severity: info
- Category: spawn_region
- Detail: Gameplay object layer counts are included for authoring review.
- Location: `{"map":"assets/maps/tiled/world.json","objectLayerPath":"roaming_areas"}`
- Evidence: objects=23

### SPAWN_REGION_LAYER_COUNT: Spawn and region layer inventory

- Severity: info
- Category: spawn_region
- Detail: Gameplay object layer counts are included for authoring review.
- Location: `{"map":"assets/maps/tiled/world.json","objectLayerPath":"checkpoints"}`
- Evidence: objects=24

### MUSIC_REGION_LAYER_COUNT: Music zone inventory

- Severity: info
- Category: music_region
- Detail: Music zone counts are included for authoring review.
- Location: `{"map":"assets/maps/tiled/world.json","objectLayerPath":"music_zones"}`
- Evidence: objects=15

### COLLIDER_PASSABILITY_METADATA_GAP: Collider and passability metadata inventory

- Severity: medium
- Category: collision_passability
- Detail: Records whether an authored blocking layer exists alongside tileset collision metadata.
- Location: `{"map":"assets/maps/tiled/world.json"}`
- Evidence: blocking_layer=missing
