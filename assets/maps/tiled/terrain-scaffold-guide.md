# Terrain Scaffold Guide (Tiled)

This repo now includes scaffold Wang sets and transition candidates to speed up manual terrain marking.

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
