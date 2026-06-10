> External audit evidence: preserve original findings, but drive current work from `PLAN.md` tickets and verified local code state.

I inspected the uploaded project statically. I did not run the Bun verification scripts because Bun is not installed in this execution environment, so treat this as a code/content architecture review rather than a passing-build report.

Bottom line

This project should not start with a full rewrite. The biggest blocker is the content/map pipeline, not the renderer or protocol. The codebase already has useful modernization work: TypeScript, ESM, Bun server runtime, binary protocol, map-pack tooling, Tiled authoring, Playwright tests, and a server-side ECS direction.

The major pivot I would make is this:

Stop aiming at the current mmo-plan.md target of ~2000 players per shard and 30 Hz MMO authority. Reframe the project as a casual co-op RPG server for friends: stable persistence, shared world, interiors, farming, mines, chat, chests, NPCs, and 16–64 players as the practical design range.

That means keeping server authority where it protects shared persistence and consistency, but dropping a lot of MMO-scale complexity unless it directly helps the friend-server experience.

⸻

Critical findings from the project

1. The map source is inconsistent with the runtime map-pack model

Current server config points to:

"map_filepath": "./assets/maps/tiled/world.json"

But assets/maps/tiled/map-pack.config.json defines the map id as:

"id": "world_01"

The runtime single-map loader also normalizes world.json to world_01. Meanwhile, authored linked doors still use targets like:

target_map = world
target_map = house_02
target_map = house_11
...

Only world.json is present. There are no actual house_* maps in the map-pack. allow_missing_target_maps is currently true, so missing graph edges are filtered away instead of failing hard.

This is probably the most important cleanup item. It can cause door/portal behavior where the client thinks a door leads to another map, while the server falls back to same-map coordinate teleporting.

2. Door and portal semantics are split and fragile

The map has 84 doors:

47 templates/door_linked.tx
37 templates/door.tx

Of those, 37 have no target_map. The linked ones refer to world and many house_* maps, but the actual map-pack only has world_01.

There is also a code-level inconsistency: shared/maps/processmap.ts marks a door as portal only when:

door.class === "Portal"

But the actual doors inspected are class/type Door, and the portal template exists separately. This should be normalized into an explicit property such as:

door_kind = door | portal | cave | mine | house

or:

is_portal = true

Do not rely on Tiled’s class/type naming quirks for runtime behavior.

3. The uploaded package includes generated, backup, and local-data junk

Even though .gitignore is mostly correct, the uploaded project contains files that should not be in a handoff/archive:

.DS_Store
generated/maps/world_client.json
generated/maps/world_server.json
assets/maps/tiled/world.original.json      36M
assets/maps/tiled/world.backup...json      45M
server/.data/*.sqlite
server/.data/*.sqlite-wal
server/.data/*.sqlite-shm

The canonical map should be small enough to review, diff, and validate. Right now the archive carries stale/generated/local state that makes the project look messier than it needs to be.

4. The Tiled map is workable, but not idiomatic enough for long-term authoring

The current world is:

172 x 314 tiles
16 x 16 tile size
65 flattened layers
5000 objects

The good news: tile-object placement is mostly disciplined.

4930 tile objects
0 off-grid
0 rotated
0 resized

The bad news: 4592 render objects are blank/untyped/no-template objects. That is not sustainable authoring. For a Stardew-like game, props, trees, walls, doors, trinkets, signs, fences, rocks, houses, and resource objects need stable semantic identity.

Tiled supports custom properties/classes and object templates, which is exactly what this project should lean into for authored gameplay data and reusable prop semantics.  ￼

5. Layering is too organic and needs a contract

Examples from the current map:

ground
ground_variations
mud
grass
stone
village_boundaries
village_boundaries_level_2
dry_ground
dry_ground_2
cliffs
cliffs_2
foreground_overlays

This is normal during map evolution, but it should now be cleaned into a strict layer taxonomy. Current layer names like dry_ground_2, cliffs_2, opacity 0.99, and scattered foreground overlays are signs that rendering order and authoring conventions are not fully codified.

The engine already has support for render layers, foreground layers, object groups, and map-pack compilation. The missing piece is a strict map contract.

6. Passability/collision metadata is not clean enough yet

The tileset has:

1960 tiles
835 tiles with metadata
472 tile objectgroups
258 footprint properties
67 collider properties
6 passable properties
37 animations

Collision appears to depend heavily on tileset objectgroups and scattered metadata. For a farming/RPG map, passability should be explicit, testable, and visible in authoring.

You want a small movement taxonomy:

walk
blocked
water
ledge
bridge
door
damage
farmable
decorative_only

Then derive runtime collision, pathing, interactability, and overlays from that.

7. The tech docs and actual runtime disagree

README.md and server docs mention Node, but the actual server runtime uses Bun APIs directly:

globalThis["Bun"]
Bun.file(...)
Bun.serve(...)

Bun’s official docs support Bun.serve() WebSockets and server-side WebSocket handling, so using Bun is a legitimate choice.  ￼ But the project should be honest: either it is Bun-first/Bun-only, or the server needs a real Node runtime path.

Also, the project pins:

"node": ">=22 <23"

As of the current Node release schedule, Node 22 is maintenance LTS and Node 24 is active LTS.  ￼ If Node is only used for tooling, this is not urgent. If Node is presented as a supported production runtime, update the policy.

⸻

Recommended pivot

Keep

Keep these parts:

TypeScript
Tiled
Bun server runtime, if you accept Bun-only deployment
WebSockets
shared protocol/types
map-pack compiler direction
SQLite for casual/friend-server persistence
Playwright smoke tests
ESLint/Prettier/TypeScript checks
server-side validation for shared world state

Change

Change these parts:

MMO target -> casual co-op friend server
2000-player shard planning -> 16–64 practical multiplayer target
single giant world with fake interiors -> real map-pack with overworld + interiors
weak door fallbacks -> strict graph validation
blank render objects -> typed templates/prefabs
organic layer names -> enforced layer contract
custom Bun client build only -> consider Vite for client dev/build
Node+Bun ambiguity -> declare one runtime story
legacy generated maps -> remove or clearly mark as obsolete

Vite is worth considering for the browser client because its official model gives you a dev server with native-ESM-based HMR and a production build pipeline for optimized static assets.  ￼ I would not migrate the whole game to Phaser/Pixi yet. First put a clean renderer boundary around the current Canvas renderer; then replace it only if rendering becomes the bottleneck.

⸻

Target architecture

Runtime model

Use one authoritative friend-server process:

Browser client
  -> WebSocket
Bun server
  -> session/world loop
  -> map registry
  -> persistence
  -> content definitions
SQLite
  -> profiles
  -> inventories
  -> chests
  -> crops
  -> world overlays
  -> placed objects

This is enough for casual multiplayer. You do not need heavyweight anti-cheat. You do need authoritative saves, collision, inventory transactions, chest transactions, crop growth, and map transitions.

Content model

Move toward:

assets/
  maps/
    tiled/
      project.tiled-project
      browserquest.world
      maps/
        world_01.tmj/json
        farm_01.tmj/json
        house_01.tmj/json
        mine_01.tmj/json
      tilesets/
        terrain.tsj
        buildings.tsj
        props.tsj
        mobs.tsj
        markers.tsj
      templates/
        door.tx
        portal.tx
        chest.tx
        npc_spawn.tx
        resource_node.tx
        crop_plot.tx
        shop.tx
        sign.tx
  content/
    items.json
    crops.json
    npcs.json
    recipes.json
    mobs.json
    loot_tables.json

Tiled world files are designed for projects split across multiple maps, making them easier to edit and easier to manage than a single monolithic map.  ￼ That fits this project very well: overworld, interiors, mines, farm, shops, caves, and event areas should be separate maps.

⸻

Map cleanup plan

Phase 1 — Establish a strict source of truth

Do this first.

1. Choose the canonical overworld id: either world or world_01. I recommend world_01 because the runtime already normalizes world.json to that.
2. Update all door target_map values from world to world_01.
3. Decide that assets/maps/tiled/map-pack.config.json is the source of truth.
4. Change server config to point at the map-pack config, not directly at world.json:

"map_filepath": "./assets/maps/tiled/map-pack.config.json"

5. Set:

"allow_missing_target_maps": false

6. Remove or exclude from handoff archives:

generated/
server/.data/
.DS_Store
world.original.json
world.backup.*.json

Phase 2 — Fix doors, portals, and interiors

Create actual interior maps for the existing house_* targets, or remove those targets until the maps exist.

Every linked door should have:

door_id
target_map
target_door
orientation

Every destination door should also have a matching reverse link unless explicitly marked:

one_way = true

Add a validator that fails on:

target_map does not exist
target_door does not exist
door_id missing on graph-linked door
target_map = world when canonical id is world_01
portal template but no portal semantic property
orientation missing
raw tx/ty used on a linked door

Legacy tx/ty doors can remain only during migration. They should not be the long-term map-transition format.

Phase 3 — Define the layer contract

Use a strict layer contract like this:

render/
  terrain/base
  terrain/variation
  terrain/transition
  water/base
  water/edge
  roads
  floors
  walls/back
  walls/front
  structures
  props/depth_sorted
  foreground/canopy
  foreground/roof
  foreground/overhang
collision/
  blocking
  water
  ledge
  bridge
  trigger_only
gameplay/
  doors
  portals
  spawn_points
  npc_spawns
  resource_nodes
  chest_spawns
  chest_areas
  shops
  crop_plots
  fishing_zones
  music_zones
  checkpoints
  roaming_areas

Then create a script that fails if a map has unknown layers unless explicitly allowed.

Current names like these should be migrated:

dry_ground_2
cliffs_2
village_boundaries_level_2
foreground_overlays

They are fine as temporary art layers, but not as a stable authoring API.

Phase 4 — Clean terrain and ground types

Create explicit terrain classes:

grass
tilled_soil
dirt
mud
sand
stone
wood_floor
indoor_floor
water
lava
cliff
cave
bridge
road
farmable

Each terrain tile should answer:

movement: walk | blocked | water | damage
ground_type: grass | dirt | sand | stone | indoor | cave | bridge
farmable: true | false
footstep_sound
season_variant
biome

Do not encode important gameplay behavior only through visual tile choice.

Phase 5 — Convert blank render objects into real prefabs/templates

You currently have 4592 blank render objects. Convert them into templates or semantic object types.

Examples:

tree_oak_small
tree_oak_large
pine_tree
rock_small
rock_large
fence_wood
signpost
house_wall
house_roof
flower_patch
barrel
crate
totem
cactus
grave
campfire
bridge_piece

Each prop should have:

prop_id or prefab_id
prop_family
prop_kind
biome
depth_mode
collision_mode
interaction_mode
loot_table, optional
season_variant, optional

Use tile objects for visual placement where appropriate, but do not leave them semantically blank. Tiled objects are appropriate for gameplay data and graphical placement when typed and property-driven.  ￼

Phase 6 — Make passability author-visible

Create a debug overlay in the browser:

green = walkable
red = blocked
blue = water
orange = damage
purple = portal/door trigger
yellow = interactable

Then add a map check that verifies:

client collision = server collision
doors are reachable
spawn points are reachable
chests are not inside blocked tiles
resource nodes are reachable
NPC roaming areas contain walkable tiles
foreground overlays do not block unexpectedly
bridges override water correctly

This is the fastest way to stop map bugs from becoming gameplay bugs.

Phase 7 — Split the world

Move from one giant map to a real map-pack:

world_01
farm_01
house_player_01
house_02
shop_general
blacksmith
mine_entrance
mine_floor_001
cave_01
event_area_01

Tiled .world support is specifically intended for large worlds split across multiple maps, with maps visible together for editing and better manageability.  ￼ Use that instead of forcing everything into one file.

⸻

Gameplay plan for a Stardew-like friend RPG

MVP gameplay loop

Build toward this first:

join server
create/load character
spawn in town/farm
walk around with friends
chat
enter/exit houses and caves
collect resources
farm crops
use tools
store items in chests
buy/sell at shops
fight simple mobs in caves/mines
save world state

Core systems

Prioritize these systems in this order:

1. Identity/profile
    * player name
    * appearance
    * position
    * inventory
    * home/farm ownership
2. Movement/interactions
    * click/tile movement
    * interact key
    * doors/portals
    * chest open/close
    * resource harvesting
    * NPC talk/shop
3. Inventory/items
    * stackable items
    * tools
    * equipment
    * currency
    * item pickup/drop
    * chest transfers
4. Farming
    * hoe/till
    * plant seed
    * water crop
    * crop growth by day/season
    * harvest
    * regrow crops
    * crop death/out-of-season rules later
5. World time
    * day clock
    * sleep/skip day rule
    * weather
    * seasons
    * scheduled crop/resource updates
6. Resources
    * trees
    * stones
    * ore
    * forage
    * fishing zones later
7. NPCs
    * static dialogue first
    * shops second
    * schedules later
    * relationships much later
8. Combat/mines
    * simple enemy AI
    * shared loot
    * mine floors
    * respawn rules
    * boss/event rooms later
9. Social
    * chat
    * emotes
    * parties
    * shared farm permissions
    * optional guild/group later

Do not prioritize yet

For this game goal, deprioritize:

2000-player shards
complex anti-cheat
distributed shards
cross-shard migration
complex guild governance
server-side everything at MMO rigor
deep ECS purity before gameplay works
large protocol rewrites
renderer rewrite before map cleanup

⸻

Tech modernization plan

Runtime decision

Pick one:

Option A — Bun-first

This is the pragmatic choice given the current code.

Do this:

Declare Bun as the production runtime.
Remove misleading Node production-runtime claims.
Keep Node only for editor/tooling compatibility if needed.
Build Docker/deploy scripts around Bun.
Use Bun.serve WebSockets intentionally.

Bun officially supports server-side WebSockets via Bun.serve().  ￼

Option B — Node-first

Only do this if deployment requires Node.

Do this:

Replace Bun.file/Bun.serve/Bun-specific APIs.
Use a Node HTTP/WebSocket stack.
Compile server TS to JS.
Serve static files through Node APIs.
Update build:server to emit runnable JS, not copied TS.
Move engines to Node 24 LTS once verified.

Node 24 is the active LTS line while Node 22 is already maintenance LTS, according to the official Node release schedule.  ￼

My recommendation: stay Bun-first for now. It matches the current code and avoids a detour.

Client build

The current custom Bun.build client build can work, but it is bespoke. I would move the browser client to Vite once the map-pack/door cleanup is underway, not before.

Target:

client/
  src/
  public/
  vite.config.ts

Keep the game code framework-free initially. Vite can handle the dev server/HMR and production asset bundling without forcing React/Vue/etc.  ￼

Renderer

Do not rewrite rendering first.

Instead:

Create Renderer interface
Move current Canvas renderer behind it
Separate map rendering, entities, UI overlays, debug overlays
Add passability/depth/portal debug modes
Only then evaluate Pixi/Phaser

The current custom renderer is large, but a renderer migration will not fix door graphs, passability, or messy map data.

Networking

Current binary protocol work is probably fine to keep, but simplify the design goal.

For friend multiplayer:

server tick: modest and stable
movement interpolation client-side
interest areas/chunks retained
binary snapshots retained if already working
JSON acceptable for admin/debug/control messages
strict persistence transactions for inventory/chests/crops

Do not optimize for 2000 players before the game loop is fun.

Persistence

SQLite is a good fit for a casual hosted friend server. Keep it, but formalize schemas:

players
inventories
chests
world_objects
crop_tiles
resource_nodes
map_overlays
mail/messages later

Add:

backup command
compact/vacuum command
migration command
schema version table
admin reset commands

Do not ship local .sqlite, .sqlite-wal, or .sqlite-shm files in project archives.

⸻

Concrete cleanup tickets

Immediate blockers

BQ-MAP-001: Make map-pack.config.json the runtime source.
BQ-MAP-002: Pick canonical id world_01 and update all target_map references.
BQ-MAP-003: Set allow_missing_target_maps=false.
BQ-MAP-004: Add real placeholder house maps or remove house_* door links.
BQ-MAP-005: Fix portal semantics; stop relying on door.class === "Portal".
BQ-MAP-006: Delete/exclude generated maps, backups, .DS_Store, server/.data from handoff archives.
BQ-MAP-007: Add strict validator for layer names, door graph, object classes, and passability.

Map authoring cleanup

BQ-MAP-010: Define canonical layer taxonomy.
BQ-MAP-011: Rename/migrate noncanonical render layers.
BQ-MAP-012: Convert blank render objects to templates/prefabs.
BQ-MAP-013: Add explicit ground_type/movement metadata.
BQ-MAP-014: Add collision/passability debug overlay.
BQ-MAP-015: Validate doors/chests/spawns/resources are reachable.
BQ-MAP-016: Split interiors into separate maps.
BQ-MAP-017: Add Tiled .world file for multi-map editing.

Gameplay MVP

BQ-GAME-001: Stable player profile save/load.
BQ-GAME-002: Stable spawn/checkpoint/map transition flow.
BQ-GAME-003: Inventory with stackable items.
BQ-GAME-004: Chests with server-side transactions.
BQ-GAME-005: Basic tools: hoe, axe, pickaxe, watering can.
BQ-GAME-006: Crop tile state and crop growth.
BQ-GAME-007: Resource node harvesting.
BQ-GAME-008: NPC dialogue/shop interaction.
BQ-GAME-009: Simple cave/mines combat loop.
BQ-GAME-010: Shared chat and basic emotes.

Stack modernization

BQ-TECH-001: Declare Bun-first runtime or implement true Node runtime.
BQ-TECH-002: Update runtime documentation to match reality.
BQ-TECH-003: Move browser build to Vite or document why Bun.build remains.
BQ-TECH-004: Compile or package server artifact intentionally.
BQ-TECH-005: Remove stale generated map outputs from normal source flow.
BQ-TECH-006: Add CI check that rejects local data/backups in archives.
BQ-TECH-007: Add content schema validation for items/crops/npcs/mobs.
BQ-TECH-008: Split large client monoliths behind interfaces.

⸻

Acceptance criteria

A cleanup pass is successful when these are true:

Project archive contains no node_modules, dist, generated, .DS_Store, server/.data, map backups.
Server loads map-pack.config.json, not raw world.json.
Map id references are consistent.
allow_missing_target_maps is false.
Every linked door has a valid target map and target door.
Every gameplay object has a class/template and stable id where needed.
No blank gameplay objects exist.
Render-only tile objects are typed or generated from known prop templates.
Client and server collision agree.
Spawn points, doors, resources, chests, and NPC areas are reachable.
A debug overlay can show passability, triggers, and depth/foreground.
The game supports joining, moving, chatting, entering interiors, using chests, collecting resources, and saving state.

⸻

Recommended order of attack

1. Fix repository/archive hygiene.
2. Make map-pack config the only runtime map source.
3. Fix map ids and door graph validation.
4. Create real interior maps or remove fake links.
5. Define the layer/object/passability contract.
6. Convert blank props into templates/prefabs.
7. Add debug overlays and map validators.
8. Only then modernize the client build and renderer boundaries.
9. Build the Stardew-like gameplay loop on top of clean maps.

The pragmatic path is: map correctness first, gameplay second, renderer/build polish third, MMO-scale systems last or never.
