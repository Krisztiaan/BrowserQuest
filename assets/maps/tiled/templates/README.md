# BrowserQuest Tiled Templates

Use these with Tiled's **Insert Template** tool (`V`) to avoid property/key drift.

## Templates

- `static_entity_rect.tx`: Rectangle object static-entity marker (`StaticEntity` with `entity_kind` + `entity_gid`).
- `resource_node.tx`: Single-cell resource node marker (`ResourceNode` with `resource_gid`).
- `chest_spawn.tx`: Single-cell chest marker (`ChestSpawn` with `items` CSV).
- `chest_area.tx`: Rect chest area marker (`ChestArea` with `items`, `spawn_tx`, `spawn_ty`).
- `roaming_area.tx`: Area spawn template (`RoamingArea` with `mob_kind` + `count`).
- `music_zone.tx`: Music area rectangle (`MusicZone` with `track_id`).
- `checkpoint.tx`: Checkpoint marker (`Checkpoint` with `checkpoint_id`, `spawn`).
- `door.tx`: Local door template (`Door`).
- `door_linked.tx`: Graph-linked door template (`Door` with `door_id`, `target_map`, `target_door`, `local_tx`, `local_ty`).
- `portal.tx`: Cross-map portal template (`Portal`).
- `prop_metadata.tx`: Generic prop metadata object template (`PropMetadata`).
- `totem_ritual_anchor.tx`: Example depth-sorted tile-object prop template for a totem anchor tile.

## Authoring Notes

- Place static characters/items/NPCs in the `static_entities` object layer.
- Place resource, chest, roaming, music, and checkpoint objects in their matching canonical layers.
- Use `doors` layer for both `Door` and `Portal` objects.
- Graph-linked doors must define `door_id`, `target_map`, `target_door`, and `orientation`. They must not define raw `tx`/`ty` or redundant `target_tx`/`target_ty`; runtime destination coordinates come from the target door. Plain coordinate doors still use `target_tx`/`target_ty`. Reverse links are required unless the source door has `one_way=true`.
- Visible object layers can now contain decorative tile objects. Use a normal visible object layer for baked world props, or set the layer `class` to `Foreground` to export those tile objects into the map foreground bucket.
- For single authored props that should occlude entities by footprint depth instead of a coarse foreground pass, set the object layer `class` to `DepthSorted`. BrowserQuest will export connected tile-object assemblies from that layer as depth-sorted render props.
- Group layers are now first-class authoring structure. BrowserQuest flattens nested group layers, inheriting visibility, layer/object offsets, and group properties into child layers during export and validation.
- If a placed prop family is split across multiple visible layers, prefer fewer layers. Keep a separate foreground layer only when the split is for occlusion; do not split just to express collision, because collision already comes from the tile metadata. Use `bun tools/content/world-render-cluster-audit.ts` to spot repeated split assemblies.
- Keep object `class` set; keep object `type` empty.
- Use canonical property names only (`orientation`, `target_tx`, `target_ty`, `entity_kind`, `entity_gid`, `mob_kind`, `count`, etc.), and keep those properties on the object types that actually consume them.
- For tile-object static entities, `mobs.tsj` uses `objectalignment=topleft`.

## Prop Metadata Conventions

- `DepthSorted` layer class is now defined in the Tiled project and can carry:
  - `prop_family`: stable authored family name such as `forest_props` or `beach_props`
  - `prop_kind`: semantic kind such as `totem`, `shrub`, `tent`, `house`
  - `biome`: biome or region tag inherited by child props
  - `tags`: comma-separated tags for authoring and downstream tooling
  - `depth_mode`: `collision`, `bottom`, `top`, or `explicit`
  - `depth_offset`: integer offset applied to computed depth row
  - `depth_row`: explicit depth row when needed
- Tile objects on `DepthSorted` layers may also use the `PropMetadata` object class to override those same values per instance.
- Prop templates are valid on visible `DepthSorted` object layers as long as the placed object still resolves to a native-size tile object. Keep explicit object data in sync if you are hand-editing JSON.
- Exported render props now retain `layer`, `layerPath`, optional `groupPath`, and the resolved metadata above. That makes Tiled group/layer/object semantics available to runtime tooling without forcing meaning into layer names.
- `editor-markers.tsj` is an editor-only marker tileset for invisible/object markup layers. It uses `objectalignment=topleft` so adding marker `gid`s to non-renderable gameplay objects does not change their authored coordinate semantics.
