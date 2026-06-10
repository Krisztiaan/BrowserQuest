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
| Size | 172×314, 16px tiles | 12×10 each |
| Map `class` | none | none |
| Map properties | `map_id`, `authoring_version`, `default_music`, `default_biome` | **none at all** |
| Layer tree | deep groups: `render_world/{biome}/…`, `gameplay_markup/*` | flat `floor`, `blocking`, `doors` (+ mine: `resource_nodes`, `roaming_areas`) |
| Layer data | raw JSON arrays, no encoding/compression | same |

The interiors are generated placeholders, not authored spaces: no identity, no room semantics,
one floor tile flood plus a blocking ring.

### Layers

- Group nesting with inherited offset/opacity/visibility/properties — **used and consumed**
  (the flattener honors all of it; sub-tile offsets are a compile error).
- Layer `class` — only two values exist: `Foreground` (always-in-front tiles) and
  `DepthSorted` (object layers turned into depth-sorted render props).
- Custom layer properties — **zero** in any authored map. All other layer semantics ride on
  *names*: `blocking`, `doors`, `music_zones`, `checkpoints`, `roaming_areas`,
  `resource_nodes`, `chest_areas`, `chest_spawns`, `static_entities`, plus hardcoded
  water/damage name lists (`sea`, `lava`, …) for the debug overlay.
- `shared/maps/layer-contract.ts` pins **64 exact layer paths** mirroring world.json's current
  tree — a snapshot, not a contract. Renaming a layer breaks compilation by design, but the
  contract encodes *this one file's shape* rather than *what layers mean*.

### Objects

- Classes in actual maps: `Door`, `ResourceNode`, `RoamingArea` (interiors), plus the
  gameplay_markup classes in world.json (`Checkpoint`, `MusicZone`, `ChestArea`, `ChestSpawn`,
  `StaticEntity`, `PropMetadata`).
- Shapes: **100% rectangles.** No points, ellipses, polygons, polylines, text, no rotation
  (rotation is a compile error).
- Templates: **12 `.tx` files exist; zero objects reference them.** Everything was placed or
  script-generated inline, so identical objects have hand-copied (drift-prone) property sets.
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
