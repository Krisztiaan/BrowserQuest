# Terrain Asset Generation Plan

## Current State

- Current BrowserQuest sheet is a hand-packed prop/terrain sheet.
- Current Wang metadata is scaffold-level and incomplete.
- Current world has suspicious tiny terrain components and duplicate paints.
- `artifacts/map-authoring/terrain-grammar-report.json` currently reports 95 missing required transition shapes.
- `artifacts/map-authoring/terrain-authoring-audit.json` currently reports 161 terrain paint findings and 19 Wang tileset findings.

## Reference Pattern

Stardew assets are used as organizational reference only: seasonal outdoor sheets, focused overlay/path sheets, shadows, water, cliffs, and building chunks. BrowserQuest must use its own assets or newly authored/generated assets.

## Options

### Option A: Metadata-only repair

- Strengths: lowest image churn; preserves current tile IDs; easiest to review with `git diff` because only `.tsj` metadata changes.
- Weaknesses: cannot create missing visual shapes; current scaffold sets have zero mixed transitions for most terrain pairs; would leave rough edges and patchy transitions unresolved.

### Option B: Manual curated sheet

- Strengths: best final art quality; lets an artist intentionally match BrowserQuest style; can add missing edge, corner, inner-corner, island, channel, and overlay variants.
- Weaknesses: slowest path; requires careful tile ID allocation; every new tile needs metadata, passability, objectgroup, and map migration review.

### Option C: Generated transition overlays

- Strengths: fastest way to fill systematic edge/corner gaps; deterministic; can generate transparent overlays from masks and source base tiles.
- Weaknesses: generated tiles may look mechanical; needs visual QA; still requires manual polish for cliffs, water, lava, cave walls, and high-style areas.

### Option D: Hybrid generated base plus manual polish

- Strengths: uses generation to cover the full grammar and manual work where art quality matters most; keeps transitions complete while preserving room for richer authored regions.
- Weaknesses: requires both tooling and visual review; needs strict naming/metadata so generated and curated tiles do not drift.

## Recommendation

Use Option D. The audit and grammar evidence currently point away from metadata-only repair because the scaffold sets mostly lack mixed-transition entries, and the world already contains suspicious tiny components and duplicate paints that are easier to repair once complete transition art exists.

Do not create a prototype sheet in this ticket. The existing visual artifacts and grammar report are enough to choose the asset strategy. The next implementation ticket should generate a deterministic, non-runtime prototype only when it is ready to define exact source tile IDs, masks, output names, and metadata for the first real transition family.

## Missing Art by Pair

| Pair | Required missing shapes | Current candidate tile ids | New art needed | Notes |
| --- | --- | --- | --- | --- |
| shoreline | edge/corner/inner/island/channel family | representatives 405 water, 140 sand; current shoreline top-used 1819, 1780, 1799, 1800, 1920 | yes | Grammar report is missing all 15 required shoreline shapes. |
| riverbank | edge/corner/inner/island/channel family | representatives 405 water, 51 grass, 629 lake | yes | Grammar report is missing all 15 required riverbank shapes; audit usage includes lake/forest foreign-color cases. |
| village_ground | edge/corner/inner/island family | representatives 140 sand, 51 grass; current top-used 1011, 1010, 1032, 933, 953 | yes | Grammar report is missing all 13 required village ground shapes; audit usage includes many rock-tagged candidates. |
| field_edges | edge/corner/inner/island family | representatives 10 soil, 51 grass | yes | Grammar report is missing all 13 required field edge shapes. |
| forest_edges | edge/corner/inner/island family | representatives 51 grass, 112 forest | yes | Grammar report is missing all 13 required forest edge shapes; current metadata contains only a few mixed candidates. |
| cave_rock | edge/corner/inner/cliff-mouth family | representatives 17 rock, 3 cave | yes | Grammar report is missing all 12 required cave rock shapes. |
| lava_rock | edge/corner/inner/damage-boundary/channel family | representatives 1180 lava, 17 rock | yes | Grammar report is missing all 14 required lava rock shapes. |
| lava_cave | edge/corner/inner/damage-boundary family | representatives 1180 lava, 3 cave | yes | This pair is not yet in `terrain-authoring.json`; add it when the grammar expands beyond the current lava-to-badlands boundary. |

## Asset Model

- Generate transparent overlay transition tiles from named base families and masks for the systematic edge, corner, inner-corner, island, and channel shapes.
- Keep generated output in a separate authored transition sheet instead of rewriting `client/public/img/1/tilesheet.webp`.
- Reserve manual curation for water edges, lava boundaries, cliffs, cave mouths, and any area where generated masks produce visibly mechanical seams.
- Store each generated tile with source family IDs, source tile IDs, mask name, transition pair, transition shape, and generation version.
- Treat generated sheets as source assets only after review; prototype sheets must remain under `assets/maps/tiled/prototypes/` and must not be referenced by runtime map files.

## Next Steps

1. Add a deterministic transition prototype for one pair, preferably `shoreline`, only after selecting exact source tiles and mask names.
2. Extend the grammar with `lava_cave` if lava-cave boundaries are expected in authored maps.
3. Add metadata validation that every generated or curated transition tile declares `terrain_pair`, `transition_shape`, and source provenance.
4. Use the generated atlas and suspicious region contact sheets to prioritize manual polish after the first generated family is visible in Tiled.
