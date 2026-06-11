# Tiled Authoring Rethink

Status: authoring direction. Supersedes the conversion-pipeline mindset.

The core mistake to undo: treating a weak legacy representation as something that can be
deterministically *scripted* into a rich authored world. Every transformation script
(`world-resplit`, `house-regenerate`, standardize/curate passes) muddied the water because it
laundered guesses into canonical-looking data. The replacement discipline:

- **Humans (and careful, image-verified manual edits) author. Machines validate and compile.**
- The exporter is a *compiler with errors*, never an editor. It refuses bad input; it does not
  repair, infer, or invent.
- Every structural improvement happens **once, in the Tiled sources**, verified by looking at
  rendered images — not by re-running a transformation that "should" produce the right thing.

---

## Part 1 — What we actually use today (verified inventory)

Measured against the sources at `assets/maps/tiled/` (Tiled 1.11.2 across all files).

### Maps

| Aspect | world.json | interiors (`maps/house_*`, `mine_floor_001`) |
|---|---|---|
| Size | 172×314, 16px tiles | 14×10 authored rooms |
| Map `class` | `BQMap` | `BQMap` |
| Map properties | `map_id`, `authoring_version`, `default_music`, `default_biome` | `map_id`, `map_kind`, `area_id`, `default_music`, `default_biome`, `camera_policy`, `persistence_scope` |
| Layer tree | deep groups: `render_world/{biome}/…`, `gameplay_markup/*` | grouped `base`, `structure`, `above`, `gameplay` |
| Layer data | raw JSON arrays, no encoding/compression | same |

The original generated interiors were placeholders: no identity, no room semantics, one floor
tile flood plus a blocking ring. The current source pass has replaced the `house_01` through
`house_40` placeholders and `mine_floor_001` with authored `BQMap` files carrying identity,
layer roles, room objects, linked doors, and gameplay metadata.

### Layers

- Group nesting with inherited offset/opacity/visibility/properties — **used and consumed**
  (the flattener honors all of it; sub-tile offsets are a compile error).
- Layer `class` — used for render behavior (`Foreground`, `DepthSorted`) and typed gameplay
  authoring layers (`Room`, `Door`, `ResourceNode`, `RoamingArea`, plus world gameplay classes).
- Custom layer properties — now used heavily on authored interiors for `layer_role`,
  `collision_source`, `occlusion`, `material`, `biome`, and `area_id`. World gameplay still
  depends heavily on layer names: `doors`, `music_zones`, `checkpoints`, `roaming_areas`,
  `resource_nodes`, `chest_areas`, `chest_spawns`, `static_entities`, plus hardcoded
  water/damage name lists (`sea`, `lava`, …) for the debug overlay.
- `shared/maps/layer-contract.ts` pins **64 exact layer paths** mirroring world.json's current
  tree — a snapshot, not a contract. Renaming a layer breaks compilation by design, but the
  contract encodes *this one file's shape* rather than *what layers mean*.

### Objects

- Classes in actual maps: `Room`, `Door`, `ResourceNode`, `RoamingArea` (interiors), plus the
  gameplay_markup classes in world.json (`Checkpoint`, `MusicZone`, `ChestArea`, `ChestSpawn`,
  `StaticEntity`, `PropMetadata`).
- Shapes: **100% rectangles.** No points, ellipses, polygons, polylines, text, no rotation
  (rotation is a compile error).
- Templates: **12 `.tx` files exist and authored rooms/doors now reference them.** Remaining
  opportunity: move more repeated gameplay markers (`ResourceNode`, `RoamingArea`, world doors)
  to templates instead of preserving inline drift-prone property sets.
- Object-to-object reference properties: never used.

### Tilesets

- `tilesheet.wang.tsj` (1,960 tiles): 10 corner wang sets / 2,194 wangtiles — but **no
  wangcolor metadata** (names, per-color properties, probability), so the sets are barely
  usable as in-editor terrain brushes and carry no machine-readable material identity.
  472 tiles have collision rects (shape only — no classes/properties on the shapes), 37
  animated tiles, and three tile property keys: `passable`, `footprint`, `collider`. No tile
  `class`, no probability, no tileoffset.
- `mobs.tsj`: per-tile `type` string (43 tiles). No richer entity semantics.
- `editor-markers.tsj`: 4 marker tiles.

### Project file

- 5 enums (`DoorOrientation`, `MobKind`, `MusicTrackId`, `RenderDepthMode`, `EntityKind`) and
  ~12 classes — this is the *right* mechanism, underused: classes mostly mirror what the
  exporter happens to read, and several (e.g. `Door` with legacy `target_tx/ty`) predate the
  graph-link model.
- 6 editor commands wired to repo validators (good pattern; keep growing it).

### What the compiler consumes vs. ignores

Consumed: group flattening, layer names + the two layer classes, tile collision objectgroups,
`passable` carve, tile animation, door graph properties (`door_id`, `target_map`,
`target_door`, `orientation`, `one_way`, `door_kind`), gameplay object properties listed
above, `objectalignment`, `firstgid`.

Ignored entirely: wang sets (editor-only today), tile classes, wangcolor properties, tile
probability, image layers, text objects, polygons/polylines/points, object rotation, parallax,
tint colors, layer locks, tileset tileoffset, infinite maps/chunks.

**Conclusion:** the format is not the limiting factor — we use perhaps a quarter of it, and the
parts we do use lean on string-matched names and copy-pasted properties instead of the typed
mechanisms (classes, templates, enums, references) Tiled provides.

---

## Part 2 — The full capability surface, with verdicts

| Tiled capability | Verdict | Why / how we should use it |
|---|---|---|
| Map `class` + map properties | **Adopt** | Every map declares its own identity (`BQMap` class below). Identity must live in the map file, not in `map-pack.config.json` aliases. |
| Custom property types: **enums** | **Expand** | Already have 5. Everything currently validated by string convention (`transition_kind`, `collision_kind`, `layer_role`, biome, material) becomes an enum — invalid values become impossible to author. |
| Custom property types: **class-valued properties** (nested structs) | **Adopt** | E.g. a `SpawnPolicy` class property on regions instead of 4 loose scalars. |
| **Object reference properties** (`type: object`) | **Adopt (in-map)** | Real links instead of stringly coordinates: occluder → reveal region, camera region → anchor, sign → its prop, patrol route → spawner. Tiled renders these as arrows in-editor. Cross-map links cannot use them — those stay stable string ids checked by the validator. |
| **Templates** (`.tx`) | **Re-adopt properly** | Place every recurring gameplay object *as a template instance* so property schema changes propagate. Today's 0% usage is why scripted edits drifted. |
| **Point objects** | **Adopt** | Exact spawn points, door camera anchors, NPC stands. A rectangle is the wrong shape for "a spot". |
| **Polygon objects** | **Adopt** | Irregular regions: biome boundaries, music/ambience zones, camera bounds, claim areas. Rectangles force region soup. |
| **Polyline objects** | **Adopt** | Patrol routes, scripted walk paths, river flow hints. |
| **Text objects** | **Adopt (light)** | Author sign/lore copy where the sign stands. Compiler exports to content. |
| **Wang sets with named colors** + per-color properties & probability | **Fix & expand** | Name every material (`grass`, `sand`, `water`, …), attach `material`/`biome` props to wangcolors, set variant probability. This is what makes terrain *paintable* and gives the overlay auditor semantic truth instead of pixel-sniffing. |
| Tile `class` + per-tile properties | **Adopt** | `TerrainTile`/`StructureTile`/`PropTile`/`HazardTile`… with `material`, `asset_family`, `occlusion_kind`, `render_height`. Kills the hardcoded water/lava layer-name lists. |
| Collision shapes per tile (objectgroup) with shape classes | **Expand** | Keep rect collision; add polygon collision for cliffs/diagonals; give shapes classes (`Solid`, `Ledge`, `Water`) so collision *kind* is data. |
| Tile animation | **Keep** | Already consumed. |
| Tile probability + transformations (flip/rotate variants) | **Adopt (editor-side)** | Cheap visual variety when hand-painting; compiler must learn to accept flip bits (currently unhandled) or validator forbids them explicitly — decide, don't ignore. |
| `objectalignment`, `tileoffset` | **Adopt deliberately** | Tall props (trees, totems) anchored at their base; required for honest depth sorting. |
| **Group layers** with inherited props | **Keep, make semantic** | Group = render phase + area (see layer model). |
| Layer tint / opacity | **Selective** | Tint for biome color grading experiments and lighting mock-ups; runtime support only if it earns it. |
| Image layers | **Selective** | Vignettes, light shafts, large one-off backdrops in interiors. Compiler support is trivial (one draw call). |
| Parallax | **Defer** | Top-down 16px world gains little. |
| **Infinite maps / chunks** | **Avoid** | Finite maps per room/region; the server already has its own chunk system. |
| Compression (base64+zstd) | **Avoid for sources** | Raw arrays diff and hand-edit better; size is a runtime-pack concern, not a source concern. |
| **`.world` files** | **Adopt** | The mechanism for splitting the overworld while keeping a shared spatial picture (Part 4). |
| Tiled JS extensions | **Adopt** | In-editor validation actions (run the contract checks without leaving Tiled); already half-there via project commands. |

---

## Part 3 — Layer model: what a layer *means*

Layer names stay human; layer **semantics move to classes + typed properties**. The compiler
keys on `layer_role`/classes, never on name lists. `layer-contract.ts`'s 64-path snapshot is
replaced by a *structural* contract: every layer must carry a role, roles imply allowed
content, group order defines render order.

### Render phases (group order = draw order, top of list = drawn first)

```
base/        ground & water       — what the world IS
below/       decals               — flat detail ON the ground
structure/   walls, cliffs, builds — what stands ON the world
objects/     depth-sorted props   — interleaved with entities by Y
above/       foreground, occluders — what hides the player
lighting/    tint/shadow/image     — optional grading
gameplay/    invisible markup      — never rendered
debug/       authoring annotations — stripped from export
```

### Per-layer/group declaration (class `BQLayer`, properties)

- `layer_role`: enum `base | transition | hazard | decal | structure | object_depth |
  object_fixed | foreground | occluder | lighting | gameplay | debug`
- `collision_source`: enum `none | tile | object | explicit`
- `occlusion`: enum `none | always_front | fade | cutaway`
- `material` / `biome` / `area_id`: tags for audits and selective rebuilds

### Base ground + overlay system (the contract that makes terrain sane)

1. `base/terrain` — exactly **one** ground material in every playable cell. No holes: a hole
   is void, and void is sealed (already enforced). This layer is painted with wang *colors*,
   not raw tiles.
2. `base/terrain_transitions` — one layer **per material pair**, containing only that pair's
   corner-set tiles. Overlay stacking order is the layer order; the rule is authored, not
   inferred.
3. `base/water`, `base/hazard` — semantic kinds come from **tile classes**
   (`WaterTile`, `HazardTile`), not from the layer being named `sea`.
4. `below/decals` — never collides, never transitions; pure paint.

Each wang set gains named colors with `material` properties; the existing pixel-truth corner
audit (`check:tileset-overlays`) keeps validating that the art matches the metadata — auditors
*check* the authored truth, they never write it.

### Occlusion (beyond binary Foreground)

- Keep `Foreground` for always-in-front tiles (canopy fringe, bridge rails).
- New `Occluder` class on layers/objects for roofs, cave lips, tall walls:
  `occlusion_mode: fade | cutaway | hide`, `priority`, and an **object reference** to its
  `RevealRegion` (polygon where the player triggers the fade — e.g. the room under the roof).
- Interior reveal: a roof group + reveal region per building is what makes "enter the house
  visually" possible later without re-authoring.

### Collision

- Tile collision shapes stay the primary source for solid assets; add shape classes so kind
  is queryable (`Solid`, `Water`, `Ledge`).
- `CollisionVolume` objects (rect/polygon) for multi-tile or irregular blockers:
  `collision_kind` enum, `blocks_player/mobs/projectiles`, optional `damage_kind`,
  `damage_per_tick`.
- `passable` carve-outs stay (authored exceptions over tile defaults).
- The `blocking` tile layer remains valid as `collision_source: explicit` for hand-drawn
  collision, but is the fallback, not the default.

---

## Part 4 — Levels, rooms, and file representation

### Splitting the monolith

The 172×314 world.json stays the *overworld* but stops pretending to contain everything else.
Real spaces become real maps:

```
assets/maps/tiled/
  browserquest.tiled-project
  browserquest.world            # spatial arrangement of overworld (+ future overworld slices)
  tilesets/
    terrain.tsj  structures.tsj  props.tsj  entities.tsj  markers.tsj
  maps/
    overworld/world.json        # current world (split later only if authoring pain demands it)
    interiors/<area>_<name>.json
    caves/…   underworld/…   mines/…
  templates/
    doors/  regions/  entities/  interactions/
```

- A **`.world` file** records each overworld map's pixel offset in a shared coordinate space.
  Tiled then renders neighbours in-context while you edit — the main reason authors avoid
  splitting disappears. Start with one entry (world.json); split along natural seams
  (biome boundaries already grouped in `render_world/*`) only when a region is actively being
  reworked, never as a batch conversion.
- Interiors are authored at real size with the full layer model — the current 12×10
  three-layer placeholders get replaced one by one as their doors get authored for real.
- `map-pack.config.json` shrinks to an *ordered list of source files*; ids, kinds, and links
  all live in the maps themselves.

### Map identity (class `BQMap`, required by the validator)

`map_id` (must match filename), `map_kind` enum (`overworld | interior | cave | mine |
underworld | debug`), `area_id`, `default_music`, `default_biome`, `camera_policy` enum
(`clamp_region | center_room`), `persistence_scope`.

### Rooms

`Room` polygon/rect objects in `gameplay/rooms`: `room_id`, `room_kind` enum, optional
`music_override`, `ambient_light`, reference to its occluder group, camera bounds. Rooms give
the camera-region system authored truth (today it infers regions from painted connectivity),
and give doors a home ("a door belongs to exactly one room").

### Links (doors, exits, portals)

Keep the shipped graph-door model (it works and is validated end-to-end) and finish its
authoring story:

- `Door` = physical trigger tile(s): `door_id` (stable string, unique per map), `orientation`,
  `transition_kind` enum (`walk | stairs | cave | ladder | portal`), `one_way`, `enabled`,
  optional `locked_by`.
- Cross-map link = `target_map` + `target_door` string pair (object references can't cross
  files); the validator already enforces existence, reverse links unless `one_way`, explicit
  ids, and walkable egress — keep all of it.
- In-map extras use real object references: `camera_anchor` → point object,
  `reveal_region` → polygon.
- Every door placed from `templates/doors/*.tx`, never hand-assembled.

### Markers and regions (typed objects, right shapes)

| Class | Shape | Key fields |
|---|---|---|
| `SpawnPoint` | point | `entity_kind`, `facing` |
| `RoamingArea` | rect/polygon | `mob_kind`, `count`, `respawn_policy` |
| `PatrolRoute` | polyline | `route_id`, `loop` |
| `MusicRegion` | polygon | `track_id`, `priority`, `fade_ms` |
| `BiomeRegion` | polygon | `biome` (authoritative, replaces layer-name inference) |
| `CameraRegion` | rect/polygon | `policy`, `anchor` (object ref) |
| `Interaction` | rect/point | `interaction_kind` enum (`sign | npc_talk | inspect | harvest`), `content_id` |
| `ResourceNode` | point/rect | `node_id` (**required** — index-fallback ids already proved collision-prone), `resource_kind`, `respawn_days` |
| `ClaimRegion` | rect | ownership/persistence boundary |
| `Sign` | text | the copy itself, exported to content |

`Interaction.content_id` is also the fix-in-data for the NPC identity gap the code review
found: spawned entities carry their content key (`shopkeeper_general`) as authored data, so
the runtime can map entity → content without a hardcoded registry.

---

## Part 5 — Tileset enrichment

- Split the monolithic sheet logically (terrain / structures / props / entities) even if the
  images stay shared atlases — tilesets are where per-asset truth lives.
- Tile classes + properties as in Part 2; minimum viable set: `material`, `asset_family`,
  `occlusion_kind`, `render_height` (rows above base for tall tiles), existing
  `passable | collider | footprint`.
- Wang colors named + propertied + probability for variants; keep `tilesheet.corners.json`
  as the pixel-truth audit sidecar.
- Decide flip/rotate: either the compiler learns the 3 GID flip bits or the validator rejects
  them with a clear message. Silent today = future corrupt-looking tiles.

---

## Part 6 — What the pipeline becomes

**Keep (as compiler/validators):** `processmap.ts` (consume the new typed semantics, drop
name-list special cases), map-pack graph validation, egress checks, overlay corner audit,
world validator, render-cluster/paint audits — all read-only.

**Add:**
1. `propertyTypes` expansion in `browserquest.tiled-project` for every class/enum above (one
   commit, pure data).
2. A **visual review tool**: render any map region / layer subset / door pair to PNG
   (`tools/content/render-map-region.ts`). This is the "slice and observe" loop made
   first-class — the replacement for trusting transformations.
3. Structural layer contract (roles, phase order, content rules) replacing the 64-path
   snapshot in `layer-contract.ts`.
4. In-editor validation command ("Validate current map") via a small Tiled JS extension.

**Retire (move to `tools/content/legacy/` or delete):** `house-regenerate.ts` and any
remaining script whose job is to *mutate* authored maps. Mutation scripts may exist as
one-shot, image-verified migration aids run by a human — never as pipeline steps.

---

## Part 7 — Working order

1. Land the `propertyTypes` + template re-instancing (mechanical, no map redraws).
2. Pick **one** vertical slice: one village house — author the interior for real (full layer
   model, `BQMap`, `Room`, occluder-ready roof on the overworld side), link its door pair,
   render before/after images, play it.
3. Generalize: convert the layer contract to roles; move water/hazard semantics to tile
   classes; wang colors named.
4. Replace interiors one by one as their doors are touched. No batch conversion, ever.
5. Introduce `browserquest.world` when the first overworld seam is actively edited.

Each step leaves the pack compiling and the game playable; nothing waits on a big bang.

---

## Execution slice 1 — `world_house_01_entry` to `house_01_entry`

Status: first manual authoring slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_01_entry.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_01_full.png`
- Legacy in-world interior crop: `.data/map-authoring-crops/world_house_01_legacy_interior.png`

Observed facts:

- `world_house_01_entry` is a real village house facade at world tile `(27, 209)`.
- The linked `house_01` map was a generated 12x10 placeholder: one repeated tile, a blocking
  ring, and an inline door.
- The legacy room still visible in `world.json` around the old destination `(155, 286)` is a
  small wood interior with a blue carpet and a bottom door threshold.

Applied authoring changes:

- Added reusable Tiled project enums/classes for map kind, camera policy, persistence scope,
  room kind, transition kind, layer role, collision source, occlusion mode, `BQMap`, `Room`,
  and `BQLayer`.
- Extended door templates with `transition_kind`, `one_way`, `enabled`, and `locked_by`.
- Added `templates/room.tx`.
- Marked `world.json` as `BQMap` and annotated only the selected source door with the new
  transition metadata.
- Rebuilt `house_01.json` as a real 14x10 authored room:
  - `class: BQMap`
  - map-level identity/properties
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `village_house_01_main_room`
  - a template-backed linked door at local tile `(6, 7)`

After-edit visual evidence:

- `.data/map-authoring-crops/house_01_after.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`

Runtime link after export:

- `world_01:world_house_01_entry` exports to `house_01:house_01_entry` at `(6, 7)`.
- `house_01:house_01_entry` exports back to `world_01:world_house_01_entry` at `(27, 209)`.

## Execution slice 2 — first-class visual review command

Status: map-region visual review tool applied.

Applied tooling changes:

- Added `tools/content/render-map-region.ts` as a read-only visual review command.
- Added package script `render:map-region`.
- The tool renders a rectangular crop from any finite Tiled JSON map to PNG or SVG.
- It resolves external `.tsj` tilesets, masks Tiled flip bits, embeds exact cropped tile
  images, and overlays optional object markers.
- It applies tileset `objectalignment` to tile objects the same way the map compiler does, so
  overworld props/buildings render at their authored anchor points instead of raw object
  coordinates.
- It accepts `--layers all` by default, or a comma-separated list of flattened layer paths or
  layer names for semantic layer review.

Example commands:

```sh
bun run render:map-region -- --map assets/maps/tiled/world.json --x 23 --y 205 --w 10 --h 10 --markers doors --out .data/map-authoring-crops/world_house_01_entry_tool_check.png
bun run render:map-region -- --map assets/maps/tiled/maps/house_01.json --x 0 --y 0 --w 14 --h 10 --markers all --out .data/map-authoring-crops/house_01_after_tool_check.png
bun run render:map-region -- --map assets/maps/tiled/maps/house_01.json --x 0 --y 0 --w 14 --h 10 --layers base/carpet --markers none --out .data/map-authoring-crops/house_01_carpet_layer_tool_check.png
```

Visual evidence:

- `.data/map-authoring-crops/world_house_01_entry_tool_check.png`
- `.data/map-authoring-crops/house_01_after_tool_check.png`
- `.data/map-authoring-crops/house_01_carpet_layer_tool_check.png`

Validation evidence:

- `bun run render:map-region -- --map assets/maps/tiled/maps/house_01.json --x 0 --y 0 --w 14 --h 10 --layers base/carpet --markers none --out .data/map-authoring-crops/house_01_carpet_layer_package_check.png`
- `bun run typecheck:tools`
- `bun run audit:project-surface`
- `bun test tests/unit/project-surface-inventory.test.ts --timeout 20000`
- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`

---

## Execution slice 3 — `world_house_03_entry` to `house_03_entry`

Status: second manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_03_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_03_before.png`

Observed facts:

- `world_house_03_entry` is a small graveyard hut at world tile `(18, 113)`.
- The linked `house_03` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_03.json` as a 14x10 authored graveyard hut interior:
  - `class: BQMap`
  - map-level identity/properties for `graveyard` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `graveyard_hut_03_main_room`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_03_entry` with destination coordinates `(6, 7)` and explicit
  walk-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_03_after.png`
- `.data/map-authoring-crops/house_03_after_nomarkers.png`
- `.data/map-authoring-crops/house_03_rug_after.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_03_entry` exports to `house_03:house_03_entry` at `(6, 7)`.
- `house_03:house_03_entry` exports back to `world_01:world_house_03_entry` at `(18, 113)`.

---

## Execution slice 4 — `world_house_04_entry` to `house_04_entry`

Status: third manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_04_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_04_before.png`

Observed facts:

- `world_house_04_entry` is a sandy badlands/deadlands cliff cave entrance at world tile
  `(70, 80)`, not a house facade.
- The linked `house_04` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_04.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `badlands_cliff` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_cliff_cave_04_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_04_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.
- Corrected the cave wall doorway after `build:maps` caught a colliding door tile.

After-edit visual evidence:

- `.data/map-authoring-crops/house_04_after.png`
- `.data/map-authoring-crops/house_04_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_04_entry` exports to `house_04:house_04_entry` at `(6, 7)`.
- `house_04:house_04_entry` exports back to `world_01:world_house_04_entry` at `(70, 80)`.

---

## Execution slice 5 — `world_house_05_entry` to `house_05_entry`

Status: fourth manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_05_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_05_before.png`

Observed facts:

- `world_house_05_entry` is a dry badlands/deadlands cave doorway at world tile `(79, 45)`.
- The linked `house_05` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_05.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `badlands_dry_cliff` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_dry_cave_05_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_05_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_05_after.png`
- `.data/map-authoring-crops/house_05_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_05_entry` exports to `house_05:house_05_entry` at `(6, 7)`.
- `house_05:house_05_entry` exports back to `world_01:world_house_05_entry` at `(79, 45)`.

---

## Execution slice 6 — `world_house_06_entry` to `house_06_entry`

Status: fifth manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_06_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_06_before.png`

Observed facts:

- `world_house_06_entry` is a cave doorway in the same deadlands/badlands switchback cluster
  as `world_house_05_entry`, at world tile `(78, 40)`.
- The linked `house_06` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_06.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `badlands_switchback_cliff` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_switchback_cave_06_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_06_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_06_after.png`
- `.data/map-authoring-crops/house_06_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_06_entry` exports to `house_06:house_06_entry` at `(6, 7)`.
- `house_06:house_06_entry` exports back to `world_01:world_house_06_entry` at `(78, 40)`.

---

## Execution slice 7 — `world_house_07_entry` to `house_07_entry`

Status: sixth manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_07_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_07_before.png`

Observed facts:

- `world_house_07_entry` is a round badlands/deadlands canyon cave pocket at world tile
  `(91, 29)`, visually distinct from the switchback corridor entries.
- The linked `house_07` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_07.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `badlands_canyon_pocket` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_canyon_cave_07_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_07_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_07_after.png`
- `.data/map-authoring-crops/house_07_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_07_entry` exports to `house_07:house_07_entry` at `(6, 7)`.
- `house_07:house_07_entry` exports back to `world_01:world_house_07_entry` at `(91, 29)`.

---

## Execution slice 8 — `world_house_08_entry` to `house_08_entry`

Status: seventh manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_08_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_08_before.png`

Observed facts:

- `world_house_08_entry` is a badlands/lava-canyon doorway at world tile `(6, 10)`, with
  nearby lava and canyon layers in the rendered world source.
- The linked `house_08` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_08.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `badlands_lava_canyon` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_lava_cave_08_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_08_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_08_after.png`
- `.data/map-authoring-crops/house_08_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_08_entry` exports to `house_08:house_08_entry` at `(6, 7)`.
- `house_08:house_08_entry` exports back to `world_01:world_house_08_entry` at `(6, 10)`.

---

## Execution slice 9 — `world_house_09_entry` to `house_09_entry`

Status: eighth manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_09_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_09_before.png`

Observed facts:

- `world_house_09_entry` is a round badlands/deadlands crater cave pocket at world tile
  `(9, 17)`, with lava and lava-boundary layers nearby in the world source.
- The linked `house_09` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_09.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `badlands_crater_pocket` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_crater_cave_09_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_09_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_09_after.png`
- `.data/map-authoring-crops/house_09_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_09_entry` exports to `house_09:house_09_entry` at `(6, 7)`.
- `house_09:house_09_entry` exports back to `world_01:world_house_09_entry` at `(9, 17)`.

---

## Execution slice 10 — `world_house_10_entry` to `house_10_entry`

Status: ninth manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_10_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_10_before.png`

Observed facts:

- `world_house_10_entry` is a lava-edge badlands cave doorway at world tile `(104, 7)`,
  adjacent to lava and canyon terrain.
- The linked `house_10` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_10.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `badlands_lava_rim` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_lava_rim_cave_10_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_10_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_10_after.png`
- `.data/map-authoring-crops/house_10_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_10_entry` exports to `house_10:house_10_entry` at `(6, 7)`.
- `house_10:house_10_entry` exports back to `world_01:world_house_10_entry` at `(104, 7)`.

---

## Execution slice 11 — `world_house_11_entry` to `house_11_entry`

Status: tenth manual interior slice applied.

Evidence gathered before editing:

- World-side visual crop: `.data/map-authoring-crops/world_house_11_entry_before.png`
- Placeholder destination crop: `.data/map-authoring-crops/house_11_before.png`

Observed facts:

- `world_house_11_entry` is a forest-riverbank cliff doorway at world tile `(20, 145)`,
  bordered by water, grass, forest, and cliff-boundary layers.
- The linked `house_11` map was still a generated 12x10 placeholder: one repeated floor tile,
  a blocking ring, and an inline non-template door.

Applied authoring changes:

- Rebuilt `house_11.json` as a 14x10 authored cave chamber:
  - `class: BQMap`
  - map-level identity/properties for `forest_riverbank` / `subterranean_forest`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_riverbank_cave_11_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_11_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_11_after.png`
- `.data/map-authoring-crops/house_11_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_11_entry` exports to `house_11:house_11_entry` at `(6, 7)`.
- `house_11:house_11_entry` exports back to `world_01:world_house_11_entry` at `(20, 145)`.

## Execution slice 12 — `world_house_12_entry` to `house_12_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_12` with an authored interior based on direct exterior evidence.
- Update only `world_house_12_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_12_entry` was at world tile `(51, 205)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_12` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a real village building entrance with mud, grass, stone, and
  village-boundary terrain rather than cliff/cave context.

Visual references:

- `.data/map-authoring-crops/world_house_12_entry_before.png`
- `.data/map-authoring-crops/house_12_before.png`
- `.data/map-authoring-crops/house_01_reference.png`

Applied authoring changes:

- Rebuilt `house_12.json` as a 14x10 authored village house interior:
  - `class: BQMap`
  - map-level identity/properties for `house_12` / `village_square` / `village`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties inherited from the authored
    village-house pattern
  - a `Room` object for `village_house_12_main_room`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_12_entry` with destination coordinates `(6, 7)` and explicit
  walk-transition metadata.
- Restored an accidental repeated-pattern edit to `world_house_02_entry` before validation;
  source checks confirmed `world_house_02_entry`, `world_house_11_entry`, and
  `world_house_13_entry` were not changed by the final slice.

After-edit visual evidence:

- `.data/map-authoring-crops/house_12_after.png`
- `.data/map-authoring-crops/house_12_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_12_entry` exports to `house_12:house_12_entry` at `(6, 7)`.
- `house_12:house_12_entry` exports back to `world_01:world_house_12_entry` at `(51, 205)`.

## Execution slice 13 — `world_house_13_entry` to `house_13_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_13` with an authored interior based on direct exterior evidence.
- Update only `world_house_13_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_13_entry` was at world tile `(74, 145)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_13` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a forest-edge doorway built into a stump/log boundary rather
  than a village facade or cliff cave.

Visual references:

- `.data/map-authoring-crops/world_house_13_entry_before.png`
- `.data/map-authoring-crops/house_13_before.png`

Applied authoring changes:

- Rebuilt `house_13.json` as a 14x10 authored forest-threshold hut interior:
  - `class: BQMap`
  - map-level identity/properties for `house_13` / `forest_threshold` / `forest`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_threshold_hut_13_main_room`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_13_entry` with destination coordinates `(6, 7)` and explicit
  walk-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_13_after.png`
- `.data/map-authoring-crops/house_13_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_13_entry` exports to `house_13:house_13_entry` at `(6, 7)`.
- `house_13:house_13_entry` exports back to `world_01:world_house_13_entry` at `(74, 145)`.

## Execution slice 14 — `world_house_14_entry` to `house_14_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_14` with an authored interior based on direct exterior evidence.
- Update only `world_house_14_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_14_entry` was at world tile `(65, 125)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_14` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a deadlands/badlands boundary doorway in a low cliff/boulder
  wall, not a village building facade.

Visual references:

- `.data/map-authoring-crops/world_house_14_entry_before.png`
- `.data/map-authoring-crops/house_14_before.png`

Applied authoring changes:

- Rebuilt `house_14.json` as a 14x10 authored deadlands cave pocket:
  - `class: BQMap`
  - map-level identity/properties for `house_14` / `deadlands_escarpment` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `deadlands_escarpment_cave_14_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_14_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_14_after.png`
- `.data/map-authoring-crops/house_14_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_14_entry` exports to `house_14:house_14_entry` at `(6, 7)`.
- `house_14:house_14_entry` exports back to `world_01:world_house_14_entry` at `(65, 125)`.

## Execution slice 15 — `world_house_15_entry` to `house_15_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_15` with an authored interior based on direct exterior evidence.
- Update only `world_house_15_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_15_entry` was at world tile `(71, 3)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_15` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a lava-canyon cave doorway directly above a bridge, with
  badlands, lava, canyon, cliff, bridge, and foreground-cliff layers present.

Visual references:

- `.data/map-authoring-crops/world_house_15_entry_before.png`
- `.data/map-authoring-crops/house_15_before.png`

Applied authoring changes:

- Rebuilt `house_15.json` as a 14x10 authored badlands bridge-canyon cave:
  - `class: BQMap`
  - map-level identity/properties for `house_15` / `badlands_bridge_canyon` / `badlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_bridge_canyon_cave_15_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_15_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_15_after.png`
- `.data/map-authoring-crops/house_15_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_15_entry` exports to `house_15:house_15_entry` at `(6, 7)`.
- `house_15:house_15_entry` exports back to `world_01:world_house_15_entry` at `(71, 3)`.

## Execution slice 16 — `world_house_16_entry` to `house_16_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_16` with an authored interior based on direct exterior evidence.
- Update only `world_house_16_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_16_entry` was at world tile `(18, 86)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_16` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a small deadlands cliff doorway with dry ground and badlands
  cliff layers, not a building facade.

Visual references:

- `.data/map-authoring-crops/world_house_16_entry_before.png`
- `.data/map-authoring-crops/house_16_before.png`

Applied authoring changes:

- Rebuilt `house_16.json` as a 14x10 authored deadlands dry-cliff cave:
  - `class: BQMap`
  - map-level identity/properties for `house_16` / `deadlands_dry_cliff` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `deadlands_dry_cliff_cave_16_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_16_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_16_after.png`
- `.data/map-authoring-crops/house_16_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_16_entry` exports to `house_16:house_16_entry` at `(6, 7)`.
- `house_16:house_16_entry` exports back to `world_01:world_house_16_entry` at `(18, 86)`.

## Execution slice 17 — `world_house_17_entry` to `house_17_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_17` with an authored interior based on direct exterior evidence.
- Update only `world_house_17_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_17_entry` was at world tile `(19, 77)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_17` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a sandy deadlands low-cliff doorway with dry ground and
  badlands cliff layers, not a house facade.

Visual references:

- `.data/map-authoring-crops/world_house_17_entry_before.png`
- `.data/map-authoring-crops/house_17_before.png`

Applied authoring changes:

- Rebuilt `house_17.json` as a 14x10 authored deadlands sandy-cliff cave:
  - `class: BQMap`
  - map-level identity/properties for `house_17` / `deadlands_sandy_cliff` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `deadlands_sandy_cliff_cave_17_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_17_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_17_after.png`
- `.data/map-authoring-crops/house_17_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_17_entry` exports to `house_17:house_17_entry` at `(6, 7)`.
- `house_17:house_17_entry` exports back to `world_01:world_house_17_entry` at `(19, 77)`.

## Execution slice 18 — `world_house_18_entry` to `house_18_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_18` with an authored interior based on direct exterior evidence.
- Update only `world_house_18_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_18_entry` was at world tile `(16, 135)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_18` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a graveyard-edge cliff doorway with gravestones, fence, dead
  grass, dry ground, and nearby forest/lake boundary layers.

Visual references:

- `.data/map-authoring-crops/world_house_18_entry_before.png`
- `.data/map-authoring-crops/house_18_before.png`

Applied authoring changes:

- Rebuilt `house_18.json` as a 14x10 authored graveyard-boundary crypt chamber:
  - `class: BQMap`
  - map-level identity/properties for `house_18` / `graveyard_boundary` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `graveyard_boundary_crypt_18_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_18_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_18_after.png`
- `.data/map-authoring-crops/house_18_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_18_entry` exports to `house_18:house_18_entry` at `(6, 7)`.
- `house_18:house_18_entry` exports back to `world_01:world_house_18_entry` at `(16, 135)`.

## Execution slice 19 — `world_house_19_entry` to `house_19_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_19` with an authored interior based on direct exterior evidence.
- Update only `world_house_19_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_19_entry` was at world tile `(71, 21)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_19` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a dark badlands cliff/canyon doorway with dry badlands ground
  and cliff layers, not a building facade.

Visual references:

- `.data/map-authoring-crops/world_house_19_entry_before.png`
- `.data/map-authoring-crops/house_19_before.png`

Applied authoring changes:

- Rebuilt `house_19.json` as a 14x10 authored badlands dark-canyon cave:
  - `class: BQMap`
  - map-level identity/properties for `house_19` / `badlands_dark_canyon` / `badlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_dark_canyon_cave_19_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_19_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_19_after.png`
- `.data/map-authoring-crops/house_19_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_19_entry` exports to `house_19:house_19_entry` at `(6, 7)`.
- `house_19:house_19_entry` exports back to `world_01:world_house_19_entry` at `(71, 21)`.

## Execution slice 20 — `world_house_20_entry` to `house_20_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_20` with an authored interior based on direct exterior evidence.
- Update only `world_house_20_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_20_entry` was at world tile `(155, 86)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_20` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a doorway already inside a subterranean cavern chamber, with
  cave floor and cave-wall layers rather than overworld terrain.

Visual references:

- `.data/map-authoring-crops/world_house_20_entry_before.png`
- `.data/map-authoring-crops/house_20_before.png`

Applied authoring changes:

- Rebuilt `house_20.json` as a 14x10 authored subterranean cavern pocket:
  - `class: BQMap`
  - map-level identity/properties for `house_20` / `subterranean_cavern` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `subterranean_cavern_20_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_20_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_20_after.png`
- `.data/map-authoring-crops/house_20_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_20_entry` exports to `house_20:house_20_entry` at `(6, 7)`.
- `house_20:house_20_entry` exports back to `world_01:world_house_20_entry` at `(155, 86)`.

## Execution slice 21 — `world_house_21_entry` to `house_21_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_21` with an authored interior based on direct exterior evidence.
- Update only `world_house_21_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_21_entry` was at world tile `(78, 137)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_21` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a visible small wooden hut beside a forest/deadlands boundary
  cliff, so this slice needed an authored hut interior rather than another cave.

Visual references:

- `.data/map-authoring-crops/world_house_21_entry_before.png`
- `.data/map-authoring-crops/house_21_before.png`

Applied authoring changes:

- Rebuilt `house_21.json` as a 14x10 authored forest-boundary hut:
  - `class: BQMap`
  - map-level identity/properties for `house_21` / `forest_boundary_hut` / `forest`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_boundary_hut_21_main_room`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_21_entry` with destination coordinates `(6, 7)` and explicit
  walk-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_21_after.png`
- `.data/map-authoring-crops/house_21_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_21_entry` exports to `house_21:house_21_entry` at `(6, 7)`.
- `house_21:house_21_entry` exports back to `world_01:world_house_21_entry` at `(78, 137)`.

## Execution slice 22 — `world_house_22_entry` to `house_22_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_22` with an authored interior based on direct exterior evidence.
- Update only `world_house_22_entry` in `world.json`.
- Keep adjacent `world_house_23_entry` unchanged.

Before-edit evidence:

- `world_house_22_entry` was at world tile `(79, 102)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_22` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed two adjacent deadlands cliff doorways; `house_22` is the
  right-hand/east entry and `house_23` remains the left-hand neighboring placeholder.

Visual references:

- `.data/map-authoring-crops/world_house_22_entry_before.png`
- `.data/map-authoring-crops/house_22_before.png`

Applied authoring changes:

- Rebuilt `house_22.json` as a 14x10 authored deadlands twin-cliff east cave:
  - `class: BQMap`
  - map-level identity/properties for `house_22` / `deadlands_twin_cliff_east` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `deadlands_twin_cliff_22_east_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_22_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_22_after.png`
- `.data/map-authoring-crops/house_22_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_22_entry` exports to `house_22:house_22_entry` at `(6, 7)`.
- `house_22:house_22_entry` exports back to `world_01:world_house_22_entry` at `(79, 102)`.

## Execution slice 23 — `world_house_23_entry` to `house_23_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_23` with an authored interior based on direct exterior evidence.
- Update only `world_house_23_entry` in `world.json`.
- Keep neighboring `world_house_22_entry` unchanged after its previous slice.

Before-edit evidence:

- `world_house_23_entry` was at world tile `(75, 102)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_23` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed the left-hand/west entry in the same two-door deadlands cliff
  pair as slice 22.

Visual references:

- `.data/map-authoring-crops/world_house_23_entry_before.png`
- `.data/map-authoring-crops/house_23_before.png`

Applied authoring changes:

- Rebuilt `house_23.json` as a 14x10 authored deadlands twin-cliff west cave:
  - `class: BQMap`
  - map-level identity/properties for `house_23` / `deadlands_twin_cliff_west` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `deadlands_twin_cliff_23_west_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_23_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_23_after.png`
- `.data/map-authoring-crops/house_23_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_23_entry` exports to `house_23:house_23_entry` at `(6, 7)`.
- `house_23:house_23_entry` exports back to `world_01:world_house_23_entry` at `(75, 102)`.

## Execution slice 24 — `world_house_24_entry` to `house_24_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_24` with an authored interior based on direct exterior evidence.
- Update only `world_house_24_entry` in `world.json`.
- Keep neighboring placeholder doors unchanged.

Before-edit evidence:

- `world_house_24_entry` was at world tile `(158, 208)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_24` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a doorway in a forest maze chamber with maze floor, maze wall,
  and foreground maze-wall layers, not a normal overworld house or dry cliff cave.

Visual references:

- `.data/map-authoring-crops/world_house_24_entry_before.png`
- `.data/map-authoring-crops/house_24_before.png`

Applied authoring changes:

- Rebuilt `house_24.json` as a 14x10 authored forest-maze east side chamber:
  - `class: BQMap`
  - map-level identity/properties for `house_24` / `forest_maze_east_chamber` / `maze`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_maze_24_east_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_24_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_24_after.png`
- `.data/map-authoring-crops/house_24_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_24_entry` exports to `house_24:house_24_entry` at `(6, 7)`.
- `house_24:house_24_entry` exports back to `world_01:world_house_24_entry` at `(158, 208)`.

## Execution slice 25 — `world_house_25_entry` to `house_25_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_25` with an authored interior based on direct exterior evidence.
- Update only `world_house_25_entry` in `world.json`.
- Keep neighboring `world_house_26_entry` unchanged.

Before-edit evidence:

- `world_house_25_entry` was at world tile `(154, 196)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_25` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a row of maze/cavern side doors; `house_25` is the left/west
  entry in the visible pair and `house_26` remains the neighboring placeholder.

Visual references:

- `.data/map-authoring-crops/world_house_25_entry_before.png`
- `.data/map-authoring-crops/house_25_before.png`

Applied authoring changes:

- Rebuilt `house_25.json` as a 14x10 authored forest-maze west side chamber:
  - `class: BQMap`
  - map-level identity/properties for `house_25` / `forest_maze_west_chamber` / `maze`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_maze_25_west_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_25_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_25_after.png`
- `.data/map-authoring-crops/house_25_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_25_entry` exports to `house_25:house_25_entry` at `(6, 7)`.
- `house_25:house_25_entry` exports back to `world_01:world_house_25_entry` at `(154, 196)`.

## Execution slice 26 — `world_house_26_entry` to `house_26_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_26` with an authored interior based on direct exterior evidence.
- Update only `world_house_26_entry` in `world.json`.
- Keep neighboring `world_house_25_entry` unchanged after its previous slice.

Before-edit evidence:

- `world_house_26_entry` was at world tile `(162, 196)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_26` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed the right/east door in the same maze/cavern side-door row as
  slice 25, with cave, maze floor, maze wall, and foreground wall layers present.

Visual references:

- `.data/map-authoring-crops/world_house_26_entry_before.png`
- `.data/map-authoring-crops/house_26_before.png`

Applied authoring changes:

- Rebuilt `house_26.json` as a 14x10 authored forest-maze east side chamber:
  - `class: BQMap`
  - map-level identity/properties for `house_26` / `forest_maze_east_chamber_26` / `maze`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_maze_26_east_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_26_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_26_after.png`
- `.data/map-authoring-crops/house_26_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_26_entry` exports to `house_26:house_26_entry` at `(6, 7)`.
- `house_26:house_26_entry` exports back to `world_01:world_house_26_entry` at `(162, 196)`.

## Execution slice 27 — `world_house_27_entry` to `house_27_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_27` with an authored interior based on direct exterior evidence.
- Update only `world_house_27_entry` in `world.json`.
- Keep neighboring `world_house_28_entry` unchanged.

Before-edit evidence:

- `world_house_27_entry` was at world tile `(127, 208)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_27` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed the left/west entry in another adjacent forest-maze door pair
  with maze floor, maze walls, and maze foreground-wall layers.

Visual references:

- `.data/map-authoring-crops/world_house_27_entry_before.png`
- `.data/map-authoring-crops/house_27_before.png`

Applied authoring changes:

- Rebuilt `house_27.json` as a 14x10 authored forest-maze west alcove:
  - `class: BQMap`
  - map-level identity/properties for `house_27` / `forest_maze_west_alcove` / `maze`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_maze_27_west_alcove`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_27_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_27_after.png`
- `.data/map-authoring-crops/house_27_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_27_entry` exports to `house_27:house_27_entry` at `(6, 7)`.
- `house_27:house_27_entry` exports back to `world_01:world_house_27_entry` at `(127, 208)`.

## Execution slice 28 — `world_house_28_entry` to `house_28_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_28` with an authored interior based on direct exterior evidence.
- Update only `world_house_28_entry` in `world.json`.
- Keep neighboring `world_house_29_entry` unchanged.

Before-edit evidence:

- `world_house_28_entry` was at world tile `(131, 208)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_28` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed the right/east entry in the same adjacent forest-maze door pair
  as `house_27`, using maze floor, maze wall, and maze foreground-wall layers.

Visual references:

- `.data/map-authoring-crops/world_house_28_entry_before.png`
- `.data/map-authoring-crops/house_28_before.png`

Applied authoring changes:

- Rebuilt `house_28.json` as a 14x10 authored forest-maze east alcove:
  - `class: BQMap`
  - map-level identity/properties for `house_28` / `forest_maze_east_alcove` / `maze`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_maze_28_east_alcove`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_28_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_28_after.png`
- `.data/map-authoring-crops/house_28_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_28_entry` exports to `house_28:house_28_entry` at `(6, 7)`.
- `house_28:house_28_entry` exports back to `world_01:world_house_28_entry` at `(131, 208)`.

## Execution slice 29 — `world_house_29_entry` to `house_29_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_29` with an authored interior based on direct exterior evidence.
- Update only `world_house_29_entry` in `world.json`.
- Keep neighboring authored doors `world_house_27_entry` and `world_house_28_entry` unchanged,
  and keep later placeholder `world_house_30_entry` out of scope.

Before-edit evidence:

- `world_house_29_entry` was at world tile `(123, 208)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_29` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed the far-west doorway in a three-door forest-maze alcove row,
  with `house_27` and `house_28` to the east.

Visual references:

- `.data/map-authoring-crops/world_house_29_entry_before.png`
- `.data/map-authoring-crops/house_29_before.png`

Applied authoring changes:

- Rebuilt `house_29.json` as a 14x10 authored forest-maze far-west alcove:
  - `class: BQMap`
  - map-level identity/properties for `house_29` / `forest_maze_far_west_alcove` / `maze`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_maze_29_far_west_alcove`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_29_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_29_after.png`
- `.data/map-authoring-crops/house_29_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_29_entry` exports to `house_29:house_29_entry` at `(6, 7)`.
- `house_29:house_29_entry` exports back to `world_01:world_house_29_entry` at `(123, 208)`.

## Execution slice 30 — `world_house_30_entry` to `house_30_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_30` with an authored interior based on direct exterior evidence.
- Update only `world_house_30_entry` in `world.json`.
- Keep later placeholder `world_house_31_entry` unchanged.

Before-edit evidence:

- `world_house_30_entry` was at world tile `(127, 183)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_30` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a compact standalone forest-maze chamber with a north-wall
  doorway flanked by torches.

Visual references:

- `.data/map-authoring-crops/world_house_30_entry_before.png`
- `.data/map-authoring-crops/house_30_before.png`

Applied authoring changes:

- Rebuilt `house_30.json` as a 14x10 authored forest-maze north chamber:
  - `class: BQMap`
  - map-level identity/properties for `house_30` / `forest_maze_north_chamber` / `maze`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `forest_maze_30_north_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_30_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_30_after.png`
- `.data/map-authoring-crops/house_30_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_30_entry` exports to `house_30:house_30_entry` at `(6, 7)`.
- `house_30:house_30_entry` exports back to `world_01:world_house_30_entry` at `(127, 183)`.

## Execution slice 31 — `world_house_31_entry` to `house_31_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_31` with an authored interior based on direct exterior evidence.
- Update only `world_house_31_entry` in `world.json`.
- Keep nearby cliff-side placeholder `world_house_32_entry` unchanged.

Before-edit evidence:

- `world_house_31_entry` was at world tile `(77, 206)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_31` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed the doorway on the visible large village inn/house, with the
  separate `world_house_32_entry` cliff-side doorway nearby but not part of this slice.

Visual references:

- `.data/map-authoring-crops/world_house_31_entry_before.png`
- `.data/map-authoring-crops/house_31_before.png`

Applied authoring changes:

- Rebuilt `house_31.json` as a 14x10 authored village inn interior:
  - `class: BQMap`
  - map-level identity/properties for `house_31` / `village_inn` / `village`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `village_inn_31_main_room`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_31_entry` with destination coordinates `(6, 7)` and explicit
  walk-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_31_after.png`
- `.data/map-authoring-crops/house_31_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_31_entry` exports to `house_31:house_31_entry` at `(6, 7)`.
- `house_31:house_31_entry` exports back to `world_01:world_house_31_entry` at `(77, 206)`.

## Execution slice 32 — `world_house_32_entry` to `house_32_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_32` with an authored interior based on direct exterior evidence.
- Update only `world_house_32_entry` in `world.json`.
- Keep later placeholder `world_house_33_entry` unchanged.

Before-edit evidence:

- `world_house_32_entry` was at world tile `(92, 52)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_32` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a cliff-side doorway inside a badlands lava-canyon region,
  with dry badlands ground, lava, canyon, and cliff layers present in the source.

Visual references:

- `.data/map-authoring-crops/world_house_32_entry_before.png`
- `.data/map-authoring-crops/house_32_before.png`

Applied authoring changes:

- Rebuilt `house_32.json` as a 14x10 authored badlands lava-canyon cave:
  - `class: BQMap`
  - map-level identity/properties for `house_32` / `badlands_lava_canyon` / `badlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `badlands_lava_canyon_32_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_32_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_32_after.png`
- `.data/map-authoring-crops/house_32_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_32_entry` exports to `house_32:house_32_entry` at `(6, 7)`.
- `house_32:house_32_entry` exports back to `world_01:world_house_32_entry` at `(92, 52)`.

## Execution slice 33 — `world_house_33_entry` to `house_33_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_33` with an authored interior based on direct exterior evidence.
- Update only `world_house_33_entry` in `world.json`.
- Keep later placeholder `world_house_34_entry` unchanged.

Before-edit evidence:

- `world_house_33_entry` was at world tile `(135, 88)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_33` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a small subterranean cave pocket with black cave floor, cave
  walls, and a nearby lava pool.

Visual references:

- `.data/map-authoring-crops/world_house_33_entry_before.png`
- `.data/map-authoring-crops/house_33_before.png`

Applied authoring changes:

- Rebuilt `house_33.json` as a 14x10 authored subterranean lava pocket:
  - `class: BQMap`
  - map-level identity/properties for `house_33` / `subterranean_lava_pocket` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `subterranean_lava_pocket_33_chamber`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_33_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_33_after.png`
- `.data/map-authoring-crops/house_33_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_33_entry` exports to `house_33:house_33_entry` at `(6, 7)`.
- `house_33:house_33_entry` exports back to `world_01:world_house_33_entry` at `(135, 88)`.

## Execution slice 34 — `world_house_34_entry` to `house_34_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_34` with an authored interior based on direct exterior evidence.
- Update only `world_house_34_entry` in `world.json`.
- Keep later placeholder `world_house_35_entry` unchanged.

Before-edit evidence:

- `world_house_34_entry` was at world tile `(156, 181)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_34` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a compact subterranean cave chamber with a ladder-like north
  entrance and torch-lit cave walls.

Visual references:

- `.data/map-authoring-crops/world_house_34_entry_before.png`
- `.data/map-authoring-crops/house_34_before.png`

Applied authoring changes:

- Rebuilt `house_34.json` as a 14x10 authored subterranean ladder chamber:
  - `class: BQMap`
  - map-level identity/properties for `house_34` / `subterranean_ladder_chamber` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `subterranean_ladder_chamber_34`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_34_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_34_after.png`
- `.data/map-authoring-crops/house_34_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_34_entry` exports to `house_34:house_34_entry` at `(6, 7)`.
- `house_34:house_34_entry` exports back to `world_01:world_house_34_entry` at `(156, 181)`.

## Execution slice 35 — `world_house_35_entry` to `house_35_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_35` with an authored interior based on direct exterior evidence.
- Update only `world_house_35_entry` in `world.json`.
- Keep nearby placeholder `world_house_36_entry` unchanged.

Before-edit evidence:

- `world_house_35_entry` was at world tile `(155, 158)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_35` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a subterranean north ladder entry feeding a wider east-west
  cave tunnel/chamber.

Visual references:

- `.data/map-authoring-crops/world_house_35_entry_before.png`
- `.data/map-authoring-crops/house_35_before.png`

Applied authoring changes:

- Rebuilt `house_35.json` as a 14x10 authored subterranean tunnel junction:
  - `class: BQMap`
  - map-level identity/properties for `house_35` / `subterranean_tunnel_junction` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `subterranean_tunnel_junction_35`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_35_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_35_after.png`
- `.data/map-authoring-crops/house_35_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_35_entry` exports to `house_35:house_35_entry` at `(6, 7)`.
- `house_35:house_35_entry` exports back to `world_01:world_house_35_entry` at `(155, 158)`.

## Execution slice 36 — `world_house_36_entry` to `house_36_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_36` with an authored interior based on direct exterior evidence.
- Update only `world_house_36_entry` in `world.json`.
- Keep later placeholder `world_house_37_entry` unchanged.

Before-edit evidence:

- `world_house_36_entry` was at world tile `(127, 158)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_36` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a compact subterranean chamber with a north ladder entrance
  and a visible cave-river/water inlet.

Visual references:

- `.data/map-authoring-crops/world_house_36_entry_before.png`
- `.data/map-authoring-crops/house_36_before.png`

Applied authoring changes:

- Rebuilt `house_36.json` as a 14x10 authored subterranean river chamber:
  - `class: BQMap`
  - map-level identity/properties for `house_36` / `subterranean_river_chamber` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - a visible `cave_river` base layer that keeps the exit path clear
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `subterranean_river_chamber_36`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_36_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_36_after.png`
- `.data/map-authoring-crops/house_36_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_36_entry` exports to `house_36:house_36_entry` at `(6, 7)`.
- `house_36:house_36_entry` exports back to `world_01:world_house_36_entry` at `(127, 158)`.

## Execution slice 37 — `world_house_37_entry` to `house_37_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_37` with an authored interior based on direct exterior evidence.
- Update only `world_house_37_entry` in `world.json`.
- Keep later placeholder `world_house_38_entry` unchanged.

Before-edit evidence:

- `world_house_37_entry` was at world tile `(26, 296)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_37` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a beach/coastal cliff doorway just above the shoreline, with a
  separate nearby door marker kept out of scope.

Visual references:

- `.data/map-authoring-crops/world_house_37_entry_before.png`
- `.data/map-authoring-crops/house_37_before.png`

Applied authoring changes:

- Rebuilt `house_37.json` as a 14x10 authored beach cliff shelter:
  - `class: BQMap`
  - map-level identity/properties for `house_37` / `beach_cliff_shelter` / `beach`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - a visible sand inset in the base floor near the entry to carry the coastal context
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `beach_cliff_shelter_37`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_37_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_37_after.png`
- `.data/map-authoring-crops/house_37_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_37_entry` exports to `house_37:house_37_entry` at `(6, 7)`.
- `house_37:house_37_entry` exports back to `world_01:world_house_37_entry` at `(26, 296)`.

## Execution slice 38 — `world_house_38_entry` to `house_38_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_38` with an authored interior based on direct exterior evidence.
- Update only `world_house_38_entry` in `world.json`.
- Keep later placeholder `world_house_39_entry` unchanged.

Before-edit evidence:

- `world_house_38_entry` was at world tile `(49, 97)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_38` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a sandy deadlands/badlands cliff doorway in a canyon corridor
  with cactus, ruin columns, and a nearby campfire.

Visual references:

- `.data/map-authoring-crops/world_house_38_entry_before.png`
- `.data/map-authoring-crops/house_38_before.png`

Applied authoring changes:

- Rebuilt `house_38.json` as a 14x10 authored deadlands canyon shelter:
  - `class: BQMap`
  - map-level identity/properties for `house_38` / `deadlands_canyon_shelter` / `deadlands`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - a visible dry-ground inset near the entry to carry the sandy canyon context
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `deadlands_canyon_shelter_38`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_38_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_38_after.png`
- `.data/map-authoring-crops/house_38_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_38_entry` exports to `house_38:house_38_entry` at `(6, 7)`.
- `house_38:house_38_entry` exports back to `world_01:world_house_38_entry` at `(49, 97)`.

## Execution slice 39 — `world_house_39_entry` to `house_39_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_39` with an authored interior based on direct exterior evidence.
- Update only `world_house_39_entry` in `world.json`.
- Keep later placeholder `world_house_40_entry` unchanged.

Before-edit evidence:

- `world_house_39_entry` was at world tile `(147, 254)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_39` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- The exterior crop showed a subterranean west-end ladder entrance into a long eastward
  cave passage.

Visual references:

- `.data/map-authoring-crops/world_house_39_entry_before.png`
- `.data/map-authoring-crops/house_39_before.png`

Applied authoring changes:

- Rebuilt `house_39.json` as a 14x10 authored subterranean passage head:
  - `class: BQMap`
  - map-level identity/properties for `house_39` / `subterranean_passage_head` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `subterranean_passage_head_39`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_39_entry` with destination coordinates `(6, 7)` and explicit
  cave-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_39_after.png`
- `.data/map-authoring-crops/house_39_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_39_entry` exports to `house_39:house_39_entry` at `(6, 7)`.
- `house_39:house_39_entry` exports back to `world_01:world_house_39_entry` at `(147, 254)`.

## Execution slice 40 — `world_house_40_entry` to `house_40_entry`

Status: complete.

Ticket scope:

- Replace the placeholder `house_40` with an authored interior based on direct exterior evidence.
- Update only `world_house_40_entry` in `world.json`.
- Do not fabricate additional extracted house maps beyond the current `house_01` through `house_40` set.

Before-edit evidence:

- `world_house_40_entry` was at world tile `(38, 245)` and still targeted placeholder
  local tile `(3, 3)`.
- `house_40` was still the generated 12x10 placeholder with `floor`, `blocking`, and an
  inline `doors` object layer.
- No `house_41.json` exists, so `house_40` was the final current extracted house placeholder
  candidate.
- The exterior crop showed a prominent village house on a raised overworld plateau, with
  a south-facing door and ladder approach.

Visual references:

- `.data/map-authoring-crops/world_house_40_entry_before.png`
- `.data/map-authoring-crops/house_40_before.png`

Applied authoring changes:

- Rebuilt `house_40.json` as a 14x10 authored village plateau house:
  - `class: BQMap`
  - map-level identity/properties for `house_40` / `village_plateau_house` / `village`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `village_plateau_house_40_main_room`
  - a template-backed linked door at local tile `(6, 7)`
- Updated only `world_house_40_entry` with destination coordinates `(6, 7)` and explicit
  walk-transition metadata.

After-edit visual evidence:

- `.data/map-authoring-crops/house_40_after.png`
- `.data/map-authoring-crops/house_40_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- Runtime graph probe for `world_house_40_entry` / `house_40_entry`
- Placeholder scan for `house_*.json` returned `[]`
- `git diff --check`

Runtime link after export:

- `world_01:world_house_40_entry` exports to `house_40:house_40_entry` at `(6, 7)`.
- `house_40:house_40_entry` exports back to `world_01:world_house_40_entry` at `(38, 245)`.

## Execution slice 41 — `mine_floor_001` enrichment

Status: complete.

Ticket scope:

- Replace the flat `mine_floor_001` source shape with a rich authored map structure.
- Preserve the existing simple mines gameplay loop: `mine_exit`, `mine_ore_001`, and `mine_bats`.
- Preserve the real world entrance and one-way test entrance linkage semantics.

Before-edit evidence:

- `mine_floor_001` was still a 12x10 flat map with `floor`, `blocking`, `doors`,
  `resource_nodes`, and `roaming_areas`.
- `world_mine_001_entry` targeted `mine_exit` from world tile `(18, 211)`.
- `world_mine_001_test_entry` targeted `mine_exit` from world tile `(5, 8)` and was one-way.
- The real world mine entry crop showed the entrance marker in a village street; the test entry
  crop showed the browser-test entrance in a badlands/lava area.

Visual references:

- `.data/map-authoring-crops/world_mine_001_entry_before.png`
- `.data/map-authoring-crops/world_mine_001_test_entry_before.png`
- `.data/map-authoring-crops/mine_floor_001_before.png`

Applied authoring changes:

- Rebuilt `mine_floor_001.json` as a 14x10 authored cavern:
  - `class: BQMap`
  - map-level identity/properties for `mine_floor_001` / `village_mine_floor_001` / `subterranean`
  - grouped `base`, `structure`, `above`, and `gameplay` layers
  - role/collision/occlusion/material/biome/area properties on groups and layers
  - a `Room` object for `village_mine_floor_001_main_chamber`
  - a linked `Door` object for `mine_exit` at local tile `(5, 8)`
  - typed `ResourceNode` and `RoamingArea` gameplay layers for `mine_ore_001` and `mine_bats`
- Added explicit cave-transition metadata to `world_mine_001_entry`,
  `world_mine_001_test_entry`, and `mine_exit`; kept the test entry one-way.
- Fixed shop trade intent handling so registered buy/sell handlers call through `ctx.world`
  and preserve the `WorldServer` receiver. The enriched mine browser loop exposed this because
  it sells harvested resources after entering the mine.

After-edit visual evidence:

- `.data/map-authoring-crops/mine_floor_001_after.png`
- `.data/map-authoring-crops/mine_floor_001_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts tests/unit/mmo/server-npc-shop.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `npx playwright test --config=playwright.config.ts tests/browser/mines-loop.playwright.ts`
- Runtime graph/resource/roaming probe for `mine_floor_001`

Runtime link after export:

- `world_01:world_mine_001_entry` exports to `mine_floor_001:mine_exit` at `(5, 8)`.
- `mine_floor_001:mine_exit` exports back to `world_01:world_mine_001_entry` at `(18, 211)`.
- `world_01:world_mine_001_test_entry` exports one-way to `mine_floor_001:mine_exit`.
- `mine_floor_001` exports `mine_ore_001` at `(6, 8)` and `mine_bats` as a 4x3 bat roaming area.

## Execution slice 42 — hidden cliff portal cake audit

Status: complete.

Ticket scope:

- Inspect the lone `cake` static entity by source properties and rendered world context.
- Decide whether it is intentional content or leftover authoring debris.
- If preserved, make the object's authored intent explicit.

Before-edit evidence:

- The only `cake` static entity was `static_entity_568_103` in
  `gameplay_markup/static_entities`.
- It was at world tile `(77, 232)` with `entity_gid=103` and `entity_kind=cake`.
- Runtime exported exactly one `cake` static entity at world index `39981`.
- The surrounding crop showed a hidden-looking village cliff pocket with paired one-way portal
  doors at `(77, 237)` and `(82, 234)`.

Visual references:

- `.data/map-authoring-crops/world_cake_static_entity_before.png`
- `.data/map-authoring-crops/world_cake_static_entity_before_nomarkers.png`

Applied authoring changes:

- Preserved the cake as intentional hidden reward/easter-egg content rather than removing it.
- Renamed the object to `hidden_cliff_portal_cake_77_232`.
- Set `class: StaticEntity` and explicit `EntityKind` property metadata for `entity_kind`.
- Added `area_id=village_cliff_portal_pocket`, tags
  `hidden_reward,portal_pocket,legacy_easter_egg`, and an `authoring_note` explaining why the
  object is not a placeholder-room artifact.

After-edit visual evidence:

- `.data/map-authoring-crops/world_cake_static_entity_after.png`
- `.data/map-authoring-crops/world_cake_static_entity_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- Runtime static-entity probe confirmed the single cake still exports at index `39981`.
- `git diff --check`

## Execution slice 43 — world resource node authoring

Status: complete.

Ticket scope:

- Replace the six opaque world `resource_node_*` markers with stable authored copper-vein
  resource nodes.
- Preserve tile positions and visual cave context.
- Add runtime-exporting `resource_kind` and stable `node_id` values.

Before-edit evidence:

- Six `ResourceNode` objects existed in `gameplay_markup/resource_nodes`, all named by raw gid.
- They only carried `resource_gid`, so `world_01.server.resourceNodes` exported `[]`.
- The cluster sits in a subterranean cave/water chamber around tiles `(121, 113)` through
  `(130, 111)`.

Visual references:

- `.data/map-authoring-crops/world_resource_nodes_before.png`
- `.data/map-authoring-crops/world_resource_nodes_before_nomarkers.png`

Applied authoring changes:

- Renamed the six objects to `subterranean_copper_vein_*` names based on their local placement.
- Added stable `node_id` values:
  - `world_subterranean_copper_125_110`
  - `world_subterranean_copper_127_110`
  - `world_subterranean_copper_129_110`
  - `world_subterranean_copper_126_111`
  - `world_subterranean_copper_130_111`
  - `world_subterranean_copper_121_113`
- Set `class: ResourceNode`, `resource_kind=ore_copper_small`,
  `area_id=subterranean_copper_water_chamber`, `tool=pickaxe`, and location tags.
- Preserved the existing `resource_gid` values and tile positions.

After-edit visual evidence:

- `.data/map-authoring-crops/world_resource_nodes_after.png`
- `.data/map-authoring-crops/world_resource_nodes_after_nomarkers.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-resource-harvesting.test.ts --timeout 20000`
- Runtime resource probe confirmed six `world_01.server.resourceNodes` entries with stable ids,
  `ore_copper_small`, and their preserved gids.

## Execution slice 44 — world chest markup authoring

Status: complete.

Ticket scope:

- Replace generated chest spawn/area names with stable authored identifiers.
- Preserve all chest positions, chest area rectangles, spawn target tiles, and item payloads.
- Add source metadata that explains area, reward type, and authored intent.

Before-edit evidence:

- 13 `ChestSpawn` objects were named `chest_spawn_1` through `chest_spawn_13`.
- 8 `ChestArea` objects were named only by spawn coordinates.
- Runtime exported the expected `staticChests` and `chestAreas`, but the source names carried
  little authoring meaning.

Visual references:

- `.data/map-authoring-crops/world_chests_subterranean_before.png`
- `.data/map-authoring-crops/world_chests_badlands_before.png`
- `.data/map-authoring-crops/world_chests_deadlands_west_before.png`
- `.data/map-authoring-crops/world_chests_beach_east_before.png`

Applied authoring changes:

- Renamed static chest spawns to stable cache names such as
  `subterranean_sword_cache_157_141`, `badlands_armory_cache_103_53`,
  `beach_house_flask_cache_130_257`, and `deadlands_platearmor_cache_46_82`.
- Renamed chest areas to stable area names such as
  `subterranean_mailarmor_chest_area_127_115`,
  `deadlands_west_platearmor_bluesword_area_6_75`, and
  `southwest_beach_supply_chest_area_17_264`.
- Set object `class` values for all chest spawn/area objects.
- Added `chest_id`, `area_id`, and `tags` source metadata while preserving `items`,
  `spawn_tx`, `spawn_ty`, positions, and rectangles.

After-edit visual evidence:

- `.data/map-authoring-crops/world_chests_subterranean_after.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts --timeout 20000`
- Runtime chest export probe confirmed `staticChests` and `chestAreas` positions/items are
  preserved.
- `git diff --check`

## Execution slice 45 — world roaming area authoring

Status: complete.

Ticket scope:

- Replace generated `roaming_area_*` names with stable authored names.
- Preserve object order, rectangles, `mob_kind`, and `count`; runtime roaming ids are derived
  from array order.
- Add source metadata for area, tags, and ambient respawn policy.

Before-edit evidence:

- 23 world `RoamingArea` objects were named by generated object id.
- Runtime exported 23 roaming areas with array-index ids, so source object order is part of the
  behavior contract.

Visual references:

- `.data/map-authoring-crops/world_roaming_village_rats_before.png`
- `.data/map-authoring-crops/world_roaming_deadlands_skeletons_before.png`
- `.data/map-authoring-crops/world_roaming_forest_goblins_before.png`
- `.data/map-authoring-crops/world_roaming_beach_crabs_before.png`

Applied authoring changes:

- Renamed roaming areas to stable biome/mob/position names such as
  `village_west_rat_roam_10_206`, `deadlands_central_skeleton_roam_30_135`,
  `forest_central_goblin_roam_59_159`, and `beach_east_crab_roam_61_290`.
- Set explicit `class: RoamingArea`.
- Added `area_id`, `tags`, and `respawn_policy=ambient` metadata.
- Preserved all rectangles, object order, `mob_kind`, and `count`.

After-edit visual evidence:

- `.data/map-authoring-crops/world_roaming_forest_goblins_after.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts --timeout 20000`
- Runtime roaming export probe confirmed all 23 server roaming areas retained the same ids,
  rectangles, mob kinds, and counts.
- `git diff --check`

## Execution slice 46 — world music zone and checkpoint authoring

Status: complete.

Ticket scope:

- Replace generated music-zone/checkpoint names with stable authored identifiers.
- Preserve music rectangles and `track_id` values.
- Preserve checkpoint object order, rectangles, `checkpoint_id`, and `spawn` flags because
  runtime checkpoint ids are array-order based.

Before-edit evidence:

- 15 world `MusicZone` objects were named by track plus generated object id.
- 24 world `Checkpoint` objects were named by generated object id.
- Runtime exported 15 client music areas and 24 server checkpoints.

Visual references:

- `.data/map-authoring-crops/world_music_checkpoint_village_before.png`
- `.data/map-authoring-crops/world_music_checkpoint_desert_deadlands_before.png`
- `.data/map-authoring-crops/world_music_checkpoint_cave_east_before.png`
- `.data/map-authoring-crops/world_music_checkpoint_beach_before.png`

Applied authoring changes:

- Renamed music zones to stable area names such as
  `forest_west_music_zone_4_145`, `village_main_music_zone_1_195`,
  `subterranean_copper_chamber_music_zone_110_104`, and
  `east_lavaland_south_island_music_zone_146_176`.
- Renamed checkpoints to stable area names such as
  `village_west_spawn_checkpoint_14_210`, `forest_gate_checkpoint_41_184`,
  `deadlands_mid_checkpoint_55_92`, and `beach_east_checkpoint_65_250`.
- Set explicit `class` values for music zones and checkpoints.
- Added `area_id` and `tags` metadata, and gave music `track_id` properties the
  `MusicTrackId` property type.
- Preserved all rectangles, track ids, checkpoint object order, `checkpoint_id` values, and
  `spawn` flags.

After-edit visual evidence:

- `.data/map-authoring-crops/world_music_checkpoint_cave_east_after.png`

Validation evidence:

- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-resource-harvesting.test.ts tests/unit/mmo/server-npc-shop.test.ts --timeout 20000`
- Runtime music/checkpoint export probe confirmed 15 music areas and 24 checkpoints are
  preserved.

## Execution slice 47 — world static NPC and item authoring

Status: complete.

Ticket scope:

- Enrich the non-mob static entities in `gameplay_markup/static_entities`.
- Preserve object ids, positions, tile gids, `entity_gid`, and `entity_kind`.
- Keep the larger fixed-mob static placement pass out of scope for this slice.

Before-edit evidence:

- `static_entities` contained 233 objects.
- 46 targeted static NPC/item/reward/cameo objects had generated names or needed consistent
  enum typing: guards, NPCs/cameos, potions/flasks, sword rewards, one bluesword, and the
  already-audited hidden cake.
- Runtime exported 233 `world_01.server.staticEntities` entries.

Visual references:

- `.data/map-authoring-crops/world_static_entities_boss_context_before.png`
- `.data/map-authoring-crops/world_static_entities_deadlands_cache_context_before.png`
- `.data/map-authoring-crops/world_static_entities_village_context_before.png`
- `.data/map-authoring-crops/world_static_entities_beach_guards_context_before.png`
- `.data/map-authoring-crops/world_static_entities_southeast_lab_context_before.png`
- `.data/map-authoring-crops/world_static_entities_king_coder_context_before.png`
- `.data/map-authoring-crops/world_static_entities_cameo_nyan_context_before.png`
- `.data/map-authoring-crops/world_static_entities_lava_pocket_flasks_context_before.png`
- `.data/map-authoring-crops/world_static_entities_rick_context_before.png`
- `.data/map-authoring-crops/world_static_entities_east_beach_reward_context_before.png`

Applied authoring changes:

- Renamed targeted static rewards and pickups to stable names such as
  `boss_arena_west_firepotion_149_51`, `deadlands_west_bluesword_cache_31_75`,
  `lava_pocket_flask_cache_west_north_153_88`, and
  `southeast_lab_scientist_firepotion_129_293`.
- Renamed targeted NPC/cameo objects to stable names such as
  `village_west_bridge_guard_4_195`, `village_mine_entrance_priest_18_210`,
  `subterranean_king_room_king_126_138`, `forest_maze_nyan_cameo_75_164`, and
  `torch_room_rick_cameo_127_186`.
- Added `EntityKind` property typing to each targeted `entity_kind`.
- Added `area_id` and `tags` metadata.
- Updated `assets/maps/tiled/templates/static_entity_rect.tx` so future static placements use
  the `EntityKind` enum type.
- Preserved all positions, tile gids, `entity_gid`, and `entity_kind` values.

After-edit visual evidence:

- `.data/map-authoring-crops/world_static_entities_boss_context_after.png`
- `.data/map-authoring-crops/world_static_entities_village_context_after.png`
- `.data/map-authoring-crops/world_static_entities_southeast_lab_context_after.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/server-world-map-pack-bootstrap.test.ts tests/unit/server-chest-item-lifecycle.test.ts --timeout 20000`
- Runtime parity probe against `HEAD` confirmed `world_01.server.staticEntities` still has
  233 entries and no changed keys.

## Execution slice 48 — world fixed static mob authoring

Status: complete.

Ticket scope:

- Enrich the remaining generated fixed-mob static entities in
  `gameplay_markup/static_entities`.
- Preserve object ids, positions, tile gids, `entity_gid`, and `entity_kind`.
- Keep door/portal linkage polish out of scope for this slice.

Before-edit evidence:

- 187 generated `static_entity_*` names remained after the NPC/item pass, all fixed mob
  placements.
- Remaining generated mob kinds were 28 bats, 28 goblins, 25 skeletons, 23 ogres,
  19 spectres, 18 eyes, 18 snakes, 14 skeleton2s, 8 rats, 4 deathknights, 1 boss, and
  1 crab.
- Runtime exported 233 `world_01.server.staticEntities` entries.

Visual references:

- `.data/map-authoring-crops/world_static_mobs_north_badlands_before.png`
- `.data/map-authoring-crops/world_static_mobs_boss_northeast_before.png`
- `.data/map-authoring-crops/world_static_mobs_deadlands_before.png`
- `.data/map-authoring-crops/world_static_mobs_forest_maze_before.png`
- `.data/map-authoring-crops/world_static_mobs_east_islands_before.png`
- `.data/map-authoring-crops/world_static_mobs_southwest_beach_before.png`
- `.data/map-authoring-crops/world_static_mobs_east_beach_skeletons_before.png`
- `.data/map-authoring-crops/world_static_mobs_southeast_lab_rats_before.png`

Applied authoring changes:

- Renamed every remaining generated fixed mob to an area/mob/coordinate name such as
  `north_badlands_lavaland_spectre_37_9`, `deadlands_west_desert_ogre_14_62`,
  `forest_south_maze_bat_60_172`, and `south_cavern_rat_room_rat_154_308`.
- Added `EntityKind` property typing, `area_id`, `tags`, and `spawn_role=fixed_mob`.
- Preserved all positions, tile gids, `entity_gid`, and `entity_kind` values.
- Confirmed no generated `static_entity_*` names remain in `gameplay_markup/static_entities`.
- Confirmed all 233 static entities now have `entity_kind` typed as `EntityKind`.

After-edit visual evidence:

- `.data/map-authoring-crops/world_static_mobs_north_badlands_after.png`
- `.data/map-authoring-crops/world_static_mobs_deadlands_after.png`
- `.data/map-authoring-crops/world_static_mobs_forest_maze_after.png`
- `.data/map-authoring-crops/world_static_mobs_southeast_lab_rats_after.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/server-world-map-pack-bootstrap.test.ts tests/unit/server-chest-item-lifecycle.test.ts --timeout 20000`
- Runtime parity probe against `HEAD` confirmed `world_01.server.staticEntities` still has
  233 entries and no changed keys.

## Execution slice 49 — world door and portal authoring polish

Status: complete.

Ticket scope:

- Inspect remaining generated world door names and portal semantics.
- Preserve all door coordinates and graph link targets.
- Avoid adding arbitrary door metadata that would leak into runtime door payloads.
- Add only runtime-meaningful semantics where source intent is clear.

Before-edit evidence:

- World `gameplay_markup/doors` contained 86 objects.
- 37 same-map coordinate doors still had generated `door_*` names.
- Seven named `world_portal_*` graph-linked one-way same-map portals lacked explicit
  `door_kind=portal` / `is_portal=true` semantics, so they exported as `p: 0`.
- `world_house_01_entry` and `world_house_02_entry` still lacked the explicit transition and
  default properties added to later house entries.
- Door properties are exported wholesale as runtime `t*` fields, so source-only metadata such
  as `area_id`/`tags` does not belong on door objects until the compiler has an authoring
  metadata boundary.

Visual references:

- `.data/map-authoring-crops/world_portals_village_cliff_before.png`
- `.data/map-authoring-crops/world_portals_northeast_chain_before.png`
- `.data/map-authoring-crops/world_doors_forest_maze_cluster_before.png`
- `.data/map-authoring-crops/world_doors_southeast_lab_cluster_before.png`

Applied authoring changes:

- Renamed all 37 generated same-map coordinate doors to concise names such as
  `forest_maze_tp_127_190_to_74_145` and `southeast_lab_tp_127_299_to_38_245`.
- Added `door_kind=portal` and `transition_kind=portal` to all seven named
  `world_portal_*` objects.
- Added missing transition/default properties to `world_house_01_entry` and
  `world_house_02_entry`.
- Added `DoorOrientation` property typing to all 86 door `orientation` properties and
  `TransitionKind` typing to transition properties.
- Preserved every door coordinate, target map, target door, door id, and orientation.

After-edit visual evidence:

- `.data/map-authoring-crops/world_portals_village_cliff_after.png`
- `.data/map-authoring-crops/world_portals_northeast_chain_after.png`
- `.data/map-authoring-crops/world_doors_forest_maze_cluster_after.png`

Validation evidence:

- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- Runtime comparison against `HEAD` confirmed 86 world doors before/after with no coordinate,
  target-map, target-door, door-id, or orientation changes.
- Runtime comparison showed only nine intended semantic changes: seven portal
  `p/door_kind/transition` updates plus explicit default transition/enabled/locked/one-way
  properties for `world_house_01_entry` and `world_house_02_entry`.

Door-model note resolved by slice 50:

- The target validator currently requires `target_tx`/`target_ty` on every door object,
  including graph-linked doors whose runtime destination is resolved from
  `target_map`/`target_door`. That keeps redundant legacy coordinates in the source. The
  next cleanup should split the validator/compiler contract so graph-linked doors no longer
  require those coordinate fields, while plain coordinate teleports still do.

## Execution slice 50 — graph-linked door coordinate contract

Status: complete.

Ticket scope:

- Remove redundant `target_tx`/`target_ty` requirements from graph-linked doors.
- Keep `target_tx`/`target_ty` required for plain same-map coordinate teleports.
- Make the compiler and validator reject redundant graph-link target coordinates.
- Preserve compiled door destinations resolved from `target_map`/`target_door`.

Before-edit evidence:

- World graph-linked doors, house exit doors, and `mine_exit` still carried
  `target_tx`/`target_ty`, even though map-pack normalizes graph-linked runtime destinations
  from the destination door coordinate.
- The target validator required `target_tx`/`target_ty` for every door object, which forced
  graph-linked source data to keep legacy coordinate fields.

Applied contract changes:

- Updated `world-map-validator.ts` so `target_tx`/`target_ty` are required only for doors
  without `target_map`/`target_door`.
- Added `DOOR_GRAPH_COORDINATE_REDUNDANT` diagnostics for graph-linked doors that still
  define `target_tx` or `target_ty`.
- Updated `map-pack.ts` to reject graph-linked doors with redundant `target_tx`/`target_ty`.
- Updated tests to prove:
  - graph-linked doors pass validation without raw target coordinates
  - plain coordinate teleports still require target coordinates
  - graph-linked doors reject redundant target coordinates in both validator and compiler
- Removed `target_tx`/`target_ty` from all graph-linked doors in Tiled sources.
- Removed `target_tx`/`target_ty` from `door_linked.tx` and `portal.tx`.
- Updated template documentation to distinguish graph-linked doors from plain coordinate
  teleports.

Validation evidence:

- Source summary confirmed 90 graph-linked doors across all Tiled maps with zero redundant
  `target_tx`/`target_ty`.
- Source summary confirmed 37 plain coordinate teleports still have required `target_tx` and
  `target_ty`.
- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/world-map-validator.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`

## Execution slice 52 — world layer semantic metadata

Status: complete.

Ticket scope:

- Add the semantic layer metadata model already used by authored interiors to `world.json`.
- Keep the target compiler/validator strict: world layers must declare role, collision source,
  occlusion mode, material, biome, and area ownership.
- Preserve map geometry, object placement, door links, and runtime map-pack structure.

Before-edit evidence:

- `world.json` had 74 groups/leaves and zero `layer_role` properties.
- Authored interiors already used `layer_role`, `collision_source`, `occlusion`, `material`,
  `biome`, and `area_id` on their groups and layers.
- The target validator still enforced exact world layer paths and object-layer contracts, but
  it did not require the layers to say what they mean.

Applied authoring changes:

- Added semantic properties to all 74 world groups/leaves.
- Classified visible world render layers into `base`, `transition`, `hazard`, `decal`,
  `structure`, `object_depth`, and `foreground` roles.
- Classified `gameplay_markup` and its object layers as `gameplay`.
- Added target validator diagnostics for missing semantic layer properties.
- Added target validator diagnostics for invalid `layer_role`, `collision_source`, and
  `occlusion` enum values.
- Added unit coverage for missing and invalid world layer semantics.

Visual evidence:

- `.data/map-authoring-crops/world_layer_semantics_beach_after.png`
- `.data/map-authoring-crops/world_layer_semantics_forest_maze_after.png`
- `.data/map-authoring-crops/world_layer_semantics_badlands_after.png`

Validation evidence:

- Source audit confirmed 74 world groups/leaves, 0 missing semantic properties, and role
  counts: 19 base, 5 transition, 7 hazard, 14 object_depth, 6 decal, 8 structure, 6
  foreground, 9 gameplay.
- Runtime comparison against `HEAD` confirmed the only map-pack changes are 61 render props
  gaining inherited `meta.biome`; no other render-prop fields changed.
- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/world-map-validator.test.ts --timeout 20000`
- `bun run typecheck:tools`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Execution slice 56 — Wang color terrain semantics

Status: complete.

Ticket scope:

- Make Wang colors carry terrain-family truth, not only visual names/colors.
- Tie Wang color metadata to `terrain-authoring.json` family kind/passability.
- Keep transition art gaps visible; this slice does not generate missing transition tiles.

Before-edit evidence:

- `tilesheet.wang.tsj` had 27 Wang colors across terrain, carpet, and scaffold transition
  Wang sets.
- All 27 Wang colors had names and probabilities, but none had custom properties carrying
  material, family, terrain kind, or passability.
- The terrain authoring audit reported transition-art completeness gaps but could not verify
  whether Wang brush colors matched the approved terrain grammar.

Applied tileset changes:

- Added `material`, `terrain_family`, `terrain_kind`, and `passability` to all 27 Wang colors.
- Mapped `rock` colors to grammar family `stone`, `lake` to `water`, and carpet colors to
  `indoor` while preserving their editor-facing material names.
- Extended `terrain-authoring-audit.ts` to validate Wang color metadata against
  `terrain-authoring.json`.
- Added audit coverage for missing, valid, and grammar-mismatched Wang color metadata.
- Updated `docs/terrain-authoring-model.md` with the Wang color metadata contract.

Validation evidence:

- Source audit confirmed 27 Wang colors, 0 missing metadata properties, and 0 grammar
  mismatches.
- Generated terrain audit reported 0 `WANG_COLOR_METADATA_MISSING`, 0
  `WANG_COLOR_FAMILY_UNKNOWN`, and 0 `WANG_COLOR_METADATA_MISMATCH`.
- Remaining Wang findings are transition-art completeness gaps: 8
  `WANG_PAIR_HAS_NO_MIXED_TRANSITIONS` and 1 `WANG_PAIR_HAS_TOO_FEW_MIXED_TRANSITIONS`.
- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun run check:terrain-authoring`
- `bun test tests/unit/terrain-authoring-audit.test.ts --timeout 20000`
- `bun test tests/unit/world-map-validator.test.ts tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun run typecheck`
- `bun run typecheck:tools`
- `bun run lint`
- `git diff --check`

## Execution slice 55 — semantic layer phase order

Status: complete.

Ticket scope:

- Validate broad semantic phase order across flattened target world leaf layers.
- Keep local render-body ordering flexible while the legacy world is still grouped by biome.
- Preserve authored map/runtime data.

Before-edit evidence:

- Slice 54 validated each layer's semantic role structure, but did not prove that render,
  overlay, and gameplay layers stayed in coherent flattened order.
- Current world flattening showed a clear broad phase sequence: render body, foreground
  overlays, then gameplay markup.

Applied contract changes:

- Added shared `SEMANTIC_LAYER_PHASE_ORDER` and `getSemanticLayerPhaseOrder` to
  `shared/maps/layer-contract.ts`.
- Updated the target world validator to emit `LAYER_SEMANTIC_PHASE_ORDER_INVALID` when a
  lower phase appears after a later phase.
- Added validator coverage for a foreground-layer role mutation that forces a phase
  regression.
- Documented render body, overlay, and markup phases in `docs/map-layer-contract.md`.

Validation evidence:

- Source phase audit confirmed 65 flattened world leaves with phase transitions at index 0
  (`render_world/beach_biome/sand`, phase 0), index 52
  (`render_world/foreground_overlays/cliffs_foreground`, phase 1), and index 57
  (`gameplay_markup/resource_nodes`, phase 2), with 0 phase violations.
- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/world-map-validator.test.ts tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun test tests/unit/world-map-validator.test.ts --timeout 20000`
- `bun run typecheck:tools`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Execution slice 54 — structural layer role validation

Status: complete.

Ticket scope:

- Add structural rules for semantic layer roles so accepted paths are not enough.
- Validate layer type, visibility, collision source, occlusion mode, and required class for
  each target world leaf layer.
- Preserve the existing path guard and all authored map/runtime data.

Before-edit evidence:

- Slice 53 shared semantic value domains, but a layer could still keep a known path while
  declaring an incompatible role/type combination.
- The current world role inventory showed stable structural patterns: render paint as visible
  tile layers, depth props as visible `DepthSorted` object layers, foregrounds as visible
  `Foreground` layers, and gameplay as hidden object layers.

Applied contract changes:

- Added shared `SEMANTIC_LAYER_STRUCTURE_RULES` to `shared/maps/layer-contract.ts`.
- Updated the target world validator to emit `LAYER_SEMANTIC_STRUCTURE_INVALID` for:
  - role/layer-type mismatches
  - invalid visibility for a role
  - collision source not allowed by role
  - occlusion mode not allowed by role
  - missing required layer class for `object_depth` and `foreground`
- Added validator coverage for a depth-prop object layer mislabeled as `base`.
- Added validator coverage for a hidden render layer.
- Documented the structural role table in `docs/map-layer-contract.md`.

Validation evidence:

- Source audit confirmed 65 flattened world leaf layers, role counts of 12 base, 5
  transition, 7 hazard, 14 object_depth, 6 decal, 8 structure, 5 foreground, and 8 gameplay,
  with 0 structural rule violations.
- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/world-map-validator.test.ts tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun test tests/unit/world-map-validator.test.ts --timeout 20000`
- `bun run typecheck:tools`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Execution slice 53 — shared semantic layer contract

Status: complete.

Ticket scope:

- Move semantic layer domains out of the world validator and into the shared layer contract.
- Enforce Tiled custom enum typing for semantic layer enum properties, not only string
  values.
- Keep the current path guard in place as a migration safety net while semantics become the
  primary authored truth.

Before-edit evidence:

- Slice 52 made `world.json` carry semantic layer properties, but
  `shared/maps/layer-contract.ts` still only represented path allowlists.
- The target validator checked semantic string values locally and did not prove that the
  source properties were typed as Tiled custom enums.
- `docs/map-layer-contract.md` still described recursive paths as the authored contract.

Applied contract changes:

- Added shared `LayerRole`, `CollisionSource`, and `OcclusionMode` domains to
  `shared/maps/layer-contract.ts`.
- Added shared required semantic property names and enum propertytype mappings.
- Updated `world-map-validator.ts` to use the shared contract definitions.
- Added `LAYER_SEMANTIC_PROPERTY_UNTYPED` for semantic enum properties missing the expected
  Tiled `propertytype`.
- Updated `docs/map-layer-contract.md` to describe semantic properties as the primary
  contract and path checks as migration guards.

Validation evidence:

- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/world-map-validator.test.ts tests/unit/map-pack.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
- `bun test tests/unit/world-map-validator.test.ts --timeout 20000`
- `bun run typecheck:tools`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- Runtime comparison against `HEAD` confirmed no door coordinate, target-map, target-door,
  door-id, or orientation changes.

## Execution slice 51 — door authoring metadata boundary

Status: complete.

Ticket scope:

- Allow doors to carry source-only authoring metadata without leaking it into runtime door
  payloads.
- Add scoped `area_id` and `tags` metadata to world/interior door objects.
- Preserve all compiled door coordinates, targets, portal semantics, and graph links.

Before-edit evidence:

- `processMap` exported every door property as a runtime `t*` field, so adding rich source
  metadata directly to doors would have polluted client/server door payloads.
- Doors needed source-side context for area ownership and later authoring workflows, but
  those fields are not runtime transition semantics.

Applied contract changes:

- Added a door metadata boundary in `processmap.ts` for authoring-only fields:
  `area_id`, `tags`, and `authoring_note`.
- Added map-pack regression coverage proving those fields are stripped from both client and
  server door payloads.
- Added `area_id` and `tags` to all authored world, house, and mine door objects.
- Rebuilt `assets/maps/runtime/map-pack.json`.

Validation evidence:

- Source audit confirmed 127 authored doors, 127 with `area_id`, 127 with `tags`, 90
  graph-linked doors, zero redundant graph target coordinates, and 37 plain coordinate
  teleports.
- Runtime audit confirmed 254 client/server door records and zero
  `tarea_id`/`ttags`/`tauthoring_note` leaks.
- Runtime structural comparison against `HEAD` confirmed no door coordinate, target-map,
  target-door, door-id, or orientation changes.
- `bun run build:maps`
- `bun run check:maps`
- `bun run check:world-map:target`
- `bun test tests/unit/map-pack.test.ts tests/unit/world-map-validator.test.ts tests/unit/mmo/server-map-doors.test.ts --timeout 20000`
