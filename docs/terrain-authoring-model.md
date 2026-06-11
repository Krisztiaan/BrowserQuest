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

Stardew-style reference assets under `/Users/krisztiaan/dev/stardew-assets/Maps` are used only to study organization: seasonal outdoor sheets, focused path and overlay sheets, shadows, water, cliffs, and building chunks. BrowserQuest must use its own assets or newly authored/generated assets.
