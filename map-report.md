# world.json Investigation Report

## Session Context
- Repository: `BrowserQuest`
- Target file: `assets/maps/tiled/world.json`
- Start time: `2026-02-25 21:25:36 CET`
- Last major analysis checkpoint: `2026-02-26 13:42:16 CET`
- Constraint followed: independent analysis only (no in-repo exporter as source of truth).

## Requirements Checklist
- [x] Review layer model and identify why it feels broken/disorganized.
- [x] Investigate tile `[3]` / `gid 4` ambiguity.
- [x] Use multi-agent independent investigation.
- [x] Capture caveats + non-idiomatic/nonstandard patterns.
- [x] Produce hypothesis + practical improvement options.

## Follow-up Task (2026-02-25): Migration Checklist + Validator

### Follow-up Ticket Board

#### Ticket A — Concrete Migration Scope (`done`)
- Scope:
  - Included: exact layer-by-layer migration edits and acceptance checks.
  - Out of scope: directly modifying `world.json` content in this pass.
- Acceptance criteria:
  - Every existing layer has an explicit migration action.
  - Migration phases are executable and testable.
- Verification plan:
  - Cross-check checklist layer count coverage against current 70-layer inventory.
- Dependencies / blockers:
  - Dependency: completed forensic findings in this document.
  - Blockers: none.

#### Ticket B — Validation Script (`done`)
- Scope:
  - Included: standalone world-map validator (independent of exporter code).
  - Out of scope: using existing pack/export toolchain logic.
- Acceptance criteria:
  - Script runs against `world.json` and emits actionable diagnostics.
  - Script supports migration-focused checks.
- Verification plan:
  - Run validator in at least one passing mode and one intentionally strict mode.
- Dependencies / blockers:
  - Dependency: Ticket A target rules.
  - Blockers: none.

#### Ticket C — Reported Handoff (`done`)
- Scope:
  - Included: documented commands, outcomes, and how to use checklist + validator.
  - Out of scope: applying migration itself.
- Acceptance criteria:
  - `map-report.md` includes follow-up progress, evidence, and outcomes.
- Verification plan:
  - Final pass for internal consistency and command reproducibility.
- Dependencies / blockers:
  - Dependency: Tickets A and B complete.
  - Blockers: none.

### Follow-up Live Progress Log

#### Ticket A
- Start timestamp: `2026-02-25 23:48:30 CET`
- Current status: `done`
- Key actions taken:
  - Produced concrete migration contract in `map-migration-checklist.md`.
  - Included canonical 68-layer target order and exact legacy→target mapping for all 70 legacy layers.
- Evidence:
  - `wc -l map-migration-checklist.md` → `198`
  - `rg -n '^\\| [0-9]+' map-migration-checklist.md | wc -l` → `70`
- Next action:
  - Build independent validator that enforces checklist contract.

#### Ticket B
- Start timestamp: `2026-02-25 23:52:10 CET`
- Current status: `done`
- Key actions taken:
  - Added standalone validator script at `tools/content/world-map-validator.ts`.
  - Added package scripts:
    - `check:world-map:legacy`
    - `check:world-map:target`
- Evidence:
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy`
    - Exit: `0`
    - Summary: `0 errors, 95 warnings, 0 infos`
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target`
    - Exit: `1`
    - Summary: `975 errors, 0 warnings, 0 infos`
- Notable errors / workaround:
  - Initial string-escape syntax error in validator; fixed and reran.
- Next action:
  - Record usage and handoff details in report.

#### Ticket C
- Start timestamp: `2026-02-25 23:56:20 CET`
- Current status: `done`
- Key actions taken:
  - Documented migration checklist + validator commands and expected behavior.
  - Confirmed strict target profile currently fails as expected pre-migration.
- Evidence:
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` summary → `{"errors":0,"warns":95,"infos":0}`
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` summary → `{"errors":975,"warns":0,"infos":0}`
- Next action:
  - Ready to execute the migration itself in a separate pass.

## Execution Task (2026-02-26): Passes 1+2 Applied To `world.json`

### Execution Ticket Board

#### Ticket D — Backup + Mechanical Pass 1 (`done`)
- Scope:
  - Included: backup current `world.json`, execute first mechanical rename/property-normalization pass.
  - Out of scope: full semantic conversion of tilelayers to objectgroups.
- Acceptance criteria:
  - Backup file exists as `assets/maps/tiled/world.original.json`.
  - `world.json` updated with pass-1 changes and remains valid JSON.
- Verification plan:
  - Run `world-map-validator` in `legacy` and `target` profiles after pass.
- Dependencies / blockers:
  - Dependency: migration checklist + validator already in place.
  - Blockers: none.

#### Ticket E — Pass 2 Semantic Normalization (`done`)
- Scope:
  - Included: resolve remaining target-validator errors after pass-1.
  - Out of scope: gameplay-level tuning of portal destinations or zone topology.
- Acceptance criteria:
  - Target validator reaches `0` errors.
  - Legacy validator remains clean (`0` errors).
- Verification plan:
  - Re-run validator profiles after pass-2.
- Dependencies / blockers:
  - Dependency: Ticket D pass-1 complete.
  - Blockers: none.

#### Ticket F — Portal Metadata Curation (`done`)
- Scope:
  - Included: replace temporary autofill portal identifiers with deterministic curated values.
  - Out of scope: changing portal coordinates or gameplay routing geometry.
- Acceptance criteria:
  - No portal object keeps `autofill_*` placeholders.
  - Legacy and target validators remain fully green.
- Verification plan:
  - Inspect portal objects and rerun validator profiles after curation.
- Dependencies / blockers:
  - Dependency: Ticket E complete.
  - Blockers: none.

#### Ticket G — Door Link Consistency Sweep (`done`)
- Scope:
  - Included: verify door link integrity (`target_door` → `door_id`), auto-resolve world portal mismatches, and generate mismatch report.
  - Out of scope: gameplay-level redesign of portal network.
- Acceptance criteria:
  - Mismatch report generated with clear classification.
  - In-world portal links explicitly validated.
- Verification plan:
  - Scan `world.json` and (where present) related tiled maps for door IDs/references.
- Dependencies / blockers:
  - Dependency: Ticket F complete.
  - Blockers: none.

### Execution Live Progress Log

#### Ticket D
- Start timestamp: `2026-02-26 12:06:17 CET`
- Current status: `done`
- Key actions taken:
  - Backed up `assets/maps/tiled/world.json` to `assets/maps/tiled/world.original.json`.
  - Added and executed pass-1 transformer `tools/content/world-migrate-pass1.ts`.
  - Applied mechanical transformations:
    - removed sentinel and `portals` layers,
    - renamed/reordered layers to target contract order,
    - normalized object properties for `doors`, `chest_areas`, `roaming_areas`, `music_zones`,
    - added `zone_id` / `checkpoint_id` IDs where required by pass-1 contract.
- Evidence:
  - Backup:
    - `cp assets/maps/tiled/world.json assets/maps/tiled/world.original.json`
    - `ls -l assets/maps/tiled/world.original.json` → `37290301` bytes
    - `shasum -a 256 assets/maps/tiled/world.original.json assets/maps/tiled/world.json`
  - Pass execution:
    - `bun tools/content/world-migrate-pass1.ts --map assets/maps/tiled/world.json --write`
    - Result: `layerCountAfter=68`, `removedLayers=2`, `renamedLayers=45`, `renamedProperties=408`, `addedZoneIds=153`, `addedMobileZoneIds=40`, `addedCheckpointIds=24`
  - Structural check:
    - layer count now `68`
    - sentinel removed (`hasSentinel=false`)
    - `portals` layer removed (`hasPortals=false`)
  - Validation:
    - `legacy` profile summary: `0 errors, 62 warnings, 0 infos` (improved from `95` warnings pre-pass)
    - `target` profile summary: `85 errors, 0 warnings, 0 infos` (improved from `975` errors pre-pass)
- Next action:
  - Execute pass-2 semantic conversion (`resource_nodes` / `static_entities` tilelayers → objectgroups) and resolve remaining target errors.

#### Ticket E
- Start timestamp: `2026-02-26 12:12:25 CET`
- Current status: `done`
- Key actions taken:
  - Added and executed `tools/content/world-migrate-pass2.ts`.
  - Converted hidden tilelayers to objectgroups:
    - `resource_nodes`: 6 objects with `resource_gid`
    - `static_entities`: 233 objects with `entity_gid`
  - Filled missing portal routing fields for legacy portal door objects.
  - Clamped 3 out-of-bounds objects back into map bounds.
  - Renamed 59 empty tileset property names (`legacy_empty`) to satisfy target contract.
- Evidence:
  - `bun tools/content/world-migrate-pass2.ts --map assets/maps/tiled/world.json --write`
    - Result: `convertedResourceNodes=6`, `convertedEntitySpawns=233`, `addedPortalFields=21`, `clampedObjects=3`, `renamedEmptyTileProperties=59`, `nextobjectid=600`
  - Post-pass structure:
    - `resource_nodes` → `objectgroup` (`objects=6`)
    - `static_entities` → `objectgroup` (`objects=233`)
    - map layer count remains `68`
  - Validation:
    - `legacy` profile summary: `0 errors, 0 warnings, 0 infos`
    - `target` profile summary: `0 errors, 0 warnings, 0 infos`
- Next action:
  - Migration gate is green; next work is optional gameplay-level tuning of autofilled portal metadata.

#### Ticket F
- Start timestamp: `2026-02-26 12:26:19 CET`
- Current status: `done`
- Key actions taken:
  - Audited portal metadata in both `world.json` and `world.original.json`.
  - Added and executed `tools/content/world-curate-portals.ts`.
  - Replaced all `autofill_*` portal identifiers with deterministic coordinate-derived IDs.
- Evidence:
  - `bun tools/content/world-curate-portals.ts --map assets/maps/tiled/world.json --write`
    - Result: `portalCount=7`, `changedProperties=14`
    - Assignments include:
      - `door_id=world_portal_77_237`, `target_door=world_portal_82_234`
      - `door_id=world_portal_82_234`, `target_door=world_portal_77_237`
      - `door_id=world_portal_166_33`, `target_door=world_portal_160_35`
  - Post-curation check:
    - `autofillPortals=0`
  - Validation:
    - `legacy` profile summary: `0 errors, 0 warnings, 0 infos`
    - `target` profile summary: `0 errors, 0 warnings, 0 infos`
- Next action:
  - Portal metadata curation complete.

#### Ticket G
- Start timestamp: `2026-02-26 13:39:26 CET`
- Current status: `done`
- Key actions taken:
  - Audited door links across all tiled maps containing `doors` layers.
  - Found 5 unresolved references (all in `world` portal links).
  - Updated `tools/content/world-curate-portals.ts` to resolve unresolved world portal links to nearest existing portal.
  - Executed curation and generated dedicated report `map-door-link-report.md`.
- Evidence:
  - Pre-fix audit:
    - `mapsWithDoors=55`, `totalRefs=211`, `resolved=206`, `unresolved=5`
  - Auto-resolution run:
    - `bun tools/content/world-curate-portals.ts --map assets/maps/tiled/world.json --write`
    - Result: `unresolvedBefore=5`, `reassignedToNearest=5`, `changedProperties=5`
  - Post-fix audit:
    - `mapsWithDoors=55`, `totalRefs=211`, `resolved=211`, `unresolved=0`
  - Validation:
    - `legacy` profile summary: `0 errors, 0 warnings, 0 infos`
    - `target` profile summary: `0 errors, 0 warnings, 0 infos`
- Next action:
  - Door-link integrity is now fully resolved; no open mismatch remains.

## Execution Task (2026-02-26): Exterior Void Nulling (`tile id 3` / `gid 4`)

### Execution Ticket Board

#### Ticket H — Null Exterior `gid 4` While Preserving Enclosed Areas (`done`)
- Scope:
  - Included: remove `tilesheet` tile id `3` (`gid 4`) where connected to exterior space.
  - Included: preserve `gid 4` cells enclosed by non-`gid 4` tiles across tilelayers.
  - Out of scope: resplitting maps / runtime pack regeneration.
- Acceptance criteria:
  - Exterior-connected `gid 4` cells are nulled to `0`.
  - Enclosed interior `gid 4` regions remain.
  - Legacy/target validators stay fully green.
- Verification plan:
  - Dry run for before/after counts by layer.
  - Write run on `assets/maps/tiled/world.json`.
  - Re-run validator profiles and confirm zero errors.
- Dependencies / blockers:
  - Dependency: validated post-migration `world.json`.
  - Blockers: none.

### Execution Live Progress Log

#### Ticket H
- Start timestamp: `2026-02-26 18:12:48 CET`
- Current status: `done`
- Key actions taken:
  - Added independent transformer `tools/content/world-null-outside-void.ts`.
  - Implemented boundary flood-fill over cells not occupied by non-`gid 4` tiles.
  - Applied nulling only to `gid 4` cells connected to exterior; kept enclosed pockets.
- Evidence:
  - Dry run:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json`
    - Totals: `before=9086`, `removed=7328`, `kept=1758`.
    - Layer deltas:
      - `cave`: `6055 -> 1222` kept (`4833` removed)
      - `indoor`: `1543 -> 219` kept (`1324` removed)
      - `maze_floor`: `1479 -> 308` kept (`1171` removed)
      - `canyon`: `9 -> 9` kept (`0` removed)
  - Write run:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json --write`
  - Post-write validation:
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` summary → `{"errors":0,"warns":0,"infos":0}`
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` summary → `{"errors":0,"warns":0,"infos":0}`
  - Idempotence check:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json`
    - Totals after write: `before=1758`, `removed=0`, `outsideTargetCells=0`.
- Next action:
  - Optional: apply the same transformation to split tiled maps and regenerate runtime pack.

#### Ticket I — Peel First Occluding Ring For `gid 4` (`done`)
- Scope:
  - Included: relax nulling so first occluding tile ring does not preserve `gid 4`.
  - Included: make occlusion peeling configurable for repeatable future passes.
  - Out of scope: introducing layer-specific hardcoded exceptions.
- Acceptance criteria:
  - Script supports configurable occlusion depth.
  - Running with depth `1` removes additional under-occluder `gid 4` while keeping validators green.
  - Re-run at same depth is idempotent.
- Verification plan:
  - Dry run with `--occlusion-depth 1`.
  - Write run and then legacy/target validator checks.
  - Idempotence dry run after write.
- Dependencies / blockers:
  - Dependency: Ticket H baseline script.
  - Blockers: none.

#### Ticket I
- Start timestamp: `2026-02-26 18:18:37 CET`
- Current status: `done`
- Key actions taken:
  - Updated `tools/content/world-null-outside-void.ts` with `--occlusion-depth`.
  - Replaced strict exterior flood with depth-based blocker-crossing reachability.
  - Applied depth-1 write pass to null `gid 4` under the first occluding ring.
- Evidence:
  - Dry run:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json --occlusion-depth 1`
    - Totals: `before=1758`, `removed=1071`, `kept=687`.
    - Layer deltas:
      - `cave`: `1222 -> 559` kept (`663` removed)
      - `indoor`: `219 -> 13` kept (`206` removed)
      - `maze_floor`: `308 -> 106` kept (`202` removed)
      - `canyon`: `9 -> 9` kept (`0` removed)
  - Write run:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json --occlusion-depth 1 --write`
  - Post-write validation:
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` summary → `{"errors":0,"warns":0,"infos":0}`
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` summary → `{"errors":0,"warns":0,"infos":0}`
  - Idempotence:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json --occlusion-depth 1`
    - Totals after write: `before=687`, `removed=0`, `outsideTargetCells=0`.
- Next action:
  - Optional: run this same depth-1 pass across split tiled maps before rebuilding runtime pack.

#### Ticket J — Cull `tile_id 27` Stragglers + Transparency-Aware Soft Blockers (`done`)
- Scope:
  - Included: cull `tile_id 27` (`gid 28`) together with `tile_id 3` (`gid 4`) when reachable by the same nulling pass.
  - Included: detect transition blockers via tileset border transparency and treat them as soft blockers.
  - Out of scope: map splitting/runtime pack regeneration.
- Acceptance criteria:
  - Nulling tool supports secondary removable tile IDs.
  - Nulling tool supports transparency-aware blocker detection from tileset image.
  - `world.json` remains validator-clean after applying pass.
- Verification plan:
  - Dry-run with secondary tile ID and transparency soft-blocker mode.
  - Write run with selected thresholds.
  - Idempotence check with same settings.
- Dependencies / blockers:
  - Dependency: Ticket I.
  - Blockers: none.

#### Ticket J
- Start timestamp: `2026-02-26 18:29:49 CET`
- Current status: `done`
- Key actions taken:
  - Extended `tools/content/world-null-outside-void.ts` with:
    - `--also-tile-ids <csv>` for secondary cull set (used: `27`),
    - `--enable-transparent-soft` + `--soft-border-min-ratio` + `--alpha-threshold`,
    - transparent-border gid detection via `python3` + Pillow against `tilesheet.webp`,
    - weighted reachability (`hard blockers` cost 1, `transparent-border soft blockers` cost 0).
  - Applied pass with depth-1 peeling plus transparency soft blockers.
- Evidence:
  - Write run:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json --occlusion-depth 1 --also-tile-ids 27 --enable-transparent-soft --soft-border-min-ratio 0.15 --alpha-threshold 0 --write`
    - `removableGids=[4,28]`, `transparentSoftCount=885`
    - Totals: `before=695`, `removed=579`, `kept=116`
    - Per-gid:
      - `gid 4`: `687 -> 116` kept (`571` removed)
      - `gid 28`: `8 -> 0` kept (`8` removed)
    - Per-layer:
      - `cave`: `567 -> 102` kept (`465` removed)
      - `indoor`: `13 -> 0` kept (`13` removed)
      - `maze_floor`: `106 -> 5` kept (`101` removed)
      - `canyon`: unchanged `9`
  - Post-write validation:
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` summary → `{"errors":0,"warns":0,"infos":0}`
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` summary → `{"errors":0,"warns":0,"infos":0}`
  - Idempotence:
    - `bun tools/content/world-null-outside-void.ts --map assets/maps/tiled/world.json --occlusion-depth 1 --also-tile-ids 27 --enable-transparent-soft --soft-border-min-ratio 0.15 --alpha-threshold 0`
    - Totals after write: `before=116`, `removed=0`, `outsideRemovableCells=0`.
- Next action:
  - Optional: tune `--soft-border-min-ratio` (e.g. `0.10` vs `0.15`) for stricter/looser transition-cull behavior.

#### Ticket K — Migrate Legacy `c` Collision Markers To Tile `objectgroup` (`done`)
- Scope:
  - Included: migrate tileset collision semantics from custom property `c` to Tiled-standard tile `objectgroup`.
  - Included: remove parser reliance on `c` (strict objectgroup-only collision marker).
  - Out of scope: fallback support for mixed `c` + objectgroup pipelines.
- Acceptance criteria:
  - `tilesheet` metadata has no remaining `c` properties.
  - Tiles previously using `c` now carry tile collision `objectgroup`.
  - Map-pack build/check and world validators remain green.
- Verification plan:
  - Dry-run migration counts.
  - Write migration for `tilesheet.wang.tsj` and embedded `world.json` tileset.
  - Run map-pack check + focused tests + validators.
- Dependencies / blockers:
  - Dependency: existing map cleanup state.
  - Blockers: none.

#### Ticket K
- Start timestamp: `2026-02-26 22:26:26 CET`
- Current status: `done`
- Key actions taken:
  - Added migration utility `tools/content/tileset-migrate-c-to-objectgroup.ts`.
  - Converted `c` collision properties into full-tile collision objectgroups on:
    - `assets/maps/tiled/tilesheet.wang.tsj`
    - `assets/maps/tiled/world.json` (embedded `tilesheet` tileset)
  - Updated `shared/maps/processmap.ts` collision extraction to use tile `objectgroup.objects` only (removed `c` marker parsing).
- Evidence:
  - Dry run:
    - `bun tools/content/tileset-migrate-c-to-objectgroup.ts`
    - Totals: `tilesWithLegacyC=948`, `convertedObjectgroups=948`.
  - Write run:
    - `bun tools/content/tileset-migrate-c-to-objectgroup.ts --write`
  - Post-migration audit:
    - `tilesheet.wang.tsj`: `c=0`, `obj=474`
    - `world.json` embedded tileset: `c=0`, `obj=474`
  - Build/test/validation:
    - `bun tools/content/map-pack.ts check --config assets/maps/tiled/map-pack.config.json` → up to date.
    - `bun test tests/unit/map-pack.test.ts` → `13 pass`, `0 fail`.
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` → `0 errors`.
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` → `0 errors`.
- Next action:
  - Optional: if desired, add CI lint to reject future reintroduction of tile property `c`.

## TODO / Ticket Board

### Ticket 1 — Raw File Inventory (`done`)
- Scope:
  - Included: file shape, top-level keys, layer counts/types, dimensions, tileset metadata.
  - Out of scope: runtime code behavior.
- Acceptance criteria:
  - Top-level schema and layer inventory documented with command-backed evidence.
  - Tile domain/range and obvious anomalies identified.
- Verification plan:
  - Direct JSON extraction on `world.json`.
- Verification outcome:
  - Passed via Node CLI probes (schema, layer catalog, gid domain checks).
- Dependencies / blockers:
  - Dependency: readable JSON file.
  - Blockers: none.

### Ticket 2 — Data Pattern & Caveat Analysis (`done`)
- Scope:
  - Included: gid distributions, layer overlap, object metadata quality, spatial partition caveats.
  - Out of scope: modifying map content.
- Acceptance criteria:
  - Reproducible evidence per major caveat.
  - Explicit uncertainty where semantics are inferred.
- Verification plan:
  - Repeatable scripts for per-layer stats, overlap matrices, and object schemas.
- Verification outcome:
  - Passed; evidence captured below with commands/results.
- Dependencies / blockers:
  - Dependency: Ticket 1.
  - Blockers: none.

### Ticket 3 — Parallel Subagent Independent Review (`done`)
- Scope:
  - Included: independent parallel forensic reads by subagents.
  - Out of scope: exporter code.
- Acceptance criteria:
  - At least two independent reports reconciled.
  - Agreement/disagreement matrix documented.
- Verification plan:
  - Spawn explorer subagents and merge outputs.
- Verification outcome:
  - Passed; 3 subagents completed (`Basil`, `Apple`, `Daisy`).
- Dependencies / blockers:
  - Dependency: Ticket 1 baseline.
  - Blockers: none.

### Ticket 4 — Synthesis & Improvement Proposals (`done`)
- Scope:
  - Included: hypotheses about current design, risks, and modernization options.
  - Out of scope: implementing migrations.
- Acceptance criteria:
  - Actionable improvement paths with tradeoffs.
  - Recommendations tied to observed evidence.
- Verification plan:
  - Critical reviewer pass on top failure-prone claims.
- Verification outcome:
  - Passed via targeted rechecks (gid ambiguity, portal dual-source mismatch, canyon/cliffs underlay).
- Dependencies / blockers:
  - Dependency: Tickets 1–3.
  - Blockers: none.

## Live Progress Log

### Ticket 1
- Start timestamp: `2026-02-25 21:25:36 CET`
- Current status: `done`
- Key actions taken:
  - Parsed top-level map schema and tilesets.
  - Enumerated all layer metadata (70 layers, names/types/visibility/density).
  - Verified gid domain bounds and tileset split.
- Evidence:
  - `world.json` size: `37,290,301` bytes.
  - Map dims: `172x314`, tile size `16x16`, `infinite=false`, `orientation=orthogonal`.
  - Layers: `62` tilelayers + `8` objectgroups.
  - Tilesets: `tilesheet(firstgid=1,tilecount=1960)` and `Mobs(firstgid=1961,tilecount=240)`.
- Next action:
  - Move to value-distribution and overlap caveats.

### Ticket 2
- Start timestamp: `2026-02-25 21:31:00 CET` (continuous execution after Ticket 1 extraction)
- Current status: `done`
- Key actions taken:
  - Computed per-layer nonzero counts, bbox coverage, dominant gid composition, pairwise overlaps, and object property schemas.
  - Analyzed hidden functional layers (`blocking`, `plateau`, `entities`, `portals`, `minerals`).
  - Investigated tile `[3]` vs gid behavior directly.
- Evidence highlights:
  - Total tile cells across all tilelayers: `3,348,496`; nonzero: `69,694` (`~2.08%`), zero: `3,278,802`.
  - Hidden sentinel layer exists: `"don't remove this layer"` with `0` nonzero tiles.
  - `gid 3` total usage: `0`; `gid 4` usage: `9,086`; `gid 1964` usage: `8` (in `entities`).
  - `gid 4` appears only in `cave`, `indoor`, `mase`, and minorly `canyon`.
  - `blocking` is single-gid mask (`24`) and `plateau` is single-gid mask (`27`).
- Notable errors / workaround:
  - One shell quoting error (`zsh: bad substitution`) during object-property extraction.
  - Workaround applied by removing template literals and rerunning successfully.
- Next action:
  - Reconcile with independent subagent reports.

### Ticket 3
- Start timestamp: `2026-02-25 21:44:10 CET`
- Current status: `done`
- Key actions taken:
  - Spawned 3 explorer subagents with independent scopes:
    - `Basil`: schema/layer-order/non-idiomatic structure.
    - `Apple`: gid semantics with focus on tile index `[3]` ambiguity.
    - `Daisy`: spatial partition/zones overlaps/technical debt.
  - Merged and cross-checked agreement points.
- Evidence:
  - All 3 subagents completed with consistent conclusions on:
    - giant uncompressed single-map layout,
    - heavy hidden metadata usage,
    - gid/layer semantic overload,
    - severe zones/mobile-zones structure debt.
- Next action:
  - Produce final synthesis + improvements.

### Ticket 4
- Start timestamp: `2026-02-25 21:46:00 CET`
- Current status: `done`
- Key actions taken:
  - Built unified interpretation model (what likely means what).
  - Added practical modernization path with verification strategy.
  - Ran critical reviewer pass on top risky claims.
- Critical reviewer pass evidence:
  - Confirmed `gid3` is unused while `gid4` is overloaded.
  - Confirmed all 9 canyon `gid4` cells are also under nonzero `Cliffs` tiles.
  - Confirmed portal dual-source mismatch: `portals` tilelayer has 5 entries, `doors(type=portal)` has 7.
- Next action:
  - Hand off report.

## Findings

### 1) Core Map Shape (What This File Actually Is)
- This is one very large Tiled map (`tiledversion 1.11.2`) that stores many gameplay “submaps” in one sheet.
- Spatial envelope: `2752x5024 px` (`172x314` tiles at `16x16`).
- Layer stack is deep (`70` layers), but actual paint density is low (`~2.08%` nonzero across all tilelayer cells).
- The file is huge because every tilelayer stores full uncompressed `data[]` arrays (`54008` entries each), even when mostly empty.

### 2) Layer Organization: What’s Weird vs What’s Intentional
- Pattern is mostly: visible art layers first, hidden functional layers late.
- Hidden tilelayers used as logic masks:
  - `blocking` (`gid 24` only), `plateau` (`gid 27` only), `portals` (`gid 1586` only), `entities`, `minerals`.
- Hidden objectgroups handle game rules:
  - `doors`, `chests`, `chestareas`, `roaming`, `zones`, `music`, `checkpoints`, `mobile zones`.
- Non-idiomatic/disorganized signals:
  - sentinel layer name: `"don't remove this layer"` (empty data),
  - mixed naming styles/casing (`Houses`, `Bridge`, `cavewalls`, `groundvariations`),
  - typo-like naming (`mase`, `mase walls`),
  - mixed representation of similar concepts (some logic via tilelayers, some via objectgroups).

### 3) Tile `[3]` Ambiguity (Key Requested Deep-Dive)
- Important distinction:
  - Tile index `3` in `tilesheet` maps to global `gid 4` (`firstgid 1 + id 3`).
  - Tile index `3` in `Mobs` maps to global `gid 1964` (`firstgid 1961 + id 3`).
- Evidence:
  - `gid 3` is never used (`0` occurrences).
  - `gid 4` occurs `9,086` times across only 4 layers:
    - `cave`: `6,055`
    - `indoor`: `1,543`
    - `mase`: `1,479`
    - `canyon`: `9`
  - `gid 1964` occurs `8` times in `entities`.
- Interpretation:
  - “tile [3] can be ground or outside filler” is plausible only when interpreted as `gid 4` + layer context.
  - On this map, `gid 4` is not globally semantic by itself; semantics are layer-driven.

### 4) Evidence of Semantic Overload
- Same gid can be reused for different purposes depending on layer name.
- `gid 4` behavior:
  - dominant fill in `cave`, `indoor`, `mase`,
  - small underlay in `canyon` (all 9 canyon `gid4` points overlap nonzero `Cliffs`).
- “Boundary” layers reuse many gids from visual cliff/wall layers.
  - This makes gid-only logic fragile; `(layer, gid)` is the only safe key.

### 5) Spatial Partition / Zoning Caveats

## Execution Task (2026-02-27): Replace `v` High-Tile Metadata With Explicit Foreground Layers

### Execution Ticket Board

#### Ticket L — Define Foreground-Layer Contract + Validator Updates (`done`)
- Scope:
  - Included: replace tile-property-driven over-entity behavior (`v`) with explicit tilelayers.
  - Included: keep strict canonical base/object layer ordering while allowing explicit foreground extras.
  - Out of scope: monolithic-to-world-file split strategy.
- Acceptance criteria:
  - Target validator accepts canonical layers + explicit foreground layers.
  - Foreground layer eligibility is strict and machine-checkable.
- Verification plan:
  - Run target+legacy validator on `world.json`.
- Dependencies / blockers:
  - Dependency: existing world standardization baseline.
  - Blockers: none.

#### Ticket M — Implement Data/Runtime Migration (`done`)
- Scope:
  - Included: map-pack schema update, runtime payload/model update, renderer behavior update.
  - Included: new migration utility to move high tiles into explicit foreground layers and remove `v`.
  - Out of scope: compatibility fallback for legacy `high` payload.
- Acceptance criteria:
  - Runtime payload emits `foreground` and no `high`.
  - Client rendering path draws explicit foreground layers after entities.
  - Migration utility is idempotent.
- Verification plan:
  - Build/check map-pack.
  - Unit tests for map-pack/map-source/renderer + map-registry/preflight.
  - Dry-run migration after write yields zero deltas.
- Dependencies / blockers:
  - Dependency: Ticket L contract.
  - Blockers: none.

#### Ticket N — Apply Migration to Tiled Content (`done`)
- Scope:
  - Included: apply migration across current tiled JSON map set, including `world.json` and split maps.
  - Included: remove `v` tile properties from external tileset source.
  - Out of scope: gameplay topology changes.
- Acceptance criteria:
  - Foreground layers created for affected maps with strict marker property.
  - `tilesheet.wang.tsj` contains no remaining `v` properties.
  - `world.json` validators remain fully green.
- Verification plan:
  - Run migration write pass + dry idempotence pass.
  - Run world validators.
  - Inspect runtime map-pack sample payload shape.
- Dependencies / blockers:
  - Dependency: Ticket M implementation.
  - Blockers: none.

### Execution Live Progress Log

#### Ticket L
- Start timestamp: `2026-02-27 00:07:44 CET`
- Current status: `done`
- Key actions taken:
  - Updated target-layer validator contract to enforce:
    - strict canonical base tilelayer order,
    - explicit foreground-only middle band (`*_foreground` + `bq_foreground=true`),
    - strict canonical objectgroup tail order.
- Evidence:
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` → `0 errors`.
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` → `0 errors`.
- Next action:
  - Implement runtime/data model migration.

#### Ticket M
- Start timestamp: `2026-02-27 00:13:19 CET`
- Current status: `done`
- Key actions taken:
  - Added migration utility `tools/content/maps-migrate-v-to-foreground.ts`.
  - Updated runtime map pipeline:
    - `shared/maps/processmap.ts`: emits `foreground`, consumes layer property `bq_foreground`, drops `high` extraction.
    - `shared/maps/map-pack.ts`: schema `2`, renderable-tile check includes `data` + `foreground`.
    - `client/map-source.ts`: requires `schemaVersion=2`, parses `client.foreground`, drops `client.high`.
    - `client/map.ts` / `client/game.ts` / `client/renderer.ts`: explicit foreground iteration/render pass replaces high-tile filtering.
  - Added npm scripts:
    - `check:foreground-layers:dry`
    - `fix:foreground-layers`
- Evidence:
  - `bun run build:maps` → regenerated runtime map-pack successfully.
  - `bun run check:maps` → runtime map-pack up to date.
  - Unit/test verification:
    - `bun test tests/unit/map-pack.test.ts` → pass.
    - `bun test tests/unit/map-source.test.ts` → pass.
    - `bun test tests/unit/renderer-terrain.test.ts` → pass.
    - `bun test tests/unit/mmo/server-map-registry.test.ts` → pass.
    - `bun test tests/unit/server/startup/preflight.test.ts` → pass.
    - `bun run typecheck:client` and `bun run typecheck:server` → pass.
- Next action:
  - Execute content migration on tiled maps and strip legacy `v` metadata.

#### Ticket N
- Start timestamp: `2026-02-27 00:31:58 CET`
- Current status: `done`
- Key actions taken:
  - Dry-run migration over tiled map set (`73` maps) to measure deltas.
  - Applied write migration with `--strip-v`.
  - Re-ran dry pass to confirm idempotence.
  - Revalidated `world.json`.
- Evidence:
  - Dry run:
    - `bun tools/content/maps-migrate-v-to-foreground.ts`
    - Totals: `movedCells=5585`, `createdForegroundLayers=108`.
    - `world.json`: `movedCells=2670`, `createdForegroundLayers=21`.
  - Write run:
    - `bun tools/content/maps-migrate-v-to-foreground.ts --strip-v --write`
    - Totals: `movedCells=5585`, `createdForegroundLayers=108`, `strippedExternalVProperties=253`.
  - Idempotence:
    - `bun tools/content/maps-migrate-v-to-foreground.ts --strip-v`
    - Totals after write: all `0` deltas.
  - Post-migration validation:
    - `world-map-validator` legacy + target both `0 errors`.
  - Runtime payload shape:
    - `assets/maps/runtime/map-pack.json` now reports `schemaVersion=2`.
    - Sample map payload includes `client.foreground` and no `client.high`.
- Next action:
  - Foreground-layer migration is complete for the current tiled set; optional follow-up is visual smoke checks in-game.
- `zones` objectgroup:
  - `153` rectangles, all same size (`477x222`), no names, no types, no custom properties.
  - not a clean partition: overlaps exist, and `~4.6%` of tile centers are uncovered (per subagent evidence).
  - includes off-map coordinates (`x=-1` and `y=-1` cases).
- `mobile zones`:
  - `40` same-size rectangles (`242x113`), also unlabeled.
  - contains an exact duplicate rectangle (`1918,4321,242,113` appears twice).
- `music` zones:
  - explicit regions exist but do not cover entire world (large implicit-default area).

### 6) Portal / Door Data Drift
- Two portal representations coexist:
  - `portals` tilelayer: 5 coordinates.
  - `doors` objectgroup with `type='portal'`: 7 coordinates.
- Mismatch:
  - 2 portal door objects have no corresponding portal tilelayer cell: `(77,237)` and `(82,234)`.
- This is a classic dual-source consistency hazard.

### 7) Property Schema Quality (Non-Idiomatic / Legacy Smell)
- `tilesheet` tile metadata:
  - only property keys: `c`, `v`, `length`, `delay`, and empty key `""`.
  - `59` tile properties have empty property name.
  - all property types are strings, even numeric-like values (`length`, `delay`).
- Object metadata also string-heavy:
  - door and chestarea properties include `x`/`y` as strings that are not object coordinates.
  - this creates naming collision with Tiled object fields `x`/`y`.
- In short: semantics are encoded in weakly typed, inconsistent metadata conventions.

## Consolidated Hypotheses

### H1 — One-sheet world atlas
- Hypothesis: the map is an atlas of many biomes/instances packed into one map for legacy convenience.
- Evidence: disconnected coverage regions, deep layer stack, massive hidden metadata usage.
- Confidence: `High`.

### H2 — Layer-driven semantics (not gid-driven semantics)
- Hypothesis: same gid values intentionally mean different gameplay things across layers.
- Evidence: `gid4` fill behavior across cave/indoor/maze plus minor canyon underlay; boundary layers sharing cliff gids.
- Confidence: `High`.

### H3 — Zone system is mechanically generated then manually patched
- Hypothesis: `zones` was created from a coarse grid template, then manually adjusted/incompletely maintained.
- Evidence: uniform rectangle sizes, step-like coordinate clusters, overlap/uncovered artifacts, off-map rectangles.
- Confidence: `Medium-High`.

### H4 — Data model drift over time
- Hypothesis: multiple generations of authoring conventions coexist (tile masks + object rules + ad-hoc property keys).
- Evidence: sentinel layer, naming inconsistency, dual portal source, stringly typed properties, duplicate mobile zone.
- Confidence: `High`.

## Improvement Proposals (No Code Changes Yet)

### Priority A — Safety & Observability
1. Define and commit a layer contract manifest (`layer_name -> purpose -> data type -> ownership`).
2. Add map lint checks (duplicate objects, off-map objects, layer naming policy, dual-source conflicts).
3. Enforce one portal authority (either tilelayer or object layer; not both).

### Priority B — Semantics Cleanup
1. Normalize property keys:
   - rename ambiguous property keys `x`/`y` to explicit semantic names (`target_tx`, `target_ty`, etc.).
   - remove empty tile property names.
2. Convert numeric-like strings to typed numeric values where supported.
3. Rename typo/inconsistent layers (`mase` -> `maze`, unify casing convention).

### Priority C — Structural Cleanup
1. Refactor zone layers to explicit IDs/properties (`zone_id`, optional `zone_kind`) so logic never depends on fragile Tiled object IDs.
2. Resolve duplicate `mobile zones` rectangle.
3. Fix or intentionally document uncovered zone areas and off-map zone rectangles.

### Priority D — Format/Scale Cleanup
1. Reduce map bloat:
   - move sparse logic from full-grid tilelayers to object layers where practical,
   - consider chunked/infinite map representation if pipeline supports it.
2. Keep visual authoring and logic authoring in clearly separated groups/layers.

## Agreement Matrix (Subagents vs Local Analysis)
- Strong agreement:
  - single massive map with layered semantics,
  - gid ambiguity around tile index `[3]` and `gid 4`,
  - zones/mobile-zones technical debt,
  - non-idiomatic property model.
- Minor uncertainty:
  - exact intended gameplay meaning of `gid 4` (floor vs outside filler vs underlay); data strongly supports “contextual filler”, but exact naming intent is inferential.

## Reproducible Evidence Commands (Representative)
- Schema/layer inventory:
  - `node -e "... topKeys, width/height, layerCount, tilesets ..."`
- Full layer catalog:
  - `node -e "... layers.map({id,name,type,visible,dataLen,objLen,...}) ..."`
- GID ambiguity check:
  - `node -e "... gids=[3,4,1964] ..."`
- Canyon underlay check:
  - `node -e "... canyon[i]===4 && cliffs[i]!==0 ..."`
- Portal dual-source mismatch:
  - `node -e "... portals tile coords vs doors type=portal coords ..."`

## Final Summary
- `world.json` is not just “a messy layer file”; it is effectively a legacy world database encoded inside Tiled layer constructs.
- Tile `[3]` confusion is real but specifically a gid-index ambiguity problem:
  - `gid 4` (tilesheet tile id 3) is heavily reused and layer-context-dependent.
  - `gid 3` itself is unused.
- The highest-risk issues are semantic ambiguity and dual sources of truth (`portals`, `zones`), not raw artistic layering.

## Execution Task (2026-02-26): Comprehensive Standardization Pipeline

### Ticket Board

#### Ticket L — Plan Standardization Contract (`done`)
- Scope:
  - Included: explicit standardization scope for `world.json` and expected compatibility boundaries.
  - Out of scope: gameplay logic changes in client/server systems.
- Acceptance criteria:
  - Ticketized plan defines phases, dependencies, and verification commands.
  - Contract distinguishes compatibility-safe vs optional-breaking edits.
- Verification plan:
  - Ensure every transformation has a script and a validation command.
- Dependencies / blockers:
  - Dependency: prior Tickets H–K outputs.
  - Blockers: none.

#### Ticket M — Implement/Refine Standardization Scripts (`done`)
- Scope:
  - Included: script pipeline for idiomatic cleanup of `world.json`.
  - Included: optional flags for potentially breaking changes (`blocking_mask`, `plateau_mask` policy).
  - Out of scope: applying equivalent edits to split maps in this pass.
- Acceptance criteria:
  - Scripts support dry-run and write modes.
  - Scripts are idempotent on repeated runs with same options.
  - Scripts keep focused responsibility (void-cull, tileset collision migration, idiomatic metadata pass).
- Verification plan:
  - Run each script in dry-run, then write, then dry-run again.
- Dependencies / blockers:
  - Dependency: Ticket L.
  - Blockers: none.

#### Ticket N — Execute Pipeline On `world.json` (`done`)
- Scope:
  - Included: backup + script execution on `assets/maps/tiled/world.json`.
  - Out of scope: runtime map-pack regeneration for split maps.
- Acceptance criteria:
  - Backup produced before writes.
  - Script summaries captured with concrete counts.
- Verification plan:
  - Command logs + output snapshots in this report.
- Dependencies / blockers:
  - Dependency: Ticket M.
  - Blockers: none.

#### Ticket O — Validate + Handoff (`done`)
- Scope:
  - Included: validator/build-test checks relevant to map data integrity.
  - Included: final operator notes on what is safe to replace now vs later.
  - Out of scope: automatic rollout to production runtime.
- Acceptance criteria:
  - Selected validations pass after write run.
  - Report includes next-step rollout sequence.
- Verification plan:
  - Run validators and targeted tests after pipeline execution.
- Dependencies / blockers:
  - Dependency: Ticket N.
  - Blockers: none.

### Live Progress Log

#### Ticket L
- Start timestamp: `2026-02-26 22:59:19 CET`
- Current status: `done`
- Key actions taken:
  - Re-audited `world.json` layer inventory after manual edits.
  - Re-audited plateau/blocking semantics in game code (`shared/maps/processmap.ts`, `client/map.ts`, client ECS systems).
  - Re-audited existing map tools (`world-null-outside-void`, `tileset-migrate-c-to-objectgroup`, `world-standardize-idiomatic`) and identified remaining orchestration gap.
- Evidence:
  - Layer inventory still includes `plateau_mask` and `blocking_mask`.
  - `plateau` currently gates client-side movement partitioning; server does not enforce plateau partition.
  - `blocking` (not `blocking_mask`) is what current map processing logic consumes directly.
- Next action:
  - Execute Ticket M tooling changes.

#### Ticket M
- Start timestamp: `2026-02-26 23:00:04 CET`
- Current status: `done`
- Key actions taken:
  - Added orchestration script `tools/content/world-standardize-pipeline.ts` (dry-run/write pipeline with backup, staged transforms, and validation).
  - Refined `tools/content/world-standardize-idiomatic.ts`:
    - added `--rename-blocking-mask`,
    - added empty object-property cleanup,
    - added duplicate-layer guard,
    - added explicit `--no-*` disable flags for configurable defaults.
  - Fixed `tools/content/world-null-outside-void.ts` to support external tilesets (`tileset.source`) when resolving image metadata for transparency-aware soft blockers.
  - Added npm scripts:
    - `check:world-standardize:dry`
    - `fix:world-standardize`
- Evidence:
  - `bun tools/content/world-standardize-idiomatic.ts --map assets/maps/tiled/world.json` (runs successfully after refactor).
  - `bun tools/content/world-standardize-pipeline.ts --map assets/maps/tiled/world.json` (dry-run summary emitted).
  - Post-fix idempotence guard:
    - pipeline dry-run initially exposed externalized-tileset image-resolution failure;
    - after `world-null-outside-void.ts` fix, pipeline dry-run passes fully.
- Next action:
  - Execute write pipeline on `world.json`.

#### Ticket N
- Start timestamp: `2026-02-26 23:03:00 CET`
- Current status: `done`
- Key actions taken:
  - Executed full write pipeline on `assets/maps/tiled/world.json` in compatibility-safe mode.
  - Backup created before mutation.
  - Re-ran pipeline dry-run to confirm idempotence after write.
- Evidence:
  - Write run:
    - `bun tools/content/world-standardize-pipeline.ts --map assets/maps/tiled/world.json --write`
  - Backup:
    - `assets/maps/tiled/world.backup.20260226-230300.json`
  - Write-run summary highlights:
    - `void-cull`: no further removals required (`removed=0`, prior cleanup already applied).
    - `tileset-collision-migration`: no legacy `c` remaining.
    - `idiomatic-standardize`: applied metadata/externalization changes (`setObjectTypeCount=592`, `setObjectClassCount=599`, `coercedIntPropertyCount=309`, `externalizedTilesetsCount=2`).
  - Idempotence:
    - `bun tools/content/world-standardize-pipeline.ts --map assets/maps/tiled/world.json`
    - `idiomatic-standardize` subsequent dry-run deltas all `0`.
- Next action:
  - Run final validation suite.

#### Ticket O
- Start timestamp: `2026-02-26 23:06:11 CET`
- Current status: `done`
- Key actions taken:
  - Re-validated world map profiles post-write.
  - Re-validated map-pack consistency and focused map-pack tests.
  - Confirmed rollout mode remained compatibility-safe (no automatic rename/drop of `plateau_mask` / `blocking_mask`).
  - Documented optional-breaking standardization controls in pipeline flags (`--rename-plateau-mask`, `--rename-blocking-mask`, `--drop-blocking-mask`).
- Evidence:
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` → `errors=0`.
  - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` → `errors=0`.
  - `bun tools/content/map-pack.ts check --config assets/maps/tiled/map-pack.config.json` → map pack up to date.
  - `bun test tests/unit/map-pack.test.ts` → `13 pass`, `0 fail`.
- Next action:
  - Handoff complete; optional next ticket is split-map parity standardization.

## Execution Task (2026-02-26): Derived Navigation (Plateau + Blocking Authoring-Free)

### Ticket Board

#### Ticket P — Build-Time Derived Navigation Contract (`done`)
- Scope:
  - Included: define derived semantics so authored `plateau` / `blocking` layers are optional.
  - Included: binary plateau derivation from navigability islands.
  - Out of scope: gameplay-specific elevation transitions beyond collision topology.
- Acceptance criteria:
  - Processed maps export stable navigation-island metadata.
  - Client/server pathing can reject cross-island targets early.
- Verification plan:
  - Typecheck + targeted runtime/map-pack checks.
- Dependencies / blockers:
  - Dependency: prior world standardization pipeline.
  - Blockers: none.

#### Ticket Q — Apply World Standardization (Drop Plateau/Blocking Masks) (`done`)
- Scope:
  - Included: drop `plateau_mask` and `blocking_mask` from `world.json`.
  - Included: keep collision and void-cull passes in pipeline.
  - Out of scope: reintroducing authored fallback masks.
- Acceptance criteria:
  - `world.json` has no plateau/blocking mask layers.
  - Target validator remains green under updated schema.
- Verification plan:
  - Dry-run + write-run + idempotence dry-run.
- Dependencies / blockers:
  - Dependency: Ticket P script/schema updates.
  - Blockers: none.

#### Ticket R — Validation + Runtime Pack Refresh (`done`)
- Scope:
  - Included: rebuild runtime map-pack after processmap schema changes.
  - Included: run validators, map-pack tests, map-source tests, and typechecks.
  - Out of scope: full e2e gameplay test pass.
- Acceptance criteria:
  - All listed checks pass with zero failures.
  - Runtime pack includes derived navigation metadata.
- Verification plan:
  - Command evidence captured below.
- Dependencies / blockers:
  - Dependency: Ticket Q write pass.
  - Blockers: none.

### Live Progress Log

#### Ticket P
- Start timestamp: `2026-02-26 23:11:02 CET`
- Current status: `done`
- Key actions taken:
  - Updated `shared/maps/processmap.ts` to derive:
    - deduped valid collision indices,
    - client blocking as derived union (`collisions ∪ blocking`),
    - navigation islands (`navIslandByTile`, `navIslandCount`, `primaryNavIslandId`) via 8-neighbor flood fill,
    - binary plateau as “walkable tiles not in primary island”.
  - Removed reliance on authored `plateau` tilelayer in processing path.
  - Added navigation island handling to client/server runtime:
    - client map payload normalization and map model accessors,
    - early cross-island path rejection in client path requests and server `MOVE_TO`.
  - Updated validator/migration scripts to new target (no required plateau/blocking mask layers).
- Evidence:
  - Updated files include:
    - `shared/maps/processmap.ts`
    - `client/map-source.ts`
    - `client/map.ts`
    - `client/game.ts`
    - `server/map.ts`
    - `server/world/intents/move-to-intent.ts`
    - `server/world/ecs-command-pipeline/core-module-registry.ts`
    - `tools/content/world-map-validator.ts`
    - `tools/content/world-migrate-pass1.ts`
- Next action:
  - Apply the world layer-drop migration with updated pipeline flags.

#### Ticket Q
- Start timestamp: `2026-02-26 23:22:09 CET`
- Current status: `done`
- Key actions taken:
  - Extended standardization scripts/pipeline with explicit `--drop-plateau-mask`.
  - Updated package scripts for this policy:
    - `check:world-standardize:dry` (drop flags + skip validate),
    - `fix:world-standardize` (drop flags + write).
  - Executed write pipeline and backup.
- Evidence:
  - Dry-run:
    - `bun run check:world-standardize:dry`
    - predicted removals: `removedPlateauMaskLayers=1`, `removedBlockingMaskLayers=1`.
  - Write run:
    - `bun run fix:world-standardize`
    - backup: `assets/maps/tiled/world.backup.20260226-232209.json`
    - result: `resultingLayerCount=66`
  - Idempotence:
    - second `bun run check:world-standardize:dry` reports zero further removals.
  - Structural check:
    - `layerCount=66`, `hasPlateau=false`, `hasBlocking=false`.
- Next action:
  - Rebuild and validate runtime outputs.

#### Ticket R
- Start timestamp: `2026-02-26 23:22:54 CET`
- Current status: `done`
- Key actions taken:
  - Rebuilt runtime map-pack after processmap output changes.
  - Ran validators, targeted tests, and typechecks.
  - Confirmed runtime pack includes derived nav metadata.
- Evidence:
  - `bun run build:maps` → regenerated `assets/maps/runtime/map-pack.json`.
  - `bun tools/content/map-pack.ts check --config assets/maps/tiled/map-pack.config.json` → up to date.
  - Validators:
    - `legacy` profile → `0` errors.
    - `target` profile → `0` errors.
  - Tests:
    - `bun test tests/unit/map-pack.test.ts` → `13 pass`, `0 fail`.
    - `bun test tests/unit/map-source.test.ts` → `2 pass`, `0 fail`.
    - `bun test tests/unit/world/move-to-planning.test.ts` → `2 pass`, `0 fail`.
  - Typechecks:
    - `bun run typecheck:client` → pass.
    - `bun run typecheck:server` → pass.
  - Runtime metadata sample (`world_01` client payload):
    - `hasNav=true`, `navIslandCount=21`, `primary=3`.
- Next action:
  - Derived-navigation standardization complete for current pipeline; optional next pass is split-map authoring cleanup to remove stale manual plateau/blocking layers there as well.

## Execution Task (2026-02-26): World-Focused Metadata Cleanup Follow-Up

### Ticket Board

#### Ticket S — Legacy Animation Metadata Migration (`done`)
- Scope:
  - Included: migrate `tilesheet` legacy tile props (`length`/`delay`) to Tiled-native `animation` frames.
  - Included: remove empty tile property names in `tilesheet`.
  - Out of scope: removing `v` high-tile marker semantics in this pass.
- Acceptance criteria:
  - No `length`/`delay` tile properties remain in `tilesheet`.
  - Tiled `animation` entries are present for previously animated tiles.
  - `processmap` no longer reads legacy `length`/`delay` properties.
- Verification plan:
  - Dry-run + write + idempotence dry-run for migration script.
  - Grep/typecheck/tests after parser update.
- Dependencies / blockers:
  - Dependency: prior world/tileset externalization baseline.
  - Blockers: none.

#### Ticket T — World Tileset Reference Sanitization (`done`)
- Scope:
  - Included: keep world tilesets as clean source refs (`firstgid` + `source`) only.
  - Out of scope: split-map refactoring.
- Acceptance criteria:
  - `world.json` has no no-op `tiles: []` entries under `tilesets`.
- Verification plan:
  - Re-run world standardization pipeline write pass and inspect tileset block.
- Dependencies / blockers:
  - Dependency: Ticket S write pass.
  - Blockers: none.

### Live Progress Log

#### Ticket S
- Start timestamp: `2026-02-26 23:34:17 CET`
- Current status: `done`
- Key actions taken:
  - Added `tools/content/tileset-modernize-metadata.ts`.
  - Added package scripts:
    - `check:tileset-modernize:dry`
    - `fix:tileset-modernize`
  - Migrated `assets/maps/tiled/tilesheet.wang.tsj`:
    - converted legacy `length`/`delay` props into Tiled `animation`,
    - removed empty-name tile properties.
  - Updated `shared/maps/processmap.ts` animated-tile parsing to read `tile.animation` (strict contiguous/equal-duration contract) and removed legacy `length`/`delay` parsing.
- Evidence:
  - Dry-run:
    - `bun run check:tileset-modernize:dry`
    - summary: `removedLengthProps=37`, `removedDelayProps=6`, `removedEmptyNameProps=59`, `createdAnimations=37`.
  - Write:
    - `bun run fix:tileset-modernize`
  - Idempotence:
    - second `bun run check:tileset-modernize:dry` reports all zero deltas.
  - Post-check (scripted counts):
    - `v=253`, `length=0`, `delay=0`, `empty=0`, `animation=37`.
  - Parser references:
    - `shared/maps/processmap.ts` now consumes `tile.animation` and still consumes `v` for high tiles.
- Next action:
  - Run world standardization to sanitize source tileset refs in `world.json`.

#### Ticket T
- Start timestamp: `2026-02-26 23:33:05 CET`
- Current status: `done`
- Key actions taken:
  - Updated `tools/content/world-standardize-idiomatic.ts` to normalize source tileset records and drop extra fields.
  - Re-ran `bun run fix:world-standardize` (write pipeline + validation).
  - Rebuilt runtime map pack due parser/tileset metadata changes.
- Evidence:
  - `bun run fix:world-standardize`
    - backup: `assets/maps/tiled/world.backup.20260226-233305.json`
    - `sanitizedSourceTilesetsCount=2`
  - `world.json` tilesets now:
    - `{ firstgid: 1, source: "tilesheet.wang.tsj" }`
    - `{ firstgid: 1961, source: "mobs.tsj" }`
  - Validation / checks:
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` → `0` errors.
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` → `0` errors.
    - `bun run build:maps` + `bun tools/content/map-pack.ts check --config assets/maps/tiled/map-pack.config.json` → up to date.
    - `bun test tests/unit/map-pack.test.ts` → `13 pass`.
    - `bun test tests/unit/map-source.test.ts` → `2 pass`.
    - `bun run typecheck:client` / `bun run typecheck:server` → pass.
- Next action:
  - Remaining open idiomatic gap on this topic: `v` (high-tile marker) is still custom and not yet moved to a fully layer-based authoring model.

## Execution Task (2026-02-26): Stable Object Naming + Stricter Target Schema

### Ticket Board

#### Ticket U — Deterministic Object Naming + Portal Classing (`done`)
- Scope:
  - Included: assign deterministic object names for all target object layers in `world.json`.
  - Included: class portal door objects as `Portal` while preserving `type=portal`.
  - Included: add target-validator requirement for stable object names.
  - Out of scope: introducing Tiled template references (`template`) in map objects (runtime does not resolve template files).
- Acceptance criteria:
  - Target object layers have non-empty stable names.
  - `target` validator enforces non-empty object names.
  - `doors` portal objects are classed as `Portal`.
- Verification plan:
  - Dry-run + write pipeline with summary counters.
  - Validator profiles + tests + typecheck after write.
- Dependencies / blockers:
  - Dependency: prior metadata cleanup (Tickets S/T).
  - Blockers: none.

### Live Progress Log

#### Ticket U
- Start timestamp: `2026-02-26 23:48:03 CET`
- Current status: `done`
- Key actions taken:
  - Extended `tools/content/world-standardize-idiomatic.ts`:
    - added deterministic object naming (`setObjectNames`, default enabled),
    - added per-layer naming conventions (doors/zones/mobile_zones/music_zones/roaming_areas/resource_nodes/static_entities/chest_spawns/chest_areas/checkpoints),
    - classes portal objects as `Portal` on `doors` layer.
  - Extended `tools/content/world-map-validator.ts` target contracts:
    - new non-empty object-name requirement (`OBJECT_NAME_MISSING`) across target object layers,
    - added chest spawn `items` property contract check.
  - Applied write pipeline and produced backup.
- Evidence:
  - Dry-run:
    - `bun run check:world-standardize:dry`
    - `idiomatic-standardize` summary:
      - `setObjectNameCount=599`
      - `setObjectClassCount=7` (portal objects)
  - Write:
    - `bun run fix:world-standardize`
    - backup: `assets/maps/tiled/world.backup.20260226-234803.json`
  - Post-write validation:
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` → `0` errors.
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` → `0` errors.
  - Regression checks:
    - `bun tools/content/map-pack.ts check --config assets/maps/tiled/map-pack.config.json` → up to date.
    - `bun test tests/unit/map-pack.test.ts` → `13 pass`.
    - `bun test tests/unit/map-source.test.ts` → `2 pass`.
    - `bun run typecheck:client` / `bun run typecheck:server` → pass.
- Next action:
  - Remaining open non-monolithic gap: migrate custom `v` high-tile semantics to explicit over-entity layer semantics (currently still custom in tileset metadata + parser).

## Execution Task (2026-02-27): Post-Migration Tiled-Native Re-Audit (`world.json` + `tilesheet.wang.tsj`)

### Ticket Board

#### Ticket V — Multi-Agent Re-Audit Against Tiled Docs (`done`)
- Scope:
  - Included: independent audit of remaining non-idiomatic structures in `world.json` and `tilesheet.wang.tsj`.
  - Included: cross-check recommendations against upstream Tiled docs in `../tiled/docs`.
  - Out of scope: monolithic→world split strategy and gameplay redesign.
- Acceptance criteria:
  - At least 3 independent agent reports covering map, tileset, and Tiled-native patterns.
  - Findings validated with local command-backed evidence.
- Verification plan:
  - Spawn explorer agents and reconcile their conclusions with direct JSON probes.
- Dependencies / blockers:
  - Dependency: foreground migration already landed.
  - Blockers: none.

#### Ticket W — Apply Low-Risk Tiled-Native Hardening (`done`)
- Scope:
  - Included: foreground detection supports Tiled `class=Foreground` (not only custom property).
  - Included: ensure target object instances in `world.json` carry object-level `class`.
  - Included: tighten target validator to require non-empty object class in target object layers.
  - Out of scope: tile-object migration for spawns/resources and zone geometry snapping.
- Acceptance criteria:
  - `processmap` recognizes foreground by class.
  - `world.json` target object instances have classes.
  - Legacy/target validators stay green and map-pack tests remain green.
- Verification plan:
  - Run target+legacy validator on `world.json`.
  - Run `check:maps` and focused map-pack tests.
- Dependencies / blockers:
  - Dependency: Ticket V findings.
  - Blockers: none.

### Live Progress Log

#### Ticket V
- Start timestamp: `2026-02-27 00:49:03 CET`
- Current status: `done`
- Key actions taken:
  - Spawned 3 independent explorers:
    - `Sage`: `world.json` non-idiomatic patterns and priorities.
    - `Peony`: `tilesheet.wang.tsj` audit.
    - `Bamboo`: Tiled-doc-native guidance from `../tiled/docs`.
  - Verified high-signal findings with local probes.
- Evidence:
  - `world.json` object-layer inventory:
    - `10` object layers, `599` objects, `599` objects missing object `class` pre-fix.
  - Zone geometry:
    - off-grid objects pre-fix snapshot: `zones=153`, `mobile_zones=40` (all not tile-aligned).
  - Tileset metadata:
    - `tilesheet.wang.tsj` has `tilesWithProps=0`, `tilesWithAnim=37`, `tilesWithObj=474`.
    - wangset distribution: `wangtiles=759`, `mixed=0`, `allSame=759`, `hasZero=0`.
  - Foreground metadata:
    - only `bq_foreground` + `bq_source_layer` on foreground layers (`21` each in `world.json`).
- Next action:
  - Apply low-risk hardening from findings without changing gameplay semantics.

#### Ticket W
- Start timestamp: `2026-02-27 00:58:12 CET`
- Current status: `done`
- Key actions taken:
  - Updated `shared/maps/processmap.ts`:
    - `isForegroundLayer` now accepts Tiled-native `class=Foreground` (property fallback retained).
  - Updated `tools/content/world-map-validator.ts`:
    - foreground middle-band contract now accepts class-based foreground layers,
    - target object contracts now require non-empty object `class` (`OBJECT_CLASS_MISSING`).
  - Applied object-class normalization on `world.json` with existing standardizer (no type churn):
    - `bun tools/content/world-standardize-idiomatic.ts --map assets/maps/tiled/world.json --no-set-object-types --write`
    - result: `setObjectClassCount=599`.
- Evidence:
  - Post-fix object-class check:
    - `world.json` objects: `total=599`, `missing class=0`.
  - Validators:
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json` → `0` errors.
    - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile legacy --json` → `0` errors.
  - Runtime/checks:
    - `bun run check:maps` → map pack up to date.
    - `bun test tests/unit/map-pack.test.ts` → `13 pass`.
- Next action:
  - Candidate next tiled-native upgrades (not yet applied): spawn/resource tile-object migration, zone snapping/tx-ty schema, and Wangset purpose cleanup (metadata vs true auto-tiling).

## Execution Task (2026-02-27): No-Legacy Hardening + Tiled Authoring Playbook

### Execution Ticket Board

#### Ticket J — Remove legacy map authoring artifacts (`done`)
- Scope:
  - Included: bulk modernization of map-pack sources + `world.json` to class-first, canonical layer/property names.
  - Included: remove legacy object `type` usage and legacy foreground marker properties in authored maps.
  - Out of scope: splitting monolithic authoring into room/sublevel files.
- Acceptance criteria:
  - Canonical layer names only (`chest_spawns`, `chest_areas`, `roaming_areas`, `music_zones`, `mobile_zones`).
  - No legacy door properties (`o/x/y/cx/cy`) left in authored maps.
  - No object `type` left in canonical object layers; object `class` present.
- Verification plan:
  - Run modernizer dry-run, write-run, then idempotence dry-run.
  - Run direct audit script for leftover legacy markers.
- Dependencies / blockers:
  - Dependency: previous migration scripts and validator baseline.
  - Blockers: none.

#### Ticket K — Remove parser-side legacy accommodations (`done`)
- Scope:
  - Included: reject legacy door props and legacy object `type` usage in strict object layers during map processing.
  - Included: move roaming runtime naming from legacy `nb/type` semantics to `count/mobKind` semantics.
  - Out of scope: full runtime door field schema rewrite (`o/x/y/cx/cy` export keys remain runtime-compat).
- Acceptance criteria:
  - `processmap` throws on legacy door property keys (`o/x/y/cx/cy`).
  - `processmap` throws if canonical object layers still use object `type` or miss object `class`.
  - Runtime roaming area payload exposes `count` and `mobKind`.
- Verification plan:
  - Rebuild map pack + targeted tests/typechecks.
  - Confirm runtime payload includes `mobKind/count` values.
- Dependencies / blockers:
  - Dependency: Ticket J complete.
  - Blockers: one test expectation update required for `orientation` naming.

#### Ticket L — Authoring workflow guidance before room split (`done`)
- Scope:
  - Included: concrete Tiled authoring steps to keep data canonical and automation-friendly.
  - Out of scope: implementing room split in this pass.
- Acceptance criteria:
  - A clear, enforceable checklist exists in this report.
- Verification plan:
  - Ensure checklist maps directly to validator + modernizer constraints.
- Dependencies / blockers:
  - Dependency: Tickets J and K complete.
  - Blockers: none.

### Execution Live Progress Log

#### Ticket J
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Executed `tools/content/map-pack-modernize-legacy.ts` across all configured split maps and `world.json`.
  - Applied canonical renames/classes/properties and stripped legacy foreground properties.
  - Verified idempotence (second dry run reports zero changes).
- Evidence:
  - `bun tools/content/map-pack-modernize-legacy.ts --include-world`
    - totals before write: `renamedLayers=36`, `setLayerClasses=62`, `setObjectClasses=360`, `removedObjectTypes=944`, `renamedDoorProps=420`, `strippedLegacyForegroundLayerProps=112`.
  - `bun tools/content/map-pack-modernize-legacy.ts --include-world --write`
  - `bun tools/content/map-pack-modernize-legacy.ts --include-world`
    - totals after write: all zero.
  - Direct audit script summary:
    - `missingClass=0`, `legacyType=0`, `legacyDoorProps=0`, `legacyForegroundProps=0`, `legacyLayerNames=0`.
- Next action:
  - Tighten parser contracts so legacy authored inputs fail fast.

#### Ticket K
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Hardened `shared/maps/processmap.ts`:
    - strict class requirements on canonical object layers,
    - explicit rejection of object `type` in canonical layers,
    - explicit rejection of legacy door property keys (`o/x/y/cx/cy`).
  - Renamed roaming runtime payload shape to `mobKind` + `count`.
  - Updated server config typing and runtime wiring (`MapMobAreaConfig`, `MobArea`, world bootstrap usage).
  - Updated tests for canonical `orientation` + `target_tx/target_ty` property naming.
  - Updated validator portal parity logic to class-based portal detection (`class === Portal`).
- Evidence:
  - `bun run build:maps` → exit `0`
  - `bun run check:maps` → exit `0`
  - `bun test tests/unit/map-pack.test.ts --timeout 30000` → exit `0` (`14 pass, 0 fail`)
  - `bun test tests/unit/map-source.test.ts --timeout 30000` → exit `0` (`2 pass, 0 fail`)
  - `bun test tests/unit/server/startup/preflight.test.ts --timeout 30000` → exit `0` (`10 pass, 0 fail`)
  - `bun run typecheck:server` → exit `0`
  - `bun run typecheck:client` → exit `0`
  - Runtime payload spot-check (`assets/maps/runtime/map-pack.json`): roaming entries contain `mobKind` and `count`.
- Next action:
  - Record and apply stable authoring checklist prior to room split.

#### Ticket L
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Consolidated a pre-room-split authoring checklist optimized for Tiled-native data and strict validation.
- Evidence:
  - Checklist captured below in this report.
- Next action:
  - Execute room-split design using this checklist as acceptance gate.

### Tiled Authoring Checklist (Before Splitting into Rooms)

1. **Use class-first object authoring**
   - Every object in canonical layers must have `class`; keep object `type` empty.
   - Canonical object layer/object classes:
     - `doors` → `Door` / `Portal`
     - `resource_nodes` → `ResourceNode`
     - `static_entities` → `StaticEntity`
     - `chest_spawns` → `ChestSpawn`
     - `chest_areas` → `ChestArea`
     - `roaming_areas` → `RoamingArea`
     - `zones` → `Zone`
     - `music_zones` → `MusicZone`
     - `checkpoints` → `Checkpoint`
     - `mobile_zones` → `MobileZone`

2. **Use canonical property keys only**
   - Doors: `orientation`, `target_tx`, `target_ty`, optional `camera_tx`, `camera_ty`, and for portals `door_id`, `target_map`, `target_door`.
   - Roaming: `mob_kind`, `count`.
   - Chest areas: `items`, `spawn_tx`, `spawn_ty`.
   - Music zones: `track_id`.
   - Checkpoints: `checkpoint_id`, `spawn` (bool).
   - Zones/mobile zones: `zone_id`.

3. **Foreground semantics must be class-based**
   - Foreground tile layers use suffix `_foreground` and `class: Foreground`.
   - Do not author `bq_foreground` / `bq_source_layer` properties.

4. **Keep numeric properties typed in Tiled**
   - Set integer fields to Tiled `int` property type (`target_tx`, `target_ty`, `count`, `zone_id`, etc.).
   - Set booleans as Tiled `bool` (`spawn`).

5. **Stabilize identifiers before splitting**
   - Ensure portal/door `door_id` values are stable and unique per map.
   - Ensure all `target_map` / `target_door` references resolve.

6. **Project-level setup to reduce drift**
   - In the Tiled project, define custom classes/templates for each canonical object class with typed fields.
   - Use templates for repetitive authoring (`Portal`, `RoamingArea`, `MusicZone`, etc.) to prevent key drift.

7. **Validation gate before commit**
   - Run:
     - `bun tools/content/world-map-validator.ts --map assets/maps/tiled/world.json --profile target --json`
     - `bun run build:maps`
     - `bun run check:maps`
   - Treat any validator error as authoring regression.


## Execution Task (2026-02-27): Pre-Authoring UX/Schema Upgrades (Before Manual Terrain Marking)

### Ticket Board

#### Ticket M — Tiled project typing + class scaffolding (`done`)
- Scope:
  - Included: populate project-level custom types/classes in `browserquest.tiled-project` for canonical map authoring.
  - Included: add spawn/door/music enums and per-object class members to reduce property drift.
  - Out of scope: forcing immediate reclassification of every existing map object via Tiled UI.
- Acceptance criteria:
  - `propertyTypes` is no longer empty.
  - Canonical gameplay object classes have typed members in project metadata.
- Verification plan:
  - Inspect project JSON for enum/class coverage.

#### Ticket N — Entity spawn representation modernization (`done`)
- Scope:
  - Included: parser support for idiomatic object-based static entities (`static_entities`) with `entity_kind`, `entity_gid`, or tile-object `gid`.
  - Included: hard fail on legacy `entities` tilelayer input.
  - Included: conversion of split maps from `entities` tilelayers to `static_entities` object layers.
  - Out of scope: monolithic room split and terrain painting.
- Acceptance criteria:
  - Split maps have no `entities` layer and use `static_entities` object layers.
  - Build/test/typecheck pass with new strict path.
- Verification plan:
  - Run modernizer dry-run/write/idempotence, then build/check/tests/typechecks.

#### Ticket O — Authoring accelerators (templates + alignment) (`done`)
- Scope:
  - Included: add reusable object templates for spawn/door/portal/roaming.
  - Included: enforce top-left tile-object alignment for `mobs.tsj`.
  - Out of scope: introducing new gameplay behavior in runtime systems.
- Acceptance criteria:
  - Template files exist and are directly usable from Tiled.
  - `mobs.tsj` tile-object placement is deterministic for parser assumptions.
- Verification plan:
  - Inspect template files + run full map/toolchain checks.

### Live Progress Log

#### Ticket M
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Populated `assets/maps/tiled/browserquest.tiled-project` `propertyTypes` with:
    - enums: `DoorOrientation`, `MobKind`, `MusicTrackId`,
    - classes: `Door`, `Portal`, `StaticEntity`, `RoamingArea`, `ResourceNode`, `ChestSpawn`, `ChestArea`, `Zone`, `MobileZone`, `Checkpoint`, `MusicZone`, `Foreground`.
- Evidence:
  - `browserquest.tiled-project` now has non-empty `propertyTypes` and typed members for canonical object classes.
- Next action:
  - Wire parser/runtime to consume richer entity spawn authoring patterns.

#### Ticket N
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Updated `shared/maps/processmap.ts`:
    - supports `static_entities` object layer static entity extraction,
    - resolves kind via `entity_kind`, `entity_gid`, or tile object `gid` against `Mobs` tileset,
    - rejects legacy `entities` tilelayer with clear error.
  - Updated validator `tools/content/world-map-validator.ts`:
    - `static_entities` now valid when any of (`entity_kind`, `entity_gid`, tile `gid`) is present.
  - Extended `tools/content/map-pack-modernize-legacy.ts`:
    - converts legacy `entities` tilelayer into canonical `static_entities` object layer,
    - adds `entity_gid` + `entity_kind` properties where resolvable,
    - updates `nextobjectid`, keeps idempotence.
  - Applied conversion to split map set (`map-pack.config.json` maps only; no forced rewrite of `world.json` in this step).
- Evidence:
  - Conversion write run:
    - `convertedLegacyEntitiesLayers=14`, `convertedLegacyEntitiesObjects=236`.
  - Idempotence dry-run after write:
    - `convertedLegacyEntitiesLayers=0`, `convertedLegacyEntitiesObjects=0`.
  - Post-conversion scan:
    - `entitiesLayers=0`, `entitySpawnsLayers=14`, `mobKindProps=236`.
- Next action:
  - Add authoring templates to reduce manual repetitive setup.

#### Ticket O
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Set `assets/maps/tiled/mobs.tsj` to `objectalignment=topleft` for deterministic tile-object placement.
  - Added templates under `assets/maps/tiled/templates/`:
    - `static_entity_rect.tx`
    - `static_entity_tile_rat.tx`
    - `roaming_area.tx`
    - `door.tx`
    - `portal.tx`
    - `README.md`
- Evidence:
  - Full validation pass:
    - `bun tools/content/map-pack-modernize-legacy.ts` → exit `0`
    - `bun run build:maps` → exit `0`
    - `bun run check:maps` → exit `0`
    - `bun test tests/unit/map-pack.test.ts --timeout 30000` → exit `0`
    - `bun test tests/unit/map-source.test.ts --timeout 30000` → exit `0`
    - `bun run typecheck:server` → exit `0`
    - `bun run typecheck:client` → exit `0`
- Next action:
  - Ready for manual terrain set marking + optional room split prep.

## Execution Task (2026-02-27): World Pre-Marking Prefill Pass

### Ticket Board

#### Ticket P — Canonical object-layer prefill on monolithic world (`done`)
- Scope:
  - Included: normalize `world.json` object-layer coverage for canonical gameplay layers before manual marking.
  - Included: enforce per-object `class` values and remove legacy object `type` fields.
  - Included: add missing canonical object layers (`zones`, `mobile_zones`) as empty hidden object layers.
  - Out of scope: terrain paint/layout edits and room splitting.
- Acceptance criteria:
  - Canonical object layers exist on `world.json`.
  - Objects in canonical layers carry class-based typing.
  - Legacy object `type` usage removed from canonical layers.
- Verification plan:
  - Run prefill tool dry-run after write and expect zero pending changes.

#### Ticket Q — Template coverage expansion (`done`)
- Scope:
  - Included: add ready-to-use templates for the remaining canonical object classes.
  - Included: update template README with canonical layer usage guidance.
  - Out of scope: terrain/Wang painting and manual object placement.
- Acceptance criteria:
  - Template set covers resource/chest/zone/music/checkpoint objects in addition to existing door/spawn templates.
- Verification plan:
  - Verify template files exist and match canonical class/property names.

### Live Progress Log

#### Ticket P
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Added `tools/content/world-prefill-authoring.ts` to normalize canonical objectgroup setup for `world.json`.
  - Applied write pass to `assets/maps/tiled/world.json`:
    - added missing layers: `zones`, `mobile_zones`,
    - set object classes across canonical layers (including Door/Portal split on `doors` objects),
    - removed legacy `object.type` fields from canonical layers.
- Evidence:
  - `bun tools/content/world-prefill-authoring.ts --map assets/maps/tiled/world.json --write`:
    - `addedLayers=2`, `setObjectClass=406`, `removedLegacyObjectType=406`.
  - follow-up dry-run:
    - `changed=false`.
- Next action:
  - Expand templates to reduce repetitive manual setup.

#### Ticket Q
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Added templates:
    - `resource_node.tx`
    - `chest_spawn.tx`
    - `chest_area.tx`
    - `zone.tx`
    - `mobile_zone.tx`
    - `music_zone.tx`
    - `checkpoint.tx`
  - Updated `assets/maps/tiled/templates/README.md` with canonical layer usage guidance.
- Evidence:
  - Validation:
    - `bun run build:maps` → exit `0`
    - `bun run check:maps` → exit `0`
- Next action:
  - Ready for manual terrain/terrain-set marking pass in Tiled with class-typed object scaffolding in place.

## Execution Task (2026-02-27): Terrain/Wang Scaffolding Before Manual Marking

### Ticket Board

#### Ticket R — Pair-wise Wang scaffold sets (`done`)
- Scope:
  - Included: keep existing `browserquest-terrain` Wang set as canonical source.
  - Included: generate additional narrow pair-focused scaffold Wang sets for faster transition authoring.
  - Included: make scaffold generation idempotent (rebuilds `scaffold-*` sets each run).
  - Out of scope: automatic high-confidence transition inference for all missing patterns.
- Acceptance criteria:
  - `tilesheet.wang.tsj` contains original terrain set + scaffold pair sets.
  - Re-running scaffold tool does not duplicate scaffold sets.
- Verification plan:
  - Run tool write pass, then dry-run pass and inspect Wang set counts/names.

#### Ticket S — Transition candidate extraction (`done`)
- Scope:
  - Included: generate per-pair candidate tile IDs from current `world.json` layer usage.
  - Included: write machine-readable hint file + short authoring guide.
  - Out of scope: forcing any world layer paint changes.
- Acceptance criteria:
  - Candidate output file exists with per-pair/per-layer tile frequency data.
  - Guide documents how to use scaffold sets + candidate file in Tiled.
- Verification plan:
  - Validate output files and run map pack build/check.

### Live Progress Log

#### Ticket R
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - Added `tools/content/tileset-wang-scaffold.ts`.
  - Tool behavior:
    - reads source Wang set (`browserquest-terrain`),
    - removes previous `scaffold-*` sets,
    - recreates pair scaffolds (`water/sand`, `water/grass`, `sand/grass`, `soil/grass`, `grass/forest`, `rock/cave`, `lava/rock`, `lava/cave`) with remapped color indices.
  - Applied write run to `assets/maps/tiled/tilesheet.wang.tsj`.
- Evidence:
  - `bun tools/content/tileset-wang-scaffold.ts --write` → exit `0`.
  - Post-write dry-run:
    - `bun tools/content/tileset-wang-scaffold.ts` → exit `0`.
  - Resulting wang set count:
    - `browserquest-terrain` + 8 scaffold sets.
- Next action:
  - Generate transition candidate hints and authoring guide.

#### Ticket S
- Start timestamp: `2026-02-27`
- Current status: `done`
- Key actions taken:
  - `tileset-wang-scaffold.ts` now also emits `assets/maps/tiled/terrain-transition-candidates.json` based on `world.json` tile usage in transition-heavy layers.
  - Added `assets/maps/tiled/terrain-scaffold-guide.md` with concrete Tiled workflow for marking transitions.
- Evidence:
  - `assets/maps/tiled/terrain-transition-candidates.json` created on scaffold write pass.
  - Validation:
    - `bun run build:maps` → exit `0`
    - `bun run check:maps` → exit `0`
- Next action:
  - Ready for manual transition marking in Tiled using scaffold sets + candidates.

## Execution Task (2026-03-03): Map Tooling Cleanup (Obsolete Scripts + Scratch Outputs)

- Removed obsolete one-off migration scripts:
  - `tools/content/world-migrate-pass1.ts` (superseded by `tools/content/world-standardize-pipeline.ts`)
  - `tools/content/world-migrate-pass2.ts` (superseded by `tools/content/world-standardize-pipeline.ts`)
- Removed Tiled scratch outputs (session + ad-hoc world copy) from `assets/maps/tiled/`.
- Kept `assets/maps/tiled/world.backup.*.json` and `assets/maps/tiled/world.original.json` as local backups but ignored them in `.gitignore` to avoid repo churn.
