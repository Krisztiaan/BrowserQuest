# Map Authoring Review Log

## Review Rules

- Fix high-confidence audit findings when the existing assets and metadata make the fix deterministic.
- Use before/after images from `artifacts/map-authoring/visual/` for visual terrain decisions.
- Do not mark a region complete until terrain, overlay, collision, passability, objects, spawns, bounds, and music zones are checked.
- Do not perform unreviewed mass repainting or copy external commercial assets into the project.

## Regions

| Region | Coordinate bounds | Status | Evidence | Decision |
| --- | --- | --- | --- | --- |
| beach_biome | x 0-92, y 245-313 | open | `artifacts/map-authoring/visual/` | Needs shoreline asset work before final terrain review can pass. |
| village_biome | x 0-144, y 55-297 | open | `artifacts/map-authoring/visual/` | Needs village ground and riverbank transition assets before final terrain review can pass. |
| deadlands_biome | x 0-169, y 0-252 | open | `artifacts/map-authoring/visual/` | Needs dry/badlands transition review after generated transition assets exist. |
| badlands_biome | x 0-169, y 0-303 | open | `artifacts/map-authoring/visual/` | Needs lava boundary assets before final terrain review can pass. |
| subterranean_region | x 0-169, y 6-312 | open | `artifacts/map-authoring/visual/` | Needs cave rock, cave river, and lava cave asset decisions before final terrain review can pass. |
| forest_region | x 0-165, y 4-271 | open | `artifacts/map-authoring/visual/` | Needs forest edge and lake/riverbank transition assets before final terrain review can pass. |

## High-Confidence Findings

### Finding MAP_PROPERTIES_EMPTY

- Status: fixed
- Coordinates: map-level metadata in `assets/maps/tiled/world.json`
- Before image: not visual
- After image: not visual
- Decision: Added `map_id=world`, `authoring_version=1`, `default_music=world`, and `default_biome=mixed`.
- Verification: `bun run check:terrain-authoring` no longer reports `MAP_PROPERTIES_EMPTY`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS browserquest-carpets

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Keep current metadata until carpet transition shapes are either removed from transition expectations or backed by curated/generated mixed tiles.
- Verification: Remains a known asset/metadata blocker in `artifacts/map-authoring/terrain-authoring-audit.json`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS scaffold-shoreline

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Requires new shoreline edge, corner, inner-corner, island, and channel art before the region can be completed.
- Verification: Tracked as blocking asset work in `docs/terrain-asset-generation-plan.md`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS scaffold-riverbank

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Requires riverbank edge, corner, inner-corner, island, and channel art before map repainting is safe.
- Verification: Tracked as blocking asset work in `docs/terrain-asset-generation-plan.md`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS scaffold-village_ground

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Requires village ground transition art before final village terrain review can pass.
- Verification: Tracked as blocking asset work in `docs/terrain-asset-generation-plan.md`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS scaffold-field_edges

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Requires field edge transition art before final terrain review can pass.
- Verification: Tracked as blocking asset work in `docs/terrain-asset-generation-plan.md`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS scaffold-cave_rock

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Requires cave rock transition art and cave-mouth shape decisions before final subterranean review can pass.
- Verification: Tracked as blocking asset work in `docs/terrain-asset-generation-plan.md`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS scaffold-lava_rock

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Requires lava boundary and damage-boundary transition art before final badlands review can pass.
- Verification: Tracked as blocking asset work in `docs/terrain-asset-generation-plan.md`.

### Finding WANG_PAIR_HAS_NO_MIXED_TRANSITIONS scaffold-lava_cave

- Status: blocked
- Coordinates: `assets/maps/tiled/tilesheet.wang.tsj`
- Before image: `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- After image: none
- Decision: Requires a grammar decision plus lava-cave transition art before final cave/lava review can pass.
- Verification: Tracked as future grammar/art work in `docs/terrain-asset-generation-plan.md`.

## Gameplay Region Review

| Object layer | Status | Decision |
| --- | --- | --- |
| resource_nodes | open | Needs passability overlay review against reachable terrain. |
| static_entities | open | Needs blocked-terrain and depth-sorting review. |
| chest_spawns | open | Needs reachable-space review. |
| chest_areas | open | Needs reachable-space review. |
| doors | open | Door graph contracts already pass; visual placement still needs overlay review. |
| roaming_areas | open | Needs playable-space and blocked-terrain review. |
| music_zones | open | Needs region boundary review against authored biomes. |
| checkpoints | open | Needs spawn safety and collision review. |

## Collision And Passability Review

- Status: open
- Decision: Runtime parity checks and map validator pass, but browser overlay inspection remains required for at least one representative area per region.
- Verification target: `bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000` plus browser passability overlay review.
