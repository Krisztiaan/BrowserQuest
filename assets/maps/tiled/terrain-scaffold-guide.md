# Terrain Scaffold Guide (Tiled)

This repo now treats the authored Tiled assets as the source of truth:

- `assets/maps/tiled/world.json`
- `assets/maps/tiled/tilesheet.wang.tsj`
- `assets/maps/tiled/mobs.tsj`

Runtime map data is derived from those authored assets by the content pipeline. The goal of the scaffold/audit flow is to keep terrain semantics in Tiled-native metadata rather than in BrowserQuest-only conventions.

This repo includes scaffold Wang sets and transition candidates to speed up manual terrain marking.

These are diagnostics and authoring aids around the current legacy tilesheet, not proof that the existing art forms a complete or semantically clean Wang terrain model. The current sheet still mixes true terrain, alpha overlays, and structural trim, so treat the scaffold flow as inspection support rather than as a canonical terrain solution.

## Generated Assets

- `assets/maps/tiled/tilesheet.wang.tsj`
  - Source set: `browserquest-terrain`
  - Added pair scaffolds:
    - `scaffold-shoreline` (`water/sand`)
    - `scaffold-riverbank` (`water/grass`)
    - `scaffold-village_ground` (`sand/grass`)
    - `scaffold-field_edges` (`soil/grass`)
    - `scaffold-forest_edges` (`grass/forest`)
    - `scaffold-cave_rock` (`rock/cave`)
    - `scaffold-lava_rock` (`lava/rock`)
    - `scaffold-lava_cave` (`lava/cave`)
- `assets/maps/tiled/terrain-transition-candidates.json`
  - Per pair and per layer tile-id frequency hints from `world.json`.

## Authoring Flow

1. Open `tilesheet.wang.tsj` in Tiled.
2. Switch to **Terrain Sets** mode.
3. Pick one `scaffold-*` pair set.
4. Open the **Patterns** tab and mark missing transition patterns first.
5. Use `terrain-transition-candidates.json` to jump to likely transition tile IDs.
6. Keep marking until the pair’s missing patterns are acceptable.
7. Repeat for the next scaffold pair.
8. Return to map editing and use Terrain Brush with the relevant scaffold set.

## Refresh Script

Rebuild scaffolds + candidates after significant tileset/map edits:

`bun tools/content/tileset-wang-scaffold.ts --write`

## Audit Script

Audit the current authored terrain metadata against the actual tile usage in `world.json`:

`bun tools/content/tileset-wang-audit.ts`

This reports:

- Wang colors without representative tiles
- transition-source tiles used on the map but missing from the matching scaffold set
- transition-source tiles used on the map that still have no source Wang tag
- transition-source tiles whose source Wang tag mixes in colors from outside the intended pair

## Tiled Project Commands

`assets/maps/tiled/browserquest.tiled-project` exposes project commands for:

- rebuilding terrain scaffolds
- auditing Wang coverage
- standardizing the authored world
- validating `world.json`
- checking the derived runtime map pack

That keeps the authoring loop inside Tiled instead of relying on shell history.
