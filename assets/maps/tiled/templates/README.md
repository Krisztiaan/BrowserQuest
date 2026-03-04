# BrowserQuest Tiled Templates

Use these with Tiled's **Insert Template** tool (`V`) to avoid property/key drift.

## Templates

- `entity_spawn_rect.tx`: Rectangle object spawn marker (`EntitySpawn` with `mob_kind` + `mob_gid`).
- `entity_spawn_tile_rat.tx`: Tile object spawn marker using `mobs.tsj` (rat by default).
- `resource_node.tx`: Single-cell resource node marker (`ResourceNode` with `resource_gid`).
- `chest_spawn.tx`: Single-cell chest marker (`ChestSpawn` with `items` CSV).
- `chest_area.tx`: Rect chest area marker (`ChestArea` with `items`, `spawn_tx`, `spawn_ty`).
- `roaming_area.tx`: Area spawn template (`RoamingArea` with `mob_kind` + `count`).
- `zone.tx`: Zone rectangle (`Zone` with `zone_id`).
- `mobile_zone.tx`: Mobile zone rectangle (`MobileZone` with `zone_id`).
- `music_zone.tx`: Music area rectangle (`MusicZone` with `track_id`).
- `checkpoint.tx`: Checkpoint marker (`Checkpoint` with `checkpoint_id`, `spawn`).
- `door.tx`: Local door template (`Door`).
- `portal.tx`: Cross-map portal template (`Portal`).

## Authoring Notes

- Place single spawns in the `entity_spawns` object layer.
- Place resource/chest/roaming/zone objects in their matching canonical layers.
- Use `doors` layer for both `Door` and `Portal` objects.
- Keep object `class` set; keep object `type` empty.
- Use canonical property names only (`orientation`, `target_tx`, `target_ty`, `mob_kind`, `count`, etc.).
- For tile-object entity spawns, `mobs.tsj` uses `objectalignment=topleft`.
