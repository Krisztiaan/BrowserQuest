# Terrain Authoring Model

Base terrain owns the full cell. Overlay terrain is transparent decoration. Transition terrain connects two named base or liquid families and must declare its shape. Foreground terrain occludes entities and never fills base cells. Gameplay markup layers do not render and must stay invisible in Tiled.

The grammar in `assets/maps/tiled/terrain-authoring.json` defines:

- terrain families and passability semantics
- required transition shapes for terrain pairs
- layer roles for base fills, variations, transitions, liquids, damage, overlays, structures, foregrounds, and gameplay markup
- compositing rules that separate visual ownership from decoration and gameplay metadata

Wang colors in `assets/maps/tiled/tilesheet.wang.tsj` must carry the grammar semantics directly:

- `material`: the editor-facing material name for the color
- `terrain_family`: the matching family id from `terrain-authoring.json`
- `terrain_kind`: the family's `kind`
- `passability`: the family's passability contract

The terrain authoring audit treats missing, unknown, or grammar-mismatched Wang color metadata
as tileset findings. Transition art may still be incomplete, but the brush colors themselves
must name the authored terrain truth.

Tileset collision objects must carry semantic shape metadata:

- object `class`: `CollisionShape`
- `collision_kind`: typed `CollisionKind` enum, currently `solid` or `passable_carve`
- `blocks_player`, `blocks_mobs`, `blocks_projectiles`: booleans mirroring the current
  runtime collision rule

This metadata does not change runtime collision by itself. It makes the existing rule explicit:
tiles with collision objects block unless the tile has the legacy `passable` carve-out property.
The terrain authoring audit rejects missing shape metadata, untyped collision kinds, and blocking
flags that disagree with tile passability.

Renderable prop tiles can use `class: PropTile` to carry editor and runtime-facing structure:

- `asset_family`: preserves the legacy tile `type` family during migration
- `asset_part`: the tile's role inside a multi-tile assembly
- `tile_kind`: typed `TileKind` enum, normally `prop` for these records
- `occlusion_kind`: typed `TileOcclusionKind` enum such as `canopy`, `trunk`, or `none`
- `render_height`: non-negative integer rows above the prop base

The first enriched prop families are `tree_1`, `dead_tree_3`, and `palm_tree_1`.
Canopy/branch/frond rows are tagged as canopy occluders with descending render heights, trunk/root
rows carry trunk occlusion, and transparent padding, sparse ground-anchor, or shadow tiles are
explicitly non-occluding. The terrain authoring audit rejects incomplete prop tile metadata,
untyped semantic enums, asset-family/type mismatches, and negative render heights.

Structure tiles use the same semantic property set with `class: StructureTile` and
`tile_kind=structure`. The first enriched structure families are `house_blue_2` and
`house_red_1`; roof rows are tagged as roof occluders with higher render heights,
wall/foundation/entry rows are tagged as wall occluders, and blank padding tiles are explicitly
non-occluding. The audit validates both `PropTile` and `StructureTile` records through the same
semantic-tile contract while checking that the tile class and `tile_kind` agree.

Stardew-style reference assets under `/Users/krisztiaan/dev/stardew-assets/Maps` are used only to study organization: seasonal outdoor sheets, focused path and overlay sheets, shadows, water, cliffs, and building chunks. BrowserQuest must use its own assets or newly authored/generated assets.
