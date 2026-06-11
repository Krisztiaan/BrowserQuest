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
