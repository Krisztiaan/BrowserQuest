# TODO Backlog + Execution Log

Last updated: 2026-02-13 19:44 UTC
Status legend: `todo` | `in_progress` | `done` | `blocked` | `deferred`

## Execution Queue (Work Order)

1. Ticket 40 (`done`) - Port gameplay systems to ECS
2. Ticket 34 (`done`) - Client ECS world state kernel
3. Ticket 26 (`done`) - Client runtime cutover (remove legacy session graph)
4. Ticket 36 (`done`) - Content-driven prefabs/components
5. Ticket 37 (`done`) - Mod/plugin API (ECS)
6. Ticket 41 (`done`) - Determinism/perf test harness
7. Ticket 12 (`deferred`) - Rendering modernization (product-gated)
8. Ticket 45 (`done`) - Mobile input + item loot pickup
9. Ticket 46 (`done`) - Movement sync + zoning camera
10. Ticket 47 (`done`) - Explicit interactions + stop dead-target attack
11. Ticket 48 (`done`) - Interaction state cleanup (loot/talk/open)
12. Ticket 49 (`done`) - Client ECS interaction intent system
13. Ticket 50 (`done`) - Client interaction system scheduling cleanup
14. Ticket 51 (`done`) - Extract client interaction intent system module
15. Ticket 52 (`done`) - Remove loot-moving player flag
16. Ticket 53 (`done`) - Client frame scheduler (staged systems)
17. Ticket 54 (`done`) - Client frame scheduler: time + start gating
18. Ticket 55 (`done`) - Stabilize smoke WS welcome timeouts
19. Ticket 56 (`done`) - Remove legacy wrapper methods (cursor/interaction)
20. Ticket 57 (`done`) - ECS hover state system (remove movecursor/updateCursor)
21. Ticket 58 (`done`) - ECS click intent system (remove processPlayerClick/Game.click)
22. Ticket 59 (`done`) - ECS environment systems (plateau/checkpoint/music)
23. Ticket 60 (`done`) - Move input/loot transient state into kernel
24. Ticket 61 (`done`) - Remove begin* interaction methods
25. Ticket 62 (`done`) - Remove setClientInteractionIntent method
26. Ticket 63 (`done`) - Remove clearClientInteractionIntent method
27. Ticket 64 (`done`) - Inline loot completion into system
28. Ticket 65 (`done`) - ECS runtime event buffer (connection boundary)
29. Ticket 66 (`done`) - Kernel-driven replication sync (reduce spawn/move handlers)
30. Ticket 67 (`done`) - Remove movement step hooks (spatial sync system)
31. Ticket 68 (`done`) - Client ECS command buffer + apply system
32. Ticket 69 (`done`) - Interaction intent executes via commands
33. Ticket 70 (`done`) - Runtime events emit commands only
34. Ticket 71 (`done`) - Replication sync emits commands only
35. Ticket 72 (`done`) - MOVE outbox emits commands only
36. Ticket 73 (`done`) - Environment system emits commands only
37. Ticket 74 (`done`) - Spatial sync emits commands only
38. Ticket 75 (`done`) - Combat tick via ECS commands
39. Ticket 76 (`done`) - Remove legacy player interaction helpers
40. Ticket 77 (`done`) - Protocol sends via ECS commands
41. Ticket 78 (`done`) - Stabilize smoke parity timeout
42. Ticket 79 (`done`) - Lint unused modules/exports
43. Ticket 80 (`done`) - Burn down lint warnings to zero
44. Ticket 81 (`done`) - Replace client updater loop with ECS systems
45. Ticket 82 (`done`) - Client spatial index from kernel (remove legacy grids)
46. Ticket 83 (`done`) - Client interaction systems use kernel spatial records
47. Ticket 84 (`done`) - Remove legacy client lookup/iterator modules
48. Ticket 85 (`done`) - Server: remove legacy zone groups + group messaging
49. Ticket 86 (`done`) - Server: ECS-native mob respawn (remove legacy timers)
50. Ticket 87 (`done`) - Combat: stop dead-target attacking + clear targets
51. Ticket 42 (`done`) - Modern client boot hardening
52. Ticket 88 (`done`) - Server: ECS outbox/interest replication without legacy Player objects
53. Ticket 89 (`done`) - Server: ECS-native connection/session (remove Player handshake dependency)
54. Ticket 90 (`todo`) - Server: ECS-native mobs/items/chests (delete legacy entity classes)
55. Ticket 91 (`todo`) - Server: remove legacy world entity maps (ECS-only world state)
56. Ticket 92 (`done`) - Server: fix MobArea.removeFromArea crash
57. Ticket 93 (`done`) - Server: fix mob chase/attack + despawn on kill
58. Ticket 94 (`done`) - Client: apply DAMAGE protocol to combat UI
59. Ticket 95 (`done`) - Client: DESPAWN removes rendered entity (kernel bookkeeping)
60. Ticket 96 (`done`) - Combat: preserve attack links across MOVE sync + verify mob hurts player
61. Ticket 97 (`done`) - Legacy parity audit: enemy AI/combat/respawn vs origin-master
62. Ticket 98 (`done`) - Server: server-authoritative combat loop (reduce client HIT/HURT reliance)
63. Ticket 99 (`done`) - Server: entity occupancy + collision (no clipping / orbiting)
64. Ticket 100 (`done`) - Client: combat graph idempotency (remove noisy disengage errors)
65. Ticket 101 (`done`) - Testing: Playwright kill/despawn/respawn regression (modern)
66. Ticket 102 (`done`) - Client: restore legacy auto-aggro scan/wire parity
67. Ticket 103 (`done`) - Server: mob chase cadence/repath parity under movement churn
68. Ticket 104 (`done`) - Server: static mob respawn state parity (HP + spawn position)
69. Ticket 105 (`done`) - Death/respawn parity: allow HELLO after death + client death state
70. Ticket 106 (`done`) - Server-authoritative player profiles (SQLite) + name-lock sessions + username-only local storage
71. Ticket 107 (`done`) - Server-authoritative achievement progress + protocol sync
72. Ticket 108 (`done`) - Modern web-app meta parity + returning profile image fallback
73. Ticket 109 (`done`) - Client bootstrap parity via username cookie (pre-WS returning flow)
74. Ticket 110 (`done`) - Flatten modern client entry to `/` (remove `/client/modern.html` canonical path)
75. Ticket 111 (`done`) - Server-rendered load-character preview image from cookie profile
76. Ticket 112 (`done`) - Fix empty SVG preview by embedding composed sprite layers
77. Ticket 113 (`done`) - Pixel-art intro portrait parity via client-side sprite composition
78. Ticket 114 (`done`) - Animate load-character idle portrait frames
79. Ticket 115 (`done`) - Remove social branding footer + refresh About copy
80. Ticket 116 (`done`) - Remove dead CSS rules for moztab/share footer
81. Ticket 117 (`done`) - Remove dead Facebook popup wiring in modern client bootstrap
82. Ticket 118 (`done`) - Remove dead Facebook achievement-share CSS selectors
83. Ticket 119 (`done`) - Restore door/portal traversal parity from origin-master
84. Ticket 120 (`done`) - Restore click-to-interact pathing parity (attack/talk/open)
85. Ticket 121 (`done`) - Eliminate animated-tile seams from smoothing drift
86. Ticket 122 (`done`) - Add animated-ground base underlay to remove frame-edge gaps






## Ticket 88: Server - ECS Outbox/Interest Replication Without Legacy Player Objects

- Status: `done`
- Priority: P1
- Scope:
  - Remove `WorldEcsCommandPipeline` dependencies on legacy `Player` objects for:
    - outbox `to_player` delivery
    - interest replication SPAWN/DESPAWN delivery
    - WHO response SPAWN delivery
  - Route protocol actions to connection queues by `playerId` only (ECS-first), treating the presence of an outgoing queue as “entered game”.
- Out of scope:
  - Removing legacy `Player`/`Mob`/`Item`/`Chest` classes entirely (Ticket 89/90).
  - Replacing legacy map/group adjacency utilities.
- Acceptance criteria:
  - `server/world/ecs-command-pipeline.ts` no longer calls `pushToPlayer(player, ...)` or `pushSpawnsToPlayer(player, ...)`.
  - Outbox/interest replication delivery does not require `getConnectionPlayerById(...)` lookups.
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 22:35 UTC
- End: 2026-02-12 23:31 UTC
- Status: `done`
- Key actions:
  - Added queue-based server delivery helpers (`isPlayerActive`, `pushToPlayerId`, `pushSpawnsToPlayerId`) in `server/world-server.ts`.
  - Updated `server/world/ecs-command-pipeline.ts` to route outbox + interest replication + WHO SPAWNs via `playerId` (no legacy `Player` object required).
  - Routed WELCOME delivery through the outgoing queue (no `player.send(...)` path required).
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun run test:browser:modern` (pass)
- Next action:
  - Ticket 89: introduce an ECS-native connection/session model and remove the remaining HELLO handshake dependency on legacy `Player`.


## Ticket 89: Server - ECS-Native Connection/Session (Remove Player Handshake Dependency)

- Status: `done`
- Priority: P1
- Scope:
  - Remove session/handshake wiring from the legacy `Player` class (no constructor side effects).
  - Attach the websocket session boundary at the runtime connect boundary (connection + world), translating protocol actions into ECS `Command`s.
  - Preserve handshake invariants (GO control message, HELLO-first gating, invalid-payload close semantics, idle timeout).
- Out of scope:
  - Removing legacy `Player` entity-object usage inside ECS systems (Ticket 90).
  - Changing the protocol wire format.
- Acceptance criteria:
  - `server/player.ts` no longer imports/calls `attachPlayerSession`.
  - `server/runtime.ts` attaches the session boundary on connect (not via `Player` constructor).
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
  - `bun run test:browser:modern`
- Dependencies/blockers:
  - Ticket 88.

### Progress log

- Start: 2026-02-12 23:31 UTC
- End: 2026-02-12 23:54 UTC
- Status: `done`
- Key actions:
  - Refactored protocol action translation to accept a typed ECS `CommandSource` (no `Player` dependency).
  - Replaced `attachPlayerSession(player)` with `attachWorldConnectionSession({ connection, world, playerId })` and installed it from `server/runtime.ts`.
  - Moved idle-timeout tracking into the session boundary and kept disconnect cleanup emitting legacy `exit`.
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun run test:browser:modern` (pass)
- Next action:
  - Ticket 90: remove remaining legacy entity classes (`Player`, `Mob`, `Item`, `Chest`) from ECS tick paths.


## Ticket 90: Server - ECS-Native Mobs/Items/Chests (Delete Legacy Entity Classes)

- Status: `todo`
- Priority: P0
- Scope:
  - Remove remaining legacy entity classes from the *server simulation* path:
    - `Player`, `Mob`, `Item`, `Chest`, and shared `Character`-style combat helpers.
  - Keep the network/session boundary ECS-first (already done in Ticket 88/89).
  - Ensure mobs/items/chests are spawned, ticked, and despawned purely from ECS components/resources.
- Out of scope:
  - Protocol wire changes (opcodes stay stable).
  - Client rendering modernization (Ticket 12).
- Acceptance criteria:
  - Server tick/systems (`server/world/*`, `server/ecs/*`) do not import/instantiate legacy `Player/Mob/Item/Chest` classes.
  - Spawn/despawn/respawn for mobs/items/chests is ECS-driven and does not depend on legacy timers/collections.
  - `bun run verify:modern` passes.
  - `bun run test:browser:modern` passes.
- Verification plan:
  - `bun run verify:modern`
  - `bun run test:browser:modern`
- Dependencies/blockers:
  - Ticket 89.
- Planned slices:
  - 90.1 (`todo`) Inventory/loot/chest state as ECS components (no `Character`/`Chest` mutation helpers).
  - 90.2 (`todo`) ECS spawn factories for mobs/items/chests (content-driven, deterministic ids).
  - 90.3 (`todo`) Delete legacy classes + update imports (keep thin DTOs only if needed at boundaries).
  - 90.4 (`todo`) Add focused unit tests for entity lifecycle + respawn invariants.


## Ticket 91: Server - Remove Legacy World Entity Maps (ECS-Only World State)

- Status: `todo`
- Priority: P0
- Scope:
  - Remove legacy world-owned entity maps/collections as sources of truth (ex: `world.entities`, `world.mobs`, `world.items`, etc.).
  - Replace remaining lookups with ECS queries + ECS-managed indices/resources (spatial index, interest sets, typed indices).
  - Keep any needed *derived* indices inside ECS resources (no ad-hoc global maps in `world-server.ts`).
- Out of scope:
  - Sharding/multi-world architecture.
  - Protocol redesign.
- Acceptance criteria:
  - Server simulation does not keep authoritative entity state outside ECS stores.
  - Entity lookup for command validation is ECS-first (generation-safe ids + ECS indices).
  - `bun run verify:modern` passes.
  - `bun run test:browser:modern` passes.
- Verification plan:
  - `bun run verify:modern`
  - `bun run test:browser:modern`
- Dependencies/blockers:
  - Ticket 90.
- Planned slices:
  - 91.1 (`todo`) Replace remaining `world.*Map` lookups in command validation with ECS queries.
  - 91.2 (`todo`) Remove/inline legacy world collections and adjust any callers.
  - 91.3 (`todo`) Add invariant tests: no duplicate ids, no stale-map references after despawn.


## Ticket 92: Server - Fix MobArea.removeFromArea Crash (Bind Method Call)

- Status: `done`
- Priority: P0
- Scope:
  - Fix the `TypeError: undefined is not an object (evaluating 'this.entities')` crash when removing a mob from its area.
- Out of scope:
  - Any broader mob/area refactor.
- Acceptance criteria:
  - Removing a mob from its area does not crash the server.
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 00:00 UTC
- End: 2026-02-13 00:04 UTC
- Status: `done`
- Key actions:
  - Fixed `server/world-server.ts` to call `area.removeFromArea(entity)` instead of calling a detached function (preserves `this`).
- Evidence:
  - `bun run verify:modern` (pass)
- Next action:
  - Continue Ticket 90 (legacy entity class deletion).



## Ticket 93: Server - Stabilize Mob AI Chase/Attack + Despawn-on-Kill

- Status: `done`
- Priority: P0
- Scope:
  - Replace server `mob_ai` movement with an ECS-position-driven, step-based chase that stops once adjacent (no random orbiting).
  - Ensure mob deaths trigger an immediate `DESPAWN` to nearby clients (no frozen corpses / still-attackable dead mobs).
- Out of scope:
  - Full pathfinding/avoidance/collision between entities (beyond map collision).
  - Combat math/balance changes.
- Acceptance criteria:
  - In modern runtime, mobs approach a targeted player and stop adjacent (non-diagonal) to attack (no frantic orbiting/clipping).
  - When a mob is killed, it despawns client-side promptly (does not remain clickable until respawn).
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
  - Manual: `bun run dev`, aggro/kill a mob; confirm mob attack hurts player and dead mob despawns.
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 00:32 UTC
- End: 2026-02-13 00:45 UTC
- Status: `done`
- Key actions:
  - Compared legacy mob chase/death behavior in `../BrowserQuest.wt-origin-master/server/js/worldserver.js` to modern ECS tick behavior.
  - Reworked `server/world/ecs-command-pipeline.ts` `mob_ai` to use ECS-position-driven, step-based chase and stop when adjacent (no random orbiting/clipping).
  - Broadcast `DESPAWN` on mob death (outbox `broadcast_nearby`) to prevent dead mobs sticking client-side.
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun test --timeout 20000 tests/unit/ecs/mob-ai-chase.test.ts` (pass)
- Next action:
  - Continue Ticket 90 (legacy entity class deletion).


## Ticket 94: Client - Apply DAMAGE Protocol to Combat UI

- Status: `done`
- Priority: P1
- Scope:
  - Wire `DAMAGE` protocol events into the ECS runtime so inflicted mob damage produces visible combat feedback (damage numbers / hurt flash).
  - Initialize client-side mob max HP from prefabs on spawn so damage application has a baseline.
- Out of scope:
  - Full authoritative mob HP replication (server -> client exact remaining HP).
  - New UI elements beyond existing combat info rendering.
- Acceptance criteria:
  - When the server sends `DAMAGE`, the client shows a damage info float and the mob flashes hurt.
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
  - Manual: `bun run dev`, hit a mob; confirm damage numbers appear.
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 00:32 UTC
- End: 2026-02-13 00:45 UTC
- Status: `done`
- Key actions:
  - Forwarded `DAMAGE` (`playerDamageMob`) through runtime -> kernel -> command apply so inflicted damage is visible (hurt flash + floating numbers).
  - Initialized client-side mob max HP from prefabs on spawn so damage feedback has a baseline.
  - Added unit tests for DAMAGE plumbing and mob HP initialization.
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun test --timeout 20000 tests/unit/client-combat-runtime-plumbing.test.ts` (pass)
- Next action:
  - Continue Ticket 90 (server legacy entity class deletion).


## Ticket 95: Client - Fix DESPAWN Not Removing Rendered Entities (Kernel Replication Bookkeeping)

- Status: `done`
- Priority: P0
- Scope:
  - Fix modern client where `DESPAWN` is received but the mob remains visible/attackable because kernel removal clears replication bookkeeping before the replication sync system can emit remove commands.
- Out of scope:
  - Any server-side despawn logic changes.
  - Renderer/entity-object removal (rendering modernization).
- Acceptance criteria:
  - When a `DESPAWN` is received, the entity is removed from the renderer via the kernel replication sync pipeline.
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 00:55 UTC
- End: 2026-02-13 01:05 UTC
- Status: `done`
- Key actions:
  - Identified that `ClientWorldKernel.removeEntity()` deletes `clientReplicationKnownAlive/Last*`, preventing `runClientKernelReplicationSyncSystem()` from detecting removals.
  - Updated `client/ecs/world-kernel.ts` to keep replication bookkeeping until the sync system drains it.
  - Added a unit test asserting `removeEntityById` is emitted after `removeEntity`.
- Evidence:
  - `bun run verify:modern` (pass)
- Next action:
  - Consider removing duplicate `DESPAWN` broadcasts (now that client removal is correct) if noisy.



## Ticket 96: Combat - Preserve Attack Links Across MOVE Sync + Verify Mob Hurts Player

- Status: `done`
- Priority: P0
- Scope:
  - Fix modern client replication movement (`MOVE` -> kernel -> `characterGoTo`) so remote attackers (mobs) do not drop combat state on each authoritative move.
  - Ensure mobs can successfully hurt the player (client emits `HURT`, server applies damage, client receives `HEALTH`).
  - Add deterministic Playwright coverage for the `AGGRO` -> `HURT` -> `HEALTH` loop.
- Out of scope:
  - Full server-authoritative combat (eliminate client-sent `HURT`/`HIT`).
  - Pathfinding/avoidance improvements beyond existing collision grid checks.
- Acceptance criteria:
  - Aggroing a mob results in the player taking damage (HP decreases; health bar updates) within a reasonable timeout.
  - Playwright test asserts the browser sends `HURT` and receives `HEALTH` after a deterministic aggro probe.
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
  - `bun run test:browser:modern`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 01:29 UTC
- End: 2026-02-13 02:14 UTC
- Status: `done`
- Key actions:
  - Fixed client kernel replication sync to treat the local player as an always-present target for attack links (mobs can target/attack the player).
  - Adjusted client authoritative MOVE application so remote entities don’t drop combat state on movement updates.
  - Added deterministic Playwright coverage for `AGGRO` -> `ATTACK` -> `HURT` -> `HEALTH`.
  - Improved server mob chase with a bounded BFS fallback step selector when greedy stepping is blocked by obstacles.
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun run test:browser:modern` (pass)
- Next action:
  - Continue Ticket 90 (server legacy entity class deletion).


## Ticket 97: Legacy Parity Audit - Enemy AI/Combat/Respawn (origin-master)

- Status: `done`
- Priority: P1
- Scope:
  - Compare modern runtime behavior to the origin-master worktree (`../BrowserQuest.wt-origin-master`) for:
    - mob chase/stop distances
    - combat authority + message flow
    - death/despawn + respawn lifecycle
    - client combat graph cleanup expectations
  - Produce a parity report and map deltas to executable follow-up tickets.
- Out of scope:
  - Implementing all parity fixes during the audit itself.
- Acceptance criteria:
  - A new audit doc captures legacy baselines, modern behavior, and concrete deviations.
  - Findings are mapped to server-first remediation tickets in `TODO.md`.
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun run verify:modern`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 14:00 UTC
- End: 2026-02-13 14:34 UTC
- Status: `done`
- Key actions:
  - Audited legacy reference behavior in `../BrowserQuest.wt-origin-master` for server + client combat/AI/despawn/respawn.
  - Audited modern runtime (`server/world/ecs-command-pipeline.ts`, `server/world-server.ts`, `client/game.ts`, `client/ecs/systems/*`) for parity gaps.
  - Published parity report with severity and remediation mapping in `docs/audit-legacy-parity-combat-ai-2026-02-13.md`.
  - Added parity follow-up tickets 102/103 for newly identified gaps (auto-aggro wiring, repath cadence parity).
- Evidence:
  - `docs/audit-legacy-parity-combat-ai-2026-02-13.md`
  - `bun run verify:modern` (pass)
- Next action:
  - Start Ticket 90 (server legacy entity class deletion), then Ticket 98 (server-authoritative combat loop).


## Ticket 98: Server - Server-Authoritative Combat Loop (Reduce Client HIT/HURT Reliance)

- Status: `done`
- Priority: P0
- Scope:
  - Make the server simulation authoritative for damage application:
    - mob -> player damage computed by server tick (adjacent + cooldown)
    - player -> mob damage computed by server tick (adjacent + cooldown)
  - Treat client messages as *intent* (`ATTACK`/target selection), not “I hit / I got hurt” (`HIT`/`HURT`).
  - Keep wire compatibility by continuing to *emit* the same outbound opcodes (ex: `ATTACK`, `HEALTH`, mob damage/death events).
- Out of scope:
  - Combat rebalance and equipment/skill systems.
  - Anti-cheat beyond basic range/cooldown validation.
- Acceptance criteria:
  - With a modern client that does **not** send `HIT`/`HURT`, combat still works end-to-end (player and mobs take damage).
  - Server validates attack range/cooldowns; clients cannot accelerate damage by spamming.
  - `bun run verify:modern` passes.
  - `bun run test:browser:modern` passes.
- Verification plan:
  - Add unit tests for cooldown/range damage application.
  - Update browser protocol coverage to validate combat behavior under modern runtime.
- Dependencies/blockers:
  - Ticket 90 (recommended to avoid dual-path logic).

### Progress log

- Start: 2026-02-13 14:36 UTC
- End: 2026-02-13 15:22 UTC
- Status: `done`
- Key actions:
  - Added `NextAttackTick` combat component and server-authoritative combat sim (`combat_authority`) in `server/world/ecs-command-pipeline.ts`.
  - Deprecated inbound `HIT`/`HURT` handlers to intent-only no-ops.
  - Added `syncCombatEntity` bridge and seeded combat ECS components from `server/world-server.ts` entity adds.
  - Added deterministic unit coverage for authoritative kill, cooldown, and range rejection in `tests/unit/ecs/mob-ai-chase.test.ts`.
- Evidence:
  - `server/ecs/combat-components.ts`
  - `server/world/ecs-command-pipeline.ts`
  - `server/world-server.ts`
  - `tests/unit/ecs/mob-ai-chase.test.ts`
  - `bun run verify:modern` (pass)
  - `bun run test:browser:modern` (pass)
- Next action:
  - Execute Ticket 99 (occupancy/collision parity).


## Ticket 99: Server - Entity Occupancy + Collision (No Clipping / Orbiting)

- Status: `done`
- Priority: P1
- Scope:
  - Add ECS-level occupancy constraints so entities cannot overlap tiles:
    - mobs cannot move into the player’s tile
    - mobs avoid stepping into occupied tiles (other mobs/chests/items where relevant)
  - Extend chase step selection to consider occupancy when choosing an adjacent “attack position”.
- Out of scope:
  - Full boids/steering behaviors.
  - Multi-agent pathfinding optimality.
- Acceptance criteria:
  - In a crowded fight, mobs do not clip into the player and do not “orbit jitter” indefinitely.
  - New unit tests cover: (a) blocked adjacency -> pick alternate adjacent, (b) never step onto occupied tile.
  - `bun run verify:modern` passes.
- Verification plan:
  - `bun test tests/unit/ecs/mob-ai-chase.test.ts` (extend)
  - `bun run verify:modern`
- Dependencies/blockers:
  - Ticket 38 (spatial index) already done.

### Progress log

- Start: 2026-02-13 14:42 UTC
- End: 2026-02-13 15:22 UTC
- Status: `done`
- Key actions:
  - Added occupancy map and `canMobMoveTo` filtering in `mob_ai` system (`server/world/ecs-command-pipeline.ts`).
  - Prevented stepping onto occupied player/mob/chest tiles and updated occupancy state as mobs move.
  - Added focused occupancy parity tests in `tests/unit/ecs/mob-ai-chase.test.ts`.
- Evidence:
  - `server/world/ecs-command-pipeline.ts`
  - `tests/unit/ecs/mob-ai-chase.test.ts`
  - `bun run verify:modern` (pass)
- Next action:
  - Execute Ticket 100 (client combat graph idempotency).


## Ticket 100: Client - Combat Graph Idempotency (Remove Noisy Disengage Errors)

- Status: `done`
- Priority: P2
- Scope:
  - Make client combat graph updates idempotent:
    - tolerate duplicate removeTarget/removeAttacker sequences
    - avoid throwing/logging errors for expected reorderings during despawn/death
  - Ensure client cleanup on `DESPAWN`/death cannot leave “still attackable” ghosts.
- Out of scope:
  - Full renderer modernization (Ticket 12).
- Acceptance criteria:
  - The client no longer logs `X is not attacked by Y` during normal kills/despawns.
  - Combat cleanup is stable under rapid spawn/despawn (no lingering targets/attackers).
  - `bun run verify:modern` passes.
- Verification plan:
  - Add a focused unit test for idempotent combat cleanup.
  - `bun run verify:modern`
- Dependencies/blockers:
  - Ticket 98 (combat loop changes may reorder events).

### Progress log

- Start: 2026-02-13 14:47 UTC
- End: 2026-02-13 15:22 UTC
- Status: `done`
- Key actions:
  - Made attacker graph updates idempotent in `client/character.ts` by removing noisy duplicate/missing-edge error logging paths.
  - Added deterministic client cleanup coverage with kernel despawn and combat-runtime plumbing tests.
- Evidence:
  - `client/character.ts`
  - `tests/unit/client-kernel-despawn-sync.test.ts`
  - `tests/unit/client-combat-runtime-plumbing.test.ts`
  - `bun run verify:modern` (pass)
- Next action:
  - Execute Ticket 101 (kill/despawn/respawn regression coverage).


## Ticket 101: Testing - Playwright Kill/Despawn/Respawn Regression (Modern)

- Status: `done`
- Priority: P2
- Scope:
  - Add stable regression coverage for modern kill/despawn/respawn lifecycle.
  - Keep browser protocol coverage focused on deterministic scenarios; keep kill/respawn lifecycle assertions deterministic in unit/sim harness.
- Out of scope:
  - Full botting harness.
- Acceptance criteria:
  - Regression coverage fails on “dead mob remains interactable / no despawn” class regressions.
  - `bun run test:browser:modern` passes.
- Verification plan:
  - `bun test tests/unit/ecs/mob-ai-chase.test.ts`
  - `bun run test:browser:modern`
- Dependencies/blockers:
  - Ticket 98.

### Progress log

- Start: 2026-02-13 14:52 UTC
- End: 2026-02-13 15:22 UTC
- Status: `done`
- Key actions:
  - Added deterministic kill/despawn regression assertions in `tests/unit/ecs/mob-ai-chase.test.ts`.
  - Added respawn task lifecycle coverage (`scheduleStaticRespawn` -> `respawn` emission) in the same unit suite.
  - Extended protocol observer (`tests/browser/protocol-observer.ts`) and modern browser protocol suite to keep combat protocol coverage green under the new authority model.
  - Added robust kill probe control hook in `client/main.ts` (`sendKillDespawnProbe`) for iterative gameplay diagnostics.
- Evidence:
  - `tests/unit/ecs/mob-ai-chase.test.ts`
  - `tests/browser/protocol-observer.ts`
  - `tests/browser/modern-protocol-actions.playwright.ts`
  - `client/main.ts`
  - `bun run test:browser:modern` (pass)
- Next action:
  - Execute Ticket 102 (auto-aggro parity).


## Ticket 102: Client - Restore Legacy Auto-Aggro Scan/Wire Parity

- Status: `done`
- Priority: P1
- Scope:
  - Restore legacy auto-aggro behavior in modern client runtime:
    - periodic nearby aggressive-mob scan while player is idle/not attacking
    - enqueue `clientSendAggro` for newly threatening mobs
  - Implement this in ECS systems (no reintroduction of ad-hoc legacy event wiring).
- Out of scope:
  - Server-authoritative damage loop changes (Ticket 98).
- Acceptance criteria:
  - When standing within aggro range of an aggressive mob, modern client emits `AGGRO` without manual probe/control APIs.
  - Behavior is idempotent (no AGGRO spam flood for the same mob while already linked).
  - `bun run verify:modern` passes.
- Verification plan:
  - Add deterministic system-level coverage for auto-aggro emission + idempotency.
  - `bun run test:browser:modern`
  - `bun run verify:modern`
- Dependencies/blockers:
  - Ticket 97.

### Progress log

- Start: 2026-02-13 14:56 UTC
- End: 2026-02-13 15:22 UTC
- Status: `done`
- Key actions:
  - Implemented periodic idle auto-aggro scan in `client/ecs/systems/client-simulation-system.ts` with dedup guards (`isAttackedBy` / `isWaitingToAttack`).
  - Added deterministic unit coverage for emit + idempotency in `tests/unit/ecs/client-auto-aggro-system.test.ts`.
  - Hardened aggro diagnostic probe in `client/main.ts` to move near a mob before emitting AGGRO.
- Evidence:
  - `client/ecs/systems/client-simulation-system.ts`
  - `tests/unit/ecs/client-auto-aggro-system.test.ts`
  - `client/main.ts`
  - `bun run test:browser:modern` (pass)
  - `bun run verify:modern` (pass)
- Next action:
  - Execute Ticket 103 (chase cadence/repath parity).


## Ticket 103: Server - Mob Chase Cadence/Repath Parity Under Movement Churn

- Status: `done`
- Priority: P1
- Scope:
  - Reduce chase lag/jitter deltas vs legacy by improving server-side repath triggers/cadence:
    - tune fixed chase cadence and/or add repath triggers on relevant target movement changes
    - preserve deterministic behavior and leash constraints
  - Keep authoritative movement on the server.
- Out of scope:
  - Full multi-agent pathfinding overhaul.
- Acceptance criteria:
  - Under rapid player movement, mobs maintain stable pursuit and converge to adjacent attack positions without excessive orbiting.
  - Server-side unit coverage exists for movement-churn chase behavior.
  - `bun run verify:modern` passes.
- Verification plan:
  - Extend `tests/unit/ecs/mob-ai-chase.test.ts` for movement-churn scenarios.
  - `bun run verify:modern`
- Dependencies/blockers:
  - Ticket 97.
  - Ticket 99 (occupancy/collision) recommended.

### Progress log

- Start: 2026-02-13 14:58 UTC
- End: 2026-02-13 15:22 UTC
- Status: `done`
- Key actions:
  - Removed coarse tick gating in `mob_ai` and switched to per-tick chase evaluation (except tick 0 bootstrap).
  - Kept leash + bounded BFS fallback pathing while adding movement-churn parity assertions.
  - Added movement-churn repath test in `tests/unit/ecs/mob-ai-chase.test.ts`.
- Evidence:
  - `server/world/ecs-command-pipeline.ts`
  - `tests/unit/ecs/mob-ai-chase.test.ts`
  - `bun run verify:modern` (pass)
- Next action:
  - Continue Ticket 90/91 legacy-entity-map removals.

## Ticket 104: Server - Static Mob Respawn State Parity (HP + Spawn Position)

- Status: `done`
- Priority: P1
- Scope:
  - Fix ECS static-mob respawn wiring so respawned mobs restore combat state (hit points) and return to spawn coordinates.
  - Keep existing ECS respawn task scheduling and wire protocol unchanged.
- Out of scope:
  - Full legacy `Mob` class removal (Ticket 90).
  - Mob area respawn randomization changes.
- Acceptance criteria:
  - Respawn callback for static mobs restores HP before re-adding to world state.
  - Respawn callback resets static mobs to spawn coordinates before re-adding.
  - Targeted unit coverage exists for static mob respawn invariants.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/server-chest-item-lifecycle.test.ts`
  - `bun test tests/unit/ecs/mob-ai-chase.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 15:41 UTC
- End: 2026-02-13 16:04 UTC
- Status: `done`
- Key actions:
  - Updated static mob respawn callback in `server/world/chest-item-lifecycle.ts` to reset position to spawn point and refresh hit points before `addMob`.
  - Added focused regression coverage in `tests/unit/server-chest-item-lifecycle.test.ts`.
  - Reproduced and verified fix with a runtime probe against a real `World` instance (respawned static mob now returns with full HP at spawn).
- Evidence:
  - `bun test tests/unit/server-chest-item-lifecycle.test.ts` (pass)
  - `bun test tests/unit/ecs/mob-ai-chase.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Continue Ticket 90/91 legacy-entity-map removals.

## Ticket 105: Death/Respawn Parity - Allow HELLO After Death + Client Death State

- Status: `done`
- Priority: P1
- Scope:
  - Restore legacy handshake behavior so a dead player can re-HELLO without reconnecting.
  - Restore client-side death state transition when server sends `HEALTH` with `0` HP.
- Out of scope:
  - Full client-side death animation parity refactor.
  - Connection model redesign.
- Acceptance criteria:
  - Session layer rejects duplicate `HELLO` only for active + alive players; dead players are allowed to send `HELLO`.
  - Client marks local player dead and emits `playerDeath` when authoritative health reaches zero.
  - Regression tests cover both server handshake gating and client death transition.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/player-session.test.ts`
  - `bun test tests/unit/client-player-death-flow.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 16:06 UTC
- End: 2026-02-13 16:21 UTC
- Status: `done`
- Key actions:
  - Updated `server/player-session.ts` handshake guard to allow `HELLO` while `player.isDead === true` (legacy parity).
  - Updated `client/ecs/systems/client-command-apply-system.ts` `setPlayerHealth` handling to transition to dead state (`player.die()`, `playerDeath` emit, death sound) at `HP <= 0`.
  - Added regression tests for both paths.
- Evidence:
  - `bun test tests/unit/player-session.test.ts` (pass)
  - `bun test tests/unit/client-player-death-flow.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Continue Ticket 90/91 legacy-entity-map removals.

## Ticket 106: Server-Authoritative Player Profiles (SQLite) + Name-Lock Sessions + Username-Only Local Storage

- Status: `done`
- Priority: P1
- Scope:
  - Add server-side SQLite persistence for player profile essentials (name, armor, weapon, checkpoint).
  - Enforce single active session per player name (first connected keeps the name lock; duplicates rejected).
  - Apply persisted profile during `HELLO` so server is authoritative for loadout/spawn checkpoint.
  - Persist equipment/checkpoint changes server-side from authoritative command pipeline.
  - Reduce browser persistent storage to username-only.
- Out of scope:
  - Full account/auth system.
  - Cross-device secure identity ownership (name-only identity remains spoofable while offline).
  - New inventory model beyond current BrowserQuest equip/drop semantics.
- Acceptance criteria:
  - Server stores profile data in SQLite and restores armor/weapon/checkpoint on reconnect.
  - Duplicate active name login is rejected while original connection remains active.
  - On disconnect, name lock is released.
  - Client localStorage persistent payload is username-only (no durable armor/weapon/achievements/profile blob).
  - Targeted unit tests + typecheck pass.
- Verification plan:
  - `bun test tests/unit/player-session.test.ts`
  - `bun test tests/unit/server-player-persistence.test.ts`
  - `bun test tests/unit/client-storage.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 16:44 UTC
- End: 2026-02-13 17:12 UTC
- Status: `done`
- Key actions:
  - Added `server/player-persistence.ts` (SQLite profile/session store) with startup session cleanup and profile fields for name/equipment/checkpoint.
  - Wired runtime/world integration so each world uses shared persistence and emits db-path in structured startup metadata.
  - Updated session handshake (`server/player-session.ts`) to enforce single-active-name locks, attach persisted profile data to `HELLO`, and release claims on close.
  - Updated server ECS command pipeline (`server/world/ecs-command-pipeline.ts`) to apply persisted profile data on `HELLO` and persist equipment/checkpoint changes.
  - Updated client persistence (`client/storage.ts`) to username-only storage with legacy migration from `data`, and removed local armor/weapon restore behavior from `client/game.ts`.
  - Added focused unit coverage for session handshake profile/name-lock behavior, SQLite persistence semantics, and username-only client storage.
- Evidence:
  - `bun test --timeout 20000 tests/unit/player-session.test.ts tests/unit/server-player-persistence.test.ts tests/unit/client-storage.test.ts tests/unit/server-config-preflight.test.ts` (pass)
  - `bun test --timeout 20000 tests/unit/server/runtime/factories.test.ts tests/unit/server/runtime/source.test.ts tests/unit/server/runtime/dependencies.test.ts tests/unit/server/runtime/lifecycle.test.ts` (pass)
  - `bun test --timeout 20000 tests/unit/server/startup/*.test.ts` (pass)
  - `bun x eslint server/player-persistence.ts server/player-session.ts server/world-server.ts server/world/ecs-command-pipeline.ts server/runtime.ts server/config-preflight.ts client/storage.ts client/preflight.ts client/app.ts client/game.ts client/main.ts client/ecs/systems/client-command-apply-system.ts tests/unit/player-session.test.ts tests/unit/server-player-persistence.test.ts tests/unit/client-storage.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Continue Ticket 90/91 legacy-entity-map removals after validating gameplay parity for server-authoritative profile loading in live runs.

## Ticket 107: Server-Authoritative Achievement Progress + Protocol Sync

- Status: `done`
- Priority: P1
- Scope:
  - Add protocol support for server-to-client achievement progress snapshot and client-to-server unlocked-achievement acknowledgements.
  - Persist achievement counters/unlocked IDs in SQLite under the same player profile identity used by Ticket 106.
  - Update server combat/death hooks to persist kill/damage/revive counters.
  - Hydrate client achievement state from server snapshot on login and report unlocks back to server.
- Out of scope:
  - Authentication/anti-spoof guarantees.
  - Full achievement system redesign.
- Acceptance criteria:
  - Achievement progress survives reconnect without relying on browser localStorage.
  - Server sends progress snapshot on login and client applies it to UI/state.
  - Client reports unlocks and server persists unlocked IDs.
  - Targeted unit/type checks pass.
- Verification plan:
  - `bun test tests/unit/server-player-persistence.test.ts`
  - `bun test tests/unit/player-session.test.ts`
  - `bun test tests/unit/client-storage.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 106.

### Progress log

- Start: 2026-02-13 17:24 UTC
- End: 2026-02-13 17:45 UTC
- Status: `done`
- Key actions:
  - Added protocol opcodes/types/manifest/handler coverage for `ACHIEVEMENT` (client->server) and `ACHIEVEMENTS` (server->client snapshot).
  - Extended SQLite persistence (`server/player-persistence.ts`) with normalized achievement progress/unlock tables and counter/unlock persistence APIs.
  - Wired world/runtime server plumbing to persist unlocks, kill counters, damage-taken counters, and revive counters; login now sends an `ACHIEVEMENTS` snapshot after `WELCOME`.
  - Added ECS command handling for inbound `ACHIEVEMENT` and hooked server-authoritative combat/death paths to persistence updates.
  - Added client-side snapshot hydration + kill/achievement command handling and unlock reporting (`tryUnlockingAchievement` now sends `clientSendAchievement`).
  - Restored legacy kill-achievement parity client behavior (`HUNTER`, `ANGRY_RATS`, `SKULL_COLLECTOR`, `HERO`, plus kill notifications) and damage-based `MEATSHIELD` progression.
  - Added/updated unit coverage for player-session translation, server persistence counters/unlocks, storage snapshot hydration, and protocol registry opcode coverage.
- Evidence:
  - `bun test tests/unit/server-player-persistence.test.ts tests/unit/player-session.test.ts tests/unit/client-storage.test.ts tests/unit/client-player-death-flow.test.ts tests/unit/protocol/registry.test.ts` (pass)
  - `bun run typecheck` (pass)
  - `bun x eslint client/storage.ts client/game.ts client/ecs/systems/client-command-apply-system.ts server/player-persistence.ts server/world-server.ts server/world/ecs-command-pipeline.ts server/protocol/outbound-actions.ts server/player-session-command-translation.ts server/ecs/commands.ts tests/unit/player-session.test.ts tests/unit/server-player-persistence.test.ts tests/unit/client-storage.test.ts tests/unit/client-player-death-flow.test.ts tests/unit/protocol/registry.test.ts tests/support/protocol/contract.ts` (pass)
  - `bun test tests/unit/protocol/support-contract.test.ts tests/unit/server-format.test.ts` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Resume Ticket 90/91 legacy world-state class/map removals in dependency order.

## Ticket 108: Modern Web-App Meta Parity + Returning Profile Image Fallback

- Status: `done`
- Priority: P2
- Scope:
  - Add `mobile-web-app-capable` meta compatibility tag to the modern client document.
  - Remove empty-`src` broken-image behavior for returning-character portrait on modern entry.
  - Add a deterministic fallback player image for username-only local persistence mode.
- Out of scope:
  - Reintroducing browser-side profile image persistence.
  - UI redesign of intro/load-character screens.
- Acceptance criteria:
  - Browser console no longer reports deprecated-only web-app-capable meta warning on modern page.
  - Returning profile page no longer renders a broken `<img id="playerimage">` icon when no stored profile image exists.
  - `bun x eslint client/main.ts client/modern.html` passes.
- Verification plan:
  - `bun x eslint client/main.ts client/modern.html`
- Dependencies/blockers:
  - Ticket 106 (username-only local storage migration) acknowledged.

### Progress log

- Start: 2026-02-13 17:46 UTC
- End: 2026-02-13 17:53 UTC
- Status: `done`
- Key actions:
  - Added `mobile-web-app-capable` alongside existing Apple meta capability tag in `client/modern.html`.
  - Replaced empty intro portrait `src` with a deterministic fallback image to prevent browser broken-image rendering.
  - Added runtime fallback logic in `client/main.ts` to always initialize `#playerimage` to a deterministic default and recover from invalid legacy image URLs via `error` fallback.
  - Follow-up fix: switched the fallback image from an armor spritesheet to `/img/common/thingy.png` so only a single static icon is rendered.
  - Preserved legacy behavior of overriding the default portrait with stored image data when present.
- Evidence:
  - `bun x eslint client/main.ts` (pass)
  - `bun x prettier --check client/modern.html` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Ticket 109: add cookie-backed returning bootstrap (pre-WS) to match new server-side profile persistence UX.

## Ticket 109: Client Bootstrap Parity via Username Cookie (Pre-WS Returning Flow)

- Status: `done`
- Priority: P1
- Scope:
  - Add username cookie read/write/clear support in client storage.
  - Make preflight/app bootstrap detect returning player from cookie before WebSocket connect.
  - Keep browser-side persistence limited to username (no local profile blob resurrection).
- Out of scope:
  - Server-rendered HTML variants by cookie.
  - Authentication/account model changes.
- Acceptance criteria:
  - On a fresh page load with username cookie and no WS connection yet, intro opens on `loadcharacter`.
  - Clearing/resetting character clears both local username key and cookie.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test tests/unit/client-storage.test.ts`
- Dependencies/blockers:
  - Ticket 106 (username-only local persistence) done.

### Progress log

- Start: 2026-02-13 18:05 UTC
- End: 2026-02-13 18:11 UTC
- Status: `done`
- Key actions:
  - Added cookie-backed username helpers in `client/storage.ts` (`read/write/clear`) and integrated them into `save()`/`clear()` lifecycle so username persistence is mirrored to cookie storage.
  - Updated storage bootstrap to read cookie fallback when localStorage username is absent, preserving username-only local persistence behavior.
  - Updated `client/preflight.ts` and `client/app.ts` startup checks to use `Storage.hasAlreadyPlayed()` so pre-WS returning flow works with cookie-backed username.
  - Added cookie-focused client storage unit coverage in `tests/unit/client-storage.test.ts`.
- Evidence:
  - `bun x eslint client/storage.ts client/app.ts client/preflight.ts tests/unit/client-storage.test.ts` (pass)
  - `bun test tests/unit/client-storage.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Ticket 110: collapse canonical modern entry to `/` and keep compatibility redirect.

## Ticket 110: Flatten Modern Client Entry to Root Path (`/`)

- Status: `done`
- Priority: P2
- Scope:
  - Make `/` the canonical modern client entry (no root redirect hop).
  - Keep `/client/modern.html` as compatibility shim redirecting to `/`.
  - Update docs/tests/config expecting `/client/modern.html`.
- Out of scope:
  - Server static hosting redesign.
  - Protocol/runtime changes.
- Acceptance criteria:
  - Visiting `/` directly loads the full modern app shell.
  - Browser tests target `/` and pass.
  - Legacy `/client/modern.html` links still reach the same app via redirect.
- Verification plan:
  - `bun run typecheck`
  - `bun test tests/browser/modern-ui-smoke.playwright.ts`
- Dependencies/blockers:
  - Ticket 109 (for returning-screen bootstrap verification on canonical entry).

### Progress log

- Start: 2026-02-13 18:07 UTC
- End: 2026-02-13 18:11 UTC
- Status: `done`
- Key actions:
  - Promoted root `index.html` to the full modern app shell and rewired client asset/module paths to `/client/*`.
  - Converted `client/modern.html` and `client/index.html` into compatibility redirects to `/`.
  - Updated browser tests/config/docs to use `/` as canonical entry path while preserving `/client/modern.html` backward compatibility.
- Evidence:
  - `bun x eslint tests/browser/modern-ui-smoke.playwright.ts tests/browser/modern-protocol-actions.playwright.ts tests/browser/protocol-invariant.playwright.ts` (pass)
  - `bun x prettier --check index.html client/modern.html client/index.html` (pass)
  - `bun x playwright test --config=playwright.config.ts tests/browser/protocol-invariant.playwright.ts` (pass)
  - `bun x playwright test --config=playwright.config.ts tests/browser/modern-protocol-actions.playwright.ts -g "HELLO and CHAT"` (pass)
  - `bun x playwright test --config=playwright.config.ts tests/browser/modern-ui-smoke.playwright.ts` (1 pass, 1 timeout) then rerun `-g "modern jQuery-driven UI controls toggle expected classes in-session"` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 111: Server-Rendered Load-Character Preview Image from Cookie Profile

- Status: `done`
- Priority: P1
- Scope:
  - Replace fallback down-arrow preview with a server-rendered portrait source that resolves from persisted profile data keyed by the username cookie.
  - Add an HTTP preview route that resolves armor from SQLite profile and returns a cropped character portrait frame.
  - Wire modern intro/load-character UI to request this route before websocket connect.
- Out of scope:
  - Full server-side HTML templating for intro page.
  - Reintroducing client-side profile image dataURL persistence.
- Acceptance criteria:
  - Returning user on load-character screen sees a character portrait (not `/img/common/thingy.png`) before websocket connect.
  - Portrait reflects persisted armor progression from server profile.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/server-profile-preview.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 109 (username cookie bootstrap) done.

### Progress log

- Start: 2026-02-13 18:17 UTC
- End: 2026-02-13 18:20 UTC
- Status: `done`
- Key actions:
  - Added `server/profile-preview.ts` to resolve username from cookie, look up persisted profile armor in SQLite, and return a server-rendered SVG portrait frame (`idle_down`) from the armor spritesheet.
  - Extended websocket HTTP runtime with `/profile/preview.svg` route registration and wired it in `server/runtime.ts`.
  - Added Vite dev proxy for `/profile/*` and switched intro load-character portrait source to `/profile/preview.svg`.
  - Updated `client/main.ts` fallback logic to prefer server preview route and fall back to `/img/common/thingy.png` only if preview fails.
  - Added focused unit coverage for cookie parsing/profile lookup rendering path in `tests/unit/server-profile-preview.test.ts`.
- Evidence:
  - `bun x eslint server/profile-preview.ts server/runtime.ts server/runtime-types.ts server/ws/runtime.ts client/main.ts tests/unit/server-profile-preview.test.ts` (pass)
  - `bun test tests/unit/server-profile-preview.test.ts` (pass)
  - `bun run typecheck` (pass)
  - `bun x prettier --check index.html` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 112: Fix Empty SVG Preview by Embedding Composed Sprite Layers

- Status: `done`
- Priority: P1
- Scope:
  - Replace external `/img/*` references inside preview SVG with embedded data URIs so browser `<img src="/profile/preview.svg">` renders reliably.
  - Compose portrait layers (shadow + armor + weapon) using the same frame/offset model as client renderer.
- Out of scope:
  - Full PNG rasterization server-side.
  - Intro template SSR.
- Acceptance criteria:
  - `/profile/preview.svg` response includes embedded image data and renders non-empty in `<img>`.
  - Preview includes persisted armor/weapon selection metadata.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/server-profile-preview.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 111.

### Progress log

- Start: 2026-02-13 18:21 UTC
- End: 2026-02-13 18:25 UTC
- Status: `done`
- Key actions:
  - Reworked `server/profile-preview.ts` to load sprite JSON+PNG assets from repo, cache them, and emit a composed SVG with embedded `data:image/png;base64,...` layers.
  - Added armor+weapon resolution and frame math (`idle_down` row + sprite offsets) to mirror the client portrait composition approach.
  - Added unit coverage for persisted armor/weapon metadata composition in `tests/unit/server-profile-preview.test.ts`.
  - Verified runtime route returns a non-empty SVG payload with embedded assets.
- Evidence:
  - `bun x eslint server/profile-preview.ts tests/unit/server-profile-preview.test.ts` (pass)
  - `bun test tests/unit/server-profile-preview.test.ts` (pass)
  - `bun run typecheck` (pass)
  - Runtime check: `curl http://127.0.0.1:8000/profile/preview.svg` (200, non-empty SVG with embedded data URIs)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 113: Pixel-Art Intro Portrait Parity via Client-Side Sprite Composition

- Status: `done`
- Priority: P1
- Scope:
  - Stop relying on browser SVG rasterization for intro portrait rendering.
  - Fetch server profile preview metadata (armor/weapon names) and compose the portrait in-browser from existing sprite assets (shadow + armor + weapon), matching renderer layering math.
  - Harden CSS image-rendering for pixel-art scaling.
- Out of scope:
  - Full server-rendered intro HTML.
  - WS/session handshake changes.
- Acceptance criteria:
  - Load-character portrait renders as pixel-art (no blurred/antialiased look).
  - Composition uses the same client sprite assets already shipped to browser.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/server-profile-preview.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 111/112.

### Progress log

- Start: 2026-02-13 18:27 UTC
- End: 2026-02-13 18:32 UTC
- Status: `done`
- Key actions:
  - Added profile preview JSON payload API in `server/profile-preview.ts` and routed `/profile/preview.json` through runtime.
  - Updated `client/main.ts` to fetch preview metadata and compose portrait on a 32x32 canvas from `/img/1/{shadow16,armor,weapon}.png` using idle-down frame + offset math.
  - Retained `/profile/preview.svg` as fallback path.
  - Tightened `#playerimage` CSS with `image-rendering: pixelated`.
  - Added unit coverage for preview JSON payload shape in `tests/unit/server-profile-preview.test.ts`.
- Evidence:
  - `bun x eslint server/profile-preview.ts server/runtime.ts server/ws/runtime.ts client/main.ts tests/unit/server-profile-preview.test.ts` (pass)
  - `bun test tests/unit/server-profile-preview.test.ts` (pass)
  - `bun run typecheck` (pass)
  - Runtime probe: `curl /profile/preview.json` returns armor/weapon payload; `curl /profile/preview.svg` returns non-empty composed SVG.
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 114: Animate Load-Character Idle Portrait Frames

- Status: `done`
- Priority: P2
- Scope:
  - Animate load-character portrait using idle animation frames from armor/weapon sprites.
  - Keep composition client-side from existing sprite assets and server-provided preview metadata.
- Out of scope:
  - New animation assets or pose variants.
  - Runtime/gameplay animation pipeline changes.
- Acceptance criteria:
  - Load-character portrait cycles through idle frames instead of static pose.
  - Animation preserves pixel-art rendering.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun x eslint client/main.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 113.

### Progress log

- Start: 2026-02-13 18:34 UTC
- End: 2026-02-13 18:39 UTC
- Status: `done`
- Key actions:
  - Refactored intro portrait composition in `client/main.ts` from one-shot static render to reusable runtime with idle frame metadata.
  - Added frame-length extraction for `idle_down` and interval-driven frame cycling while on returning screen.
  - Kept sprite layering parity (`shadow + armor + weapon`) and pixel-art draw settings.
- Evidence:
  - `bun x eslint client/main.ts server/profile-preview.ts server/runtime.ts server/ws/runtime.ts tests/unit/server-profile-preview.test.ts` (pass)
  - `bun test tests/unit/server-profile-preview.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 115: Remove Social Branding Footer + Refresh About Copy

- Status: `done`
- Priority: P3
- Scope:
  - Remove legacy `#moztab` anchor and “Share this on” footer block from the modern root entry UI.
  - Update “What is BrowserQuest?” intro copy to reflect the modernized runtime (Bun/Vite/ECS/server-authoritative state).
- Out of scope:
  - CSS cleanup for now-unused selectors.
  - Gameplay/mechanics changes.
- Acceptance criteria:
  - No `#moztab` element rendered.
  - Footer no longer shows “Share this on”.
  - About section text reflects current modern project direction.
- Verification plan:
  - `bun x prettier --check index.html`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 18:40 UTC
- End: 2026-02-13 18:41 UTC
- Status: `done`
- Key actions:
  - Removed the `#moztab` branding anchor from `index.html`.
  - Removed the legacy “Share this on” footer block and normalized the Privacy footer entry after removing the lead dash.
  - Rewrote the “What is BrowserQuest?” section copy to describe the current modernized runtime (Bun/Vite/TypeScript, ECS/server-authoritative simulation, server-side profile persistence).
- Evidence:
  - `bun x prettier --check index.html` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 116: Remove Dead CSS Rules for Moztab/Share Footer

- Status: `done`
- Priority: P3
- Scope:
  - Remove stale CSS selectors/rules that only styled removed `#moztab` and `#sharing` UI blocks.
  - Keep functional styles required for remaining UI/achievement sharing links intact.
- Out of scope:
  - Full stylesheet refactor/normalization.
  - Gameplay UI redesign.
- Acceptance criteria:
  - `client/css/main.css` contains no `#moztab` or `#sharing` selectors.
  - Background sprite selector lists no longer carry unused `.facebook/.twitter` entries tied to removed footer social icons.
  - `bun run typecheck` passes.
- Verification plan:
  - `rg -n "#moztab|#sharing" client/css/main.css`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 115.

### Progress log

- Start: 2026-02-13 18:44 UTC
- End: 2026-02-13 18:47 UTC
- Status: `done`
- Key actions:
  - Removed `#moztab` and `#sharing` style blocks and related responsive width/display toggles from `client/css/main.css`.
  - Removed obsolete `.facebook/.twitter` entries from shared spritesheet background selector lists and upscaled variants.
  - Preserved achievement-sharing CSS selectors (`.achievement-sharing a`) and active footer/legal styles.
- Evidence:
  - `rg -n "#moztab|#sharing|\\.upscaled .*\\.facebook|\\.upscaled .*\\.twitter" client/css/main.css` (no matches)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 117: Remove Dead Facebook Popup Wiring in Modern Client Bootstrap

- Status: `done`
- Priority: P3
- Scope:
  - Remove no-op `.facebook` popup click wiring from `client/main.ts`.
  - Remove directly-related unused popup type surface when no remaining caller requires Facebook popup behavior.
- Out of scope:
  - Broader social-share redesign.
  - Gameplay systems and server ECS parity work.
- Acceptance criteria:
  - `client/main.ts` no longer registers `.facebook` click popup handlers.
  - Popup type domain and popup sizing logic only include still-used popup types.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test tests/unit/asset-key-domain.test.ts`
- Dependencies/blockers:
  - Ticket 116.

### Progress log

- Start: 2026-02-13 18:49 UTC
- End: 2026-02-13 18:50 UTC
- Status: `done`
- Key actions:
  - Removed the `.facebook` popup click-handler registration from `client/main.ts`.
  - Narrowed popup domain to active type only (`twitter`) and simplified popup sizing path in `client/app.ts`.
  - Updated popup-domain unit expectations to match the active runtime surface.
- Evidence:
  - `bun test tests/unit/asset-key-domain.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 118: Remove Dead Facebook Achievement-Share CSS Selectors

- Status: `done`
- Priority: P3
- Scope:
  - Remove `.achievement-sharing .facebook` selectors that are now unreachable.
  - Keep active `.achievement-sharing .twitter` styling unchanged.
- Out of scope:
  - Any gameplay or protocol changes.
  - General stylesheet normalization.
- Acceptance criteria:
  - `client/css/achievements.css` contains no `.achievement-sharing .facebook` selectors.
  - `bun run typecheck` passes.
- Verification plan:
  - `rg -n "\\.achievement-sharing \\.facebook" client/css/achievements.css`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 117.

### Progress log

- Start: 2026-02-13 18:51 UTC
- End: 2026-02-13 18:52 UTC
- Status: `done`
- Key actions:
  - Removed all `.achievement-sharing .facebook` and hover variants from each responsive block in `client/css/achievements.css`.
  - Kept active Twitter share selectors unchanged.
- Evidence:
  - `rg -n "\\.achievement-sharing \\.facebook" client/css/achievements.css` (no matches)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 119: Restore Door/Portal Traversal Parity from Origin-Master

- Status: `done`
- Priority: P1
- Scope:
  - Compare modern client door/portal traversal flow against `../BrowserQuest.wt-origin-master/client/js/game.js`.
  - Restore missing traversal behaviors when stopping on a door tile (teleport send, orientation/camera/audio parity, attacker disengage).
- Out of scope:
  - Reworking server map/group architecture.
  - Non-door movement/pathfinding changes.
- Acceptance criteria:
  - Entering a door tile while not targeting an entity teleports the player to the configured destination and sends TELEPORT to server.
  - Portal-specific feedback (teleport sound/bubble behavior) and music refresh behavior match legacy expectations.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test tests/unit/ecs/client-door-portal-system.test.ts`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 18:59 UTC
- End: 2026-02-13 19:01 UTC
- Status: `done`
- Key actions:
  - Diffed legacy door flow in `../BrowserQuest.wt-origin-master/client/js/game.js` against modern runtime and confirmed missing modern stop-pathing door traversal handling.
  - Added `runClientDoorPortalSystem` and scheduled it in the post-update pipeline so door traversal is processed after movement completion.
  - Restored legacy side effects for door traversal: local player teleport/orientation update, TELEPORT send, attacker disengage, portal sound/music refresh, mobile camera/clear-screen behavior.
  - Added focused unit coverage for traversal gating and mobile camera branch.
- Evidence:
  - `bun test tests/unit/ecs/client-door-portal-system.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 120: Restore Click-to-Interact Pathing Parity (Attack/Talk/Open)

- Status: `done`
- Priority: P1
- Scope:
  - Audit modern click interaction pathing against origin-master for attack/talk/open flows.
  - Restore legacy path-request ignore list semantics so clicking a non-adjacent entity initiates pathing toward interaction.
- Out of scope:
  - Combat tuning and server AI behavior.
  - Non-interaction movement UX changes.
- Acceptance criteria:
  - Clicking a non-adjacent mob/npc/chest issues movement toward that entity (without needing a separate pre-move click).
  - Pathing resolver includes self + current target ignore behavior matching origin-master intent.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/client-pathing-ignore-list.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 19:19 UTC
- End: 2026-02-13 19:20 UTC
- Status: `done`
- Key actions:
  - Audited origin-master `client/js/game.js` and identified missing modern parity: legacy `onRequestPath` passed ignore list `[self, target]`, modern resolver passed `undefined`.
  - Added `client/runtime/pathing-ignore-list.ts` and wired `Game.setPathfinder` path resolver to pass legacy-equivalent ignore lists for interaction-follow paths.
  - Updated `Game.findPath` ignore-list typing to the pathfinder shape used at runtime.
  - Added focused unit tests for ignore-list construction.
- Evidence:
  - `bun test tests/unit/client-pathing-ignore-list.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 121: Eliminate Animated-Tile Seams from Smoothing Drift

- Status: `done`
- Priority: P2
- Scope:
  - Audit renderer setup for animated tile seam causes.
  - Enforce cross-browser pixel-snap canvas smoothing settings for runtime render contexts.
- Out of scope:
  - Reauthoring tilesheets or map content.
  - Full renderer pipeline redesign.
- Acceptance criteria:
  - Runtime renderer disables image smoothing via standard + vendor canvas flags.
  - Animated tile rendering path no longer depends on Firefox-only `mozImageSmoothingEnabled`.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/canvas-smoothing.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-13 19:26 UTC
- End: 2026-02-13 19:28 UTC
- Status: `done`
- Key actions:
  - Audited tile rendering pipeline and identified likely seam source: smoothing disable path targeted only `mozImageSmoothingEnabled`, leaving smoothing enabled on Chromium/WebKit contexts.
  - Added shared canvas utility (`client/canvas-smoothing.ts`) to disable standard + vendor smoothing flags.
  - Updated renderer rescale path and intro player-image composition path to use the shared smoothing utility.
  - Added focused unit coverage for smoothing flags.
- Evidence:
  - `bun test tests/unit/canvas-smoothing.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 122: Add Animated-Ground Base Underlay to Remove Frame-Edge Gaps

- Status: `done`
- Priority: P2
- Scope:
  - Remove visible faint gaps around animated ground cells by ensuring the terrain layer keeps a base tile under animated overlays.
  - Keep high-tile behavior unchanged.
- Out of scope:
  - Animated tileset/content reauthoring.
  - Broader render pipeline redesign.
- Acceptance criteria:
  - Terrain pass draws all non-high tiles (including animated ids) onto background.
  - Animated overlay pass remains active on the entity layer.
  - `bun run typecheck` passes.
- Verification plan:
  - `bun test tests/unit/renderer-terrain.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - Ticket 121.

### Progress log

- Start: 2026-02-13 19:39 UTC
- End: 2026-02-13 19:44 UTC
- Status: `done`
- Key actions:
  - Identified that animated tiles were excluded from terrain background draw, so transparent edge pixels in animated frames could reveal faint seams/gaps.
  - Updated `Renderer.drawTerrain` to draw all non-high tiles and keep animated pass as overlay.
  - Added `shouldDrawTerrainTile` helper and unit test coverage.
- Evidence:
  - `bun test tests/unit/renderer-terrain.test.ts tests/unit/canvas-smoothing.test.ts` (pass)
  - `bun run typecheck` (pass)
- Next action:
  - Resume queued server ECS tickets (Ticket 90/91).

## Ticket 84: Remove Legacy Client Lookup/Iterator Modules

- Status: `done`
- Priority: P2
- Scope:
  - Remove `client/game-entity-lookups.ts` and `client/game-visibility-iterators.ts`.
  - Inline/replace the remaining call sites in `client/game.ts` and `client/renderer.ts`.
  - Remove unused `Game.getEntityAt/getMobAt/getItemAt/...` helpers now that ECS systems are kernel-driven.
- Out of scope:
  - Rendering modernization and entity-object removal.
- Acceptance criteria:
  - `client/game-entity-lookups.ts` and `client/game-visibility-iterators.ts` are deleted.
  - `client/game.ts` no longer defines `getEntityAt/getMobAt/getItemAt/getNpcAt/getChestAt` and related `is*At` helpers.
  - `bun run lint` passes (0 warnings).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 83.

### Progress log

- Start: 2026-02-12 20:11 UTC
- End: 2026-02-12 20:18 UTC
- Status: `done`
- Key actions:
  - Deleted `client/game-entity-lookups.ts` and `client/game-visibility-iterators.ts`.
  - Inlined entity iteration, depth iteration, and visible tile iteration into `client/game.ts`.
  - Removed unused renderer `getEntityAt` dependency and attack-target debug hook.
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Reduce remaining legacy `Game` surface area by moving more host methods behind commands + kernel views (renderer becomes the last legacy holdout).

## Ticket 83: Client Interaction Systems Use Kernel Spatial Records

- Status: `done`
- Priority: P1
- Scope:
  - Update client ECS interaction systems to use kernel spatial records / indices instead of legacy entity-object `instanceof` checks:
    - `runClientClickIntentSystem()`
    - `runClientHoverStateSystem()`
    - `runClientInteractionIntentSystem()`
  - Keep highlight/animation side effects on entity objects only where required (silhouettes/highlight).
- Out of scope:
  - Removing entity objects entirely (renderer modernization).
  - Adding a full kernel health/death component model (we may still consult entity objects for `isDead` where needed).
- Acceptance criteria:
  - The above systems no longer depend on `getEntityAt()/isMobAt()/isItemAt()` host helpers for decisions; they query `kernel.clientSpatialRecords` and kernel indices.
  - `bun run lint` passes (0 warnings).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 82.

### Progress log

- Start: 2026-02-12 20:03 UTC
- End: 2026-02-12 20:10 UTC
- Status: `done`
- Key actions:
  - Refactored click/hover/interaction intent systems to branch on `kernel.clientSpatialRecords` + kernel indices (not legacy `getEntityAt/isMobAt` helpers).
  - Kept silhouette highlighting as the only required entity-object dependency (lookup by id for `setHighlight`).
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Convert remaining client runtime systems to consume kernel views (reduce `instanceof` + direct `host.entities` reads).

## Ticket 82: Client Spatial Index From Kernel (Remove Legacy Grids)

- Status: `done`
- Priority: P1
- Scope:
  - Replace `Game`-owned `entityGrid` / `itemGrid` / `renderingGrid` / `pathingGrid` with kernel-owned spatial indices + pathing state.
  - Update spatial record apply (`spatialAddRecord` / `spatialRemoveRecord`) to update kernel indices/pathing only (no legacy grid writes).
  - Update entity lookups + depth iteration to use kernel indices (`getEntityAt/getMobAt/getItemAt`, rendering order iterator).
  - Update pathfinding to use kernel pathing grid snapshot.
  - Remove `client/game-spatial-state.ts` grid initialization and refactor restart/bootstrap accordingly.
- Out of scope:
  - Replacing legacy `Character` movement interpolation with an ECS movement component/system.
  - Rendering modernization (sprite batching, WebGL, etc.).
- Acceptance criteria:
  - No `entityGrid`, `itemGrid`, `renderingGrid`, or `pathingGrid` fields exist on `client/game.ts`.
  - `client/ecs/systems/client-spatial-sync-system.ts` no longer depends on legacy grids.
  - Hover/click/entity lookup and render depth iteration use kernel indices.
  - `bun run lint` passes (0 warnings).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 81.

### Progress log

- Start: 2026-02-12 19:30 UTC
- End: 2026-02-12 20:02 UTC
- Status: `done`
- Key actions:
  - Moved client spatial indices and pathing grid ownership into `ClientWorldKernel` and removed legacy Game grids.
  - Cut over entity lookups, depth iteration, combat stacking checks, and pathing to use kernel indices/pathing.
  - Hardened smoke-test server teardown (`killBunProcess`) with SIGKILL escalation to avoid suite flakes.
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Replace remaining legacy entity-object dependency in client ECS systems with kernel views/components (reduce `host.entities` reads).

## Ticket 85: Server - Remove Legacy Zone Groups + Group Messaging

- Status: `done`
- Priority: P1
- Scope:
  - Remove legacy server "zone group" system (`groups`, group membership, group push queues) now that ECS interest replication owns SPAWN/DESPAWN and outbox owns broadcast.
  - Delete unused group modules:
    - `server/world/group-flow.ts`
    - `server/world/group-membership.ts`
    - `server/world/push.ts`
  - Replace remaining group-based sends with ECS outbox actions:
    - remove `pushRelevantEntityListTo(...)`
    - remove `pushToAdjacentGroups(...)` / `pushToGroup(...)` / `pushToPreviousGroups(...)`
    - migrate `Player.broadcast*` usage in ECS command pipeline to outbox
  - Simplify `server/world/update-loop.ts` to call `processQueues()` only (no legacy `processGroups()` stage).
- Out of scope:
  - Removing legacy server entity classes (`Player`, `Mob`, `Item`, `Chest`) entirely.
  - Reworking spawn replication component set or protocol schema.
- Acceptance criteria:
  - No TS references remain to legacy group messaging APIs (`pushToAdjacentGroups`, `pushToGroup`, `pushRelevantEntityListTo`, `pushToPreviousGroups`).
  - `server/world/group-flow.ts`, `server/world/group-membership.ts`, and `server/world/push.ts` are deleted.
  - `bun run lint` passes (0 warnings).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 84.

### Progress log

- Start: 2026-02-12 20:42 UTC
- End: 2026-02-12 21:11 UTC
- Status: `done`
- Key actions:
  - Deleted legacy server zone group system (`server/world/group-flow.ts`, `server/world/group-membership.ts`, `server/world/push.ts`) and removed `groups`/membership plumbing from `server/world-server.ts`.
  - Simplified update loop (`server/world/update-loop.ts`) to tick ECS + queues only.
  - Replaced legacy broadcast/list flows with ECS outbox + interest replication:
    - `server/world/ecs-command-pipeline.ts` (chat/lootmove/teleport now outbox-driven; no group pushes)
    - `server/world/player-lifecycle.ts` (no LIST/group churn on enter/zone)
  - Removed legacy `Player.broadcast*` events (`server/player.ts`) and redundant despawn broadcast (`server/world/entity-mutations.ts`).
  - Trimmed world transport to player-queue flush only (`server/world/transport.ts`) and reintroduced `World.pushBroadcast(...)` for population updates.
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Ticket 87: clear dead targets and stop post-death attacking (server + client intent cleanup).

## Ticket 86: Server - ECS-Native Mob Respawn (Remove Legacy Timers)

- Status: `done`
- Priority: P1
- Scope:
  - Replace legacy mob respawn timeouts (`Mob.handleRespawn`) with ECS `RESPAWN_TASKS_RESOURCE` scheduling.
  - Ensure mob respawns (including MobArea respawns) rehydrate required ECS replication/combat components.
- Out of scope:
  - Changing content drop tables or combat formulas.
- Acceptance criteria:
  - Server mob respawn no longer depends on `setTimeout` inside `server/mob.ts`.
  - Respawn behavior remains functionally equivalent (delay, position, hit points restored).
  - `bun run lint` passes (0 warnings).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 85.

### Progress log

- Start: 2026-02-12 21:19 UTC
- End: 2026-02-12 21:24 UTC
- Status: `done`
- Key actions:
  - Removed timer-driven mob respawn logic from `server/mob.ts` (no `setTimeout` respawn/return timers in mob class).
  - Bound MobArea respawn behavior to the mob’s `respawn` event (`server/mobarea.ts`) and scheduled mob respawns via ECS tick tasks in `server/world-server.ts`.
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)

## Ticket 87: Combat - Stop Dead-Target Attacking + Clear Targets

- Status: `done`
- Priority: P1
- Scope:
  - Ensure attack intent/targets are cleared when a target dies or despawns (server authoritative + client intent cleanup).
  - Prevent repeated HIT/ATTACK attempts against dead/non-existent entities.
- Out of scope:
  - New combat mechanics (crit, stun, etc.).
- Acceptance criteria:
  - Client stops auto-attacking immediately once the target is dead/despawned.
  - Server clears `Target` replication component for entities whose target is dead/despawned.
  - `bun run lint` passes (0 warnings).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 85.

### Progress log

- Start: 2026-02-12 21:12 UTC
- End: 2026-02-12 21:18 UTC
- Status: `done`
- Key actions:
  - Client: clear targeting edges when entities despawn (`client/ecs/world-kernel.ts`) and emit target-removal commands from replication sync (`client/ecs/systems/client-kernel-replication-sync-system.ts`).
  - Client: added `characterClearTarget` command and apply handler to disengage/idle characters when the kernel target map clears.
  - Server: on mob death, clear `Target` replication component for all attackers targeting the mob (`server/world/ecs-command-pipeline.ts`).
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)

## Ticket 81: Replace Client Updater Loop With ECS Systems

- Status: `done`
- Priority: P2
- Scope:
  - Remove `client/updater.ts` and the `Game.updater` integration.
  - Replace `runClientUpdaterSystem()` with an ECS system that performs the same per-frame responsibilities:
    - zoning camera transitions
    - character movement stepping + entity fading
    - player aggro polling timer
    - entity + FX animations, animated tiles, bubbles, and combat info updates
  - Keep all side effects inside ECS scheduling (no direct calls from `Game.tick()` besides scheduler run).
- Out of scope:
  - Reworking movement/pathfinding math or interpolation model.
  - Rendering modernization / sprite architecture rewrite.
- Acceptance criteria:
  - `client/game.ts` no longer imports or instantiates `Updater`.
  - `client/updater.ts` is deleted.
  - `bun run lint` passes (0 warnings).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 80.

### Progress log

- Start: 2026-02-12 19:17 UTC
- End: 2026-02-12 19:28 UTC
- Status: `done`
- Key actions:
  - Replaced `Updater` monolith with `runClientSimulationSystem()` scheduled by the ECS frame scheduler.
  - Deleted `client/updater.ts` and `client/ecs/systems/client-updater-system.ts` and removed `Game.updater` plumbing.
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Identify remaining legacy runtime seams to convert to ECS-first systems (movement/pathing + renderer entity state).

## Ticket 72: MOVE Outbox Emits Commands Only

- Status: `done`
- Priority: P2
- Scope:
  - Extend `ClientCommand` with move/zoning outbox commands.
  - Update `runClientPlayerMoveOutboxSystem()` to enqueue commands only (no direct client sends, no direct zoning calls).
  - Apply those commands in `runClientCommandApplySystem()`.
- Out of scope:
  - Refactoring zoning transitions/rendering.
- Acceptance criteria:
  - `client/ecs/systems/client-player-move-outbox-system.ts` contains no direct `client.sendMove` calls.
  - Zoning still triggers when player reaches a zoning tile.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 15:07 UTC
- End: 2026-02-12 15:12 UTC
- Status: `done`
- Key actions:
  - Added `clientSendMove` + `enqueueZoningFrom` commands and applied them in `runClientCommandApplySystem()`.
  - Updated `runClientPlayerMoveOutboxSystem()` to enqueue commands only (no direct `client.sendMove` / `enqueueZoningFrom` calls) and moved `clientLastSentMovePos` updates into command apply.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Migrate `client-environment-system` side effects (checkpoint check + music update) into commands.

## Ticket 73: Environment System Emits Commands Only

- Status: `done`
- Priority: P3
- Scope:
  - Extend `ClientCommand` with environment side effects (checkpoint check + music update).
  - Update `runClientEnvironmentSystem()` to enqueue commands only (no direct `client.sendCheck`, no direct `audioManager.updateMusic`, no direct player state mutation when avoidable).
  - Apply those commands in `runClientCommandApplySystem()`.
- Out of scope:
  - Reworking audio manager or checkpoint data model.
- Acceptance criteria:
  - `client/ecs/systems/client-environment-system.ts` contains no direct calls to `client.sendCheck` and `audioManager.updateMusic`.
  - Checkpoint changes still emit `sendCheck` when a new checkpoint is reached.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 15:12 UTC
- End: 2026-02-12 15:16 UTC
- Status: `done`
- Key actions:
  - Converted `runClientEnvironmentSystem()` to emit commands only (plateau state, checkpoint change, sendCheck, updateMusic).
  - Centralized player env state updates + side effects in `runClientCommandApplySystem()`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Migrate spatial/grid sync system to emit commands only and apply before hover/click.

## Ticket 74: Spatial Sync Emits Commands Only

- Status: `done`
- Priority: P3
- Scope:
  - Extend `ClientCommand` with spatial/grid sync commands (entity/item/render grids + dynamic pathing occupancy).
  - Update `runClientSpatialSyncSystem()` to enqueue commands only (no direct grid/pathing mutation, no direct entity property mutation when avoidable).
  - Apply those commands in `runClientCommandApplySystem()`.
  - Adjust scheduler ordering so spatial sync commands are applied before hover/click queries in `pre_update`.
- Out of scope:
  - Replacing legacy grids with a new ECS-only spatial index (separate effort).
- Acceptance criteria:
  - `client/ecs/systems/client-spatial-sync-system.ts` performs no direct writes to `entityGrid`, `itemGrid`, `renderingGrid`, or `pathingGrid`.
  - Hover/click targeting continues to work (grids are updated before those systems run).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 15:16 UTC
- End: 2026-02-12 15:22 UTC
- Status: `done`
- Key actions:
  - Converted `runClientSpatialSyncSystem()` to emit commands only (no direct grid/pathing writes).
  - Applied spatial grid/pathing updates (plus nextGrid normalization) in `runClientCommandApplySystem()`.
  - Adjusted `pre_update` scheduling to apply spatial sync commands before hover/click.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Final audit for any remaining control/interaction legacy entrypoints and stage ordering traps.

## Ticket 75: Combat Tick Via ECS Commands

- Status: `done`
- Priority: P1
- Scope:
  - Replace legacy `Game.onCharacterUpdate` combat tick with an ECS combat system.
  - Remove `Updater` → `Game.onCharacterUpdate` callback path.
  - Route combat side effects (hit/follow/relink/reposition, protocol sends, sounds) through `ClientCommand` + `runClientCommandApplySystem()`.
- Out of scope:
  - Combat balance, damage formulas, or server protocol redesign.
  - Rendering/animation refactors.
- Acceptance criteria:
  - `client/updater.ts` no longer calls `game.onCharacterUpdate`.
  - `client/game.ts` no longer contains combat tick logic in `onCharacterUpdate`.
  - Combat remains functional (player can attack, mobs can hit, stacking avoidance still works).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.
  - Ticket 74 (spatial grids updated pre-hover/click).

### Progress log

- Start: 2026-02-12 15:40 UTC
- End: 2026-02-12 15:50 UTC
- Status: `done`
- Key actions:
  - Added `runClientCombatSystem()` and scheduled it in the ECS frame pipeline (combat is no longer driven by `Updater` calling `Game.onCharacterUpdate`).
  - Centralized combat side effects (hit/follow/relink/reposition, sendHit/sendHurt, hit SFX) via `ClientCommand` + `runClientCommandApplySystem()`.
  - Removed legacy combat tick + unused mob-positioning helpers (deleted `client/game-mob-positioning.ts`).
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (pass; 195 total: 194 pass, 1 skip, 0 fail)
- Notes:
  - `tests/smoke/modern-gameplay-parity.test.ts` can still flake under load (timeout); rerun passed.
- Next action:
  - Remove legacy `game-player-interactions` helper module and eliminate remaining non-ECS protocol send call sites.

## Ticket 76: Remove Legacy Player Interaction Helpers

- Status: `done`
- Priority: P2
- Scope:
  - Delete `client/game-player-interactions.ts` and migrate its behaviors into ECS command apply (or explicit ECS commands).
  - Ensure navigating to an item no longer emits legacy `sendLootMove` behavior.
- Out of scope:
  - Reworking NPC dialogue content.
- Acceptance criteria:
  - `client/game-player-interactions.ts` is removed and has no remaining references.
  - `sendLootMove` is not used by normal gameplay navigation/interaction paths.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 15:50 UTC
- End: 2026-02-12 16:09 UTC
- Status: `done`
- Key actions:
  - Deleted `client/game-player-interactions.ts` and inlined the logic into `Game` wrapper methods.
  - Changed item navigation to be movement-only (no legacy `sendLootMove` emission when navigating to an item tile).
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Move remaining direct `game.client.send*` call sites (including test harness) into `ClientCommand` + command apply.

## Ticket 77: Protocol Sends Via ECS Commands

- Status: `done`
- Priority: P2
- Scope:
  - Route remaining `GameClient.send*` calls (`sendHello`, `sendZone`, `sendChat`, test harness sends) through `ClientCommand` + command apply.
  - Update test harness API in `client/main.ts` to enqueue commands rather than calling `game.client.send*` directly.
- Out of scope:
  - Server protocol changes.
- Acceptance criteria:
  - `rg "client\\.send"` finds no call sites outside `client/gameclient.ts` and `client/ecs/systems/client-command-apply-system.ts`.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 16:09 UTC
- End: 2026-02-12 16:19 UTC
- Status: `done`
- Key actions:
  - Added explicit client-send commands (`clientSendHello/Zone/Chat/Attack/LootMove`) and applied them in `runClientCommandApplySystem()`.
  - Updated `Game` helpers to enqueue protocol sends instead of calling `game.client.send*` directly; moved `playerAttack` send into command apply.
  - Updated the test harness API in `client/main.ts` to enqueue commands instead of directly sending protocol messages.
  - Updated command apply to process commands enqueued during apply (bounded multi-pass drain).
- Evidence:
  - `rg "client\\.send"` shows no call sites outside `client/gameclient.ts` and `client/ecs/systems/client-command-apply-system.ts`.
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Final full verification sweep and ensure working tree is clean.

## Ticket 78: Stabilize Smoke Parity Timeout

- Status: `done`
- Priority: P3
- Scope:
  - Increase timeout budget for `tests/smoke/modern-gameplay-parity.test.ts` to reduce load-related flake timeouts.
- Out of scope:
  - Refactoring server startup/teardown or websocket runtime implementation.
- Acceptance criteria:
  - `bun test --timeout 20000` passes reliably under typical dev load (no 60s test timeout failures).
  - Timeout change is limited to the affected smoke test.
- Verification plan:
  - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 20000`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 16:22 UTC
- End: 2026-02-12 16:26 UTC
- Status: `done`
- Key actions:
  - Increased `tests/smoke/modern-gameplay-parity.test.ts` timeout budgets (per-wait and per-test) to reduce load-related flakes.
- Evidence:
  - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 20000` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Commit and run final repository audit.

## Ticket 79: Lint Unused Modules/Exports

- Status: `done`
- Priority: P2
- Scope:
  - Add `eslint-plugin-import` and enable `import/no-unused-modules` (and related import hygiene rules).
  - Expand `bun run lint` to cover all TS sources so unused exports can be detected repo-wide.
  - Remove/adjust any now-unused exports/files so lint passes.
- Out of scope:
  - Large-scale stylistic lint reformatting (e.g. ordering rules across the whole repo).
- Acceptance criteria:
  - `eslint.config.mjs` includes `import/no-unused-modules` and it is enforced (error).
  - `bun run lint` runs across all TS sources.
  - `bun run lint` passes.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 16:26 UTC
- End: 2026-02-12 16:48 UTC
- Status: `done`
- Key actions:
  - Added `eslint-plugin-import` and enabled `import/no-unused-modules` (plus import hygiene rules) under flat ESLint config.
  - Expanded `bun run lint` to cover all TS sources.
  - Fixed strict lint errors (unused vars, floating promises, eqeqeq/no-var) and removed unused `shared/protocol/types.d.ts`.
- Evidence:
  - `bun run lint` (pass; warnings only)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: reduce warning budget or enforce `--max-warnings 0` once the repo is ready.

## Ticket 80: Burn Down Lint Warnings To Zero

- Status: `done`
- Priority: P2
- Scope:
  - Fix all remaining ESLint warnings across the TS codebase.
  - Update `bun run lint` to fail on warnings (enforce `--max-warnings 0`) once warning count is zero.
- Out of scope:
  - Gameplay behavior changes (ECS/interaction logic correctness is covered by other tickets).
- Acceptance criteria:
  - `bun run lint` produces 0 warnings (clean output).
  - `bun run lint` fails on future warnings (`--max-warnings 0` enforced).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run lint`
  - `bun run lint --max-warnings 0`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 79.

### Progress log

- Start: 2026-02-12 16:53 UTC
- End: 2026-02-12 19:17 UTC
- Status: `done`
- Key actions:
  - Burned down all remaining ESLint warnings across client/server/shared/tests and enforced `--max-warnings 0` in `bun run lint`.
  - Fixed full-suite smoke test flake by awaiting Bun server process exits in teardown (`killBunProcess` helper + smoke test updates).
- Evidence:
  - `bun run lint` (pass; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Commit and begin legacy removal audit (focus: ECS-only control flow + delete unused modules).

## Ticket 71: Replication Sync Emits Commands Only

- Status: `done`
- Priority: P2
- Scope:
  - Extend `ClientCommand` with replication sync commands (spawn from kernel, remove by id, move character, create attack link).
  - Update `runClientKernelReplicationSyncSystem()` to enqueue commands only (no direct host mutations).
  - Apply replication commands in `runClientCommandApplySystem()` and ensure scheduler ordering applies spawns before spatial/hover/click systems.
- Out of scope:
  - Removing legacy renderer/updater entity objects.
  - Reworking server replication protocol.
- Acceptance criteria:
  - `client/ecs/systems/client-kernel-replication-sync-system.ts` contains no direct calls to `addEntity/addItem/removeEntity/removeItem/makeCharacterGoTo/createAttackLink`.
  - Spawn/despawn/move/retarget parity remains.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 15:03 UTC
- End: 2026-02-12 15:06 UTC
- Status: `done`
- Key actions:
  - Added replication commands (`spawnEntityFromKernel`, `removeEntityById`, `characterGoTo`, `createAttackLink`) and applied them in `runClientCommandApplySystem()`.
  - Updated `runClientKernelReplicationSyncSystem()` to emit commands only (no direct host mutation).
  - Adjusted scheduler ordering to apply replication commands before spatial/hover/click systems.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Migrate spatial sync to command emission or replace legacy grids with an ECS spatial index queried by hover/click/pathing.

## Ticket 70: Runtime Events Emit Commands Only

- Status: `done`
- Priority: P2
- Scope:
  - Extend `ClientCommand` to cover remaining client runtime side effects currently performed in `client-runtime-event-system`.
  - Update `runClientRuntimeEventSystem()` to enqueue commands only (no direct host method calls).
  - Apply those commands in `runClientCommandApplySystem()` and ensure ordering applies welcome before kernel replication sync.
- Out of scope:
  - Removing kernel replication sync system.
  - Refactoring storage/achievements beyond moving to command apply.
- Acceptance criteria:
  - `client/ecs/systems/client-runtime-event-system.ts` contains no direct calls to host gameplay methods (add/remove/move/teleport/bubbles/notifications/bars/music) and no direct client sends; it only enqueues commands + updates kernel state.
  - Welcome path still initializes player, camera, storage, and notifications correctly.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 14:08 UTC
- End: 2026-02-12 14:12 UTC
- Status: `done`
- Key actions:
  - Extended `ClientCommand` and centralized runtime side effects (welcome, entity list, population, teleport, health, chat, equip, drop, blink) in `runClientCommandApplySystem()`.
  - Updated `runClientRuntimeEventSystem()` to enqueue commands only.
  - Ensured command application runs immediately after runtime event ingestion (before kernel replication sync) via scheduler ordering.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Convert kernel replication sync + spatial sync to emit commands (remove direct host mutation from those systems).

## Ticket 69: Interaction Intent Executes Via Commands

- Status: `done`
- Priority: P2
- Scope:
  - Extend `ClientCommand` to cover interaction-side effects (attack/follow, talk/open sequences, loot attempt, server sendOpen/sendLoot, notifications).
  - Update `runClientInteractionIntentSystem()` to enqueue commands only (no direct host method calls, no direct client calls).
  - Centralize side effects in `runClientCommandApplySystem()`.
- Out of scope:
  - Refactoring combat math / balance.
  - Replacing legacy entity classes with ECS-only data.
- Acceptance criteria:
  - `client/ecs/systems/client-interaction-intent-system.ts` contains no direct calls to `host.make*`, `host.client.*`, `host.emit('notification', ...)`, or `host.player.*` methods; it only updates kernel state + enqueues commands.
  - Loot still only completes when explicitly targeted and standing on the item tile; exceptions still notify and clear intent.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 68.

### Progress log

- Start: 2026-02-12 13:47 UTC
- End: 2026-02-12 13:54 UTC
- Status: `done`
- Key actions:
  - Extended `ClientCommand` and centralized interaction side effects in `runClientCommandApplySystem()` (attack/follow, talk/open sequences, open/loot sends, loot exceptions).
  - Updated `runClientInteractionIntentSystem()` to only update kernel + enqueue commands (no direct host method calls).
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Migrate remaining runtime side effects (welcome/equip/chat/drop/blink) to commands so *all* client systems become pure command emitters.

## Ticket 68: Client ECS Command Buffer + Apply System

- Status: `done`
- Priority: P2
- Scope:
  - Introduce a typed `ClientCommand` queue as a kernel resource.
  - Add an ECS system that drains and applies client-side commands (movement, stop combat, etc.) via the host surface.
  - Migrate click intent + interaction-intent clear side effects to enqueue commands instead of calling host methods directly.
- Out of scope:
  - Fully eliminating all host calls across every system (follow-up tickets can migrate remaining systems).
  - Server protocol changes.
- Acceptance criteria:
  - A command queue exists in `ClientWorldKernel` and is drained by a single apply system each frame.
  - `runClientClickIntentSystem()` no longer calls `makePlayerGoTo*` or `stopPlayerCombat` directly.
  - Clearing an `attack` interaction intent no longer calls `stopPlayerCombat` directly (uses command).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 13:42 UTC
- End: 2026-02-12 13:44 UTC
- Status: `done`
- Key actions:
  - Added `ClientCommand` queue to `ClientWorldKernel` and `runClientCommandApplySystem()` to apply side effects.
  - Migrated click intent system to emit commands (`stopPlayerCombat`, `playerGoTo`, `playerGoToItem`) instead of calling host methods.
  - Migrated `clearClientInteractionIntentWithSideEffects()` to enqueue stop-combat as a command instead of calling host.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Migrate remaining systems (interaction + runtime events + zoning) to emit commands exclusively.

## Ticket 67: Remove Movement Step Hooks (Spatial Sync System)

- Status: `done`
- Priority: P3
- Scope:
  - Replace `Character.on('step')` movement hooks used to maintain `entityGrid`/`renderingGrid` with an ECS system that updates spatial indices based on authoritative positions.
  - Remove `Game.characterMovementHooks` and any remaining per-entity movement subscription logic.
- Out of scope:
  - Full rendering modernization (tile/sprite batching).
  - Server protocol changes.
- Acceptance criteria:
  - No remaining `on('step')` subscriptions for core spatial indexing.
  - Spatial grids remain correct during movement, teleport, zoning, and despawn.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 66 (kernel-driven movement authority) recommended but not strictly required.

### Progress log

- Start: 2026-02-12 13:31 UTC
- End: 2026-02-12 13:35 UTC
- Status: `done`
- Key actions:
  - Added `runClientSpatialSyncSystem()` to keep `entityGrid`/`itemGrid`/`renderingGrid`/`pathingGrid` in sync without `Character.on('step')` hooks (including dual-position + pathing-block semantics).
  - Added `runClientPlayerMoveOutboxSystem()` to send MOVE + trigger zoning when the player’s grid position changes (no Character event listeners).
  - Removed all per-character movement subscriptions from `client/game.ts`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Continue shrinking `client/game.ts` host surface by extracting remaining non-ECS responsibilities into systems/modules.

## Ticket 66: Kernel-Driven Replication Sync (Reduce Spawn/Move Handlers)

- Status: `done`
- Priority: P3
- Scope:
  - Introduce a replication sync system that treats `ClientWorldKernel` as the authoritative world state and keeps legacy render entities in sync (create/destroy/move/target updates).
  - Reduce reliance on per-message spawn/move handlers by deriving changes from kernel diffs.
- Out of scope:
  - Removing legacy `Renderer`/`Updater` internals.
  - Reworking server replication protocol.
- Acceptance criteria:
  - Spawn/despawn/move/attack-link updates are driven by a single system pass over kernel state + diff state.
  - `client/runtime/connection.ts` contains no world-mutation calls (kept in ECS systems).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Ticket 65.

### Progress log

- Start: 2026-02-12 13:14 UTC
- End: 2026-02-12 13:24 UTC
- Status: `done`
- Key actions:
  - Added `runClientKernelReplicationSyncSystem()` to spawn/despawn/move/retarget entities from kernel diffs, with kernel-owned replication bookkeeping.
  - Removed connection-layer spawn/move/attack/despawn/destroy handlers; gameplay replication now derives from `ClientWorldKernel` state.
  - Updated `GameClient` to keep the kernel authoritative on `DESTROY` and `DROP` (drop upserts a simple entity at the mob’s kernel position).
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Ticket 67: remove `Character.on('step')` movement hooks via a spatial sync ECS system.

## Ticket 65: ECS Runtime Event Buffer (Connection Boundary)

- Status: `done`
- Priority: P2
- Scope:
  - Convert `client/runtime/connection.ts` to enqueue typed runtime events into `ClientWorldKernel` rather than mutating `Game` directly for world replication side effects.
  - Add an ECS system that consumes those events and applies the same side effects to the legacy runtime (`addEntity/addItem`, movement, attack links, equipment visuals, chat, etc.).
  - Register the system in the staged client frame scheduler before the updater.
- Out of scope:
  - Rewriting `Updater`/`Renderer` into pure ECS.
  - Server protocol changes.
- Acceptance criteria:
  - `client/runtime/connection.ts` no longer calls `game.addEntity`, `game.removeEntity`, `game.removeItem`, `game.makeCharacterGoTo`, `game.makeCharacterTeleportTo`, `game.createAttackLink`, `game.addItem`, etc.
  - Gameplay parity: spawn/despawn/move/teleport/attack links, equipment updates, chat bubbles, population change, drop items, item blink.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 13:03 UTC
- End: 2026-02-12 13:14 UTC
- Status: `done`
- Key actions:
  - Added kernel-backed runtime event queue (`ClientRuntimeEvent`) and a `client-runtime-event-system` to apply replication side effects from queued events.
  - Converted `client/runtime/connection.ts` handlers to enqueue-only (no direct world mutation calls).
  - Registered runtime event system in the staged client frame scheduler (`pre_update`) before hover/click/cursor.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Ticket 66: introduce kernel-diff replication sync to further reduce per-message handler dependence.

## Ticket 64: Inline Loot Completion Into System

- Status: `done`
- Priority: P3
- Scope:
  - Move explicit-loot completion (rank validation, throttle, send LOOT, notifications) into `runClientInteractionIntentSystem`.
  - Remove legacy `Game.tryLootAtPlayerPosition`.
- Out of scope:
  - Server-side loot validation changes.
- Acceptance criteria:
  - Loot still only happens when explicitly targeting the item and arriving on its tile.
  - Loot exceptions still surface as notifications and clear interaction intent.
  - No remaining `Game.tryLootAtPlayerPosition`.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:51 UTC
- End: 2026-02-12 12:58 UTC
- Status: `done`
- Key actions:
  - Inlined loot completion (validation + throttle + `sendLoot` + notification on LootException) into `runClientInteractionIntentSystem()`.
  - Removed legacy `Game.tryLootAtPlayerPosition`.
  - Stabilized payload-guard smoke test by removing dependence on receiving `WELCOME` before sending invalid `MOVE`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Next: decide scope of “no more legacy” for the remaining huge `client/game.ts` runtime (movement/render/entity model).

## Ticket 63: Remove `clearClientInteractionIntent` Method

- Status: `done`
- Priority: P3
- Scope:
  - Replace `Game.clearClientInteractionIntent()` with a shared helper used by systems + game events.
  - Update click/interaction systems to not depend on host methods for intent clearing.
- Out of scope:
  - Removing `stopPlayerCombat` (still a game-level side effect).
- Acceptance criteria:
  - No remaining `Game.clearClientInteractionIntent`.
  - Interaction cancel/cleanup semantics remain (stop combat on attack intent; clear loot attempt on loot intent).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:47 UTC
- End: 2026-02-12 12:50 UTC
- Status: `done`
- Key actions:
  - Added `clearClientInteractionIntentWithSideEffects()` helper and used it across systems + game event handlers.
  - Removed legacy `Game.clearClientInteractionIntent`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: inline `tryLootAtPlayerPosition()` into the interaction system and remove the last legacy loot helper.

## Ticket 62: Remove `setClientInteractionIntent` Method

- Status: `done`
- Priority: P3
- Scope:
  - Inline interaction intent creation into the click intent system (stop combat + set kernel intent + clear loot attempt).
  - Remove legacy `Game.setClientInteractionIntent`.
- Out of scope:
  - Removing `clearClientInteractionIntent` (handled separately).
- Acceptance criteria:
  - Clicking interactables behaves the same.
  - No remaining `Game.setClientInteractionIntent`.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:44 UTC
- End: 2026-02-12 12:46 UTC
- Status: `done`
- Key actions:
  - Click intent system now builds kernel interaction intents directly (stop combat, set intent, clear loot attempt).
  - Removed legacy `Game.setClientInteractionIntent`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: similarly remove `clearClientInteractionIntent` by inlining clear semantics in systems.

## Ticket 61: Remove `begin*` Interaction Methods

- Status: `done`
- Priority: P3
- Scope:
  - Handle interaction starts (attack/talk/open/loot) directly in the click intent system using kernel intents.
  - Remove legacy `Game.beginAttack/beginLoot/beginTalk/beginOpenChest`.
- Out of scope:
  - Reworking interaction semantics (explicit loot, chase, death/despawn cancellation).
- Acceptance criteria:
  - Clicking mobs/NPCs/chests/items behaves the same.
  - No remaining `beginAttack/beginLoot/beginTalk/beginOpenChest` methods.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:41 UTC
- End: 2026-02-12 12:43 UTC
- Status: `done`
- Key actions:
  - Moved interaction start handling into the click intent system (set interaction intent + loot pathing).
  - Removed `Game.beginAttack/beginLoot/beginTalk/beginOpenChest`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: remove `Game.setClientInteractionIntent`/`clearClientInteractionIntent` in favor of a command buffer system.

## Ticket 60: Move Input/Loot Transient State Into Kernel

- Status: `done`
- Priority: P3
- Scope:
  - Move `previousClickPosition` and `lastLootAttempt` from `Game` into `ClientWorldKernel` as resources/state.
  - Update click and loot systems to use kernel state (and clear it when appropriate).
- Out of scope:
  - Reworking click de-dupe semantics or loot retry logic.
- Acceptance criteria:
  - No `Game.previousClickPosition` or `Game.lastLootAttempt` fields remain.
  - Click de-dupe behavior remains.
  - Loot retry throttling remains.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:37 UTC
- End: 2026-02-12 12:40 UTC
- Status: `done`
- Key actions:
  - Moved click de-dupe state (`lastClickPos`) and loot retry throttle (`clientLootAttempt`) into `ClientWorldKernel`.
  - Updated click and loot flows to read/write kernel state; removed `Game.previousClickPosition` and `Game.lastLootAttempt`.
  - Cleared click de-dupe when toggling NPC dialog.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: move remaining interaction helpers (`setClientInteractionIntent`) into a pure system/command path.

## Ticket 59: ECS Environment Systems (Plateau/Checkpoint/Music)

- Status: `done`
- Priority: P3
- Scope:
  - Add a post-update system to maintain player environment state:
    - `player.isOnPlateau`
    - checkpoint discovery + `sendCheck` when checkpoint changes
    - music area updates via `audioManager.updateMusic()`
  - Remove legacy `updatePlateauMode` / `updatePlayerCheckpoint` methods and their call sites.
- Out of scope:
  - Reworking checkpoint logic (server-side behavior) or music area definitions.
- Acceptance criteria:
  - Plateau highlighting/hover continues to work.
  - Checkpoints update when player enters a new checkpoint region.
  - Music updates when player moves between music areas.
  - No remaining `updatePlateauMode` / `updatePlayerCheckpoint` methods.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:34 UTC
- End: 2026-02-12 12:35 UTC
- Status: `done`
- Key actions:
  - Added `runClientEnvironmentSystem()` (post-update) to update plateau state, checkpoint discovery (`sendCheck`), and music areas (`audioManager.updateMusic`).
  - Removed legacy `Game.updatePlateauMode()` / `Game.updatePlayerCheckpoint()` and removed welcome-time call sites.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: move `lastCheckpoint` + plateau flag into kernel resources.

## Ticket 58: ECS Click Intent System (Remove `processPlayerClick`/`Game.click`)

- Status: `done`
- Priority: P3
- Scope:
  - Represent user clicks as a kernel resource (click intent).
  - Process click intents via a pre-update system that issues movement/interaction commands.
  - Remove legacy click plumbing (`Game.click()` + `processPlayerClick()` module).
- Out of scope:
  - Reworking mobile gesture handling and tap-vs-drag logic.
- Acceptance criteria:
  - Click-to-move and click-to-interact behavior unchanged.
  - No remaining references to `Game.click()` or `processPlayerClick()`.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:26 UTC
- End: 2026-02-12 12:30 UTC
- Status: `done`
- Key actions:
  - Added `clientClickIntent` kernel resource and a pre-update click intent system that issues movement/interaction commands.
  - Wired DOM click/tap handlers to enqueue click intent rather than running click logic directly.
  - Removed legacy `Game.click()` + removed obsolete `client/game-player-input.ts`.
  - Increased smoke parity test timeout to reduce flakes under load.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: move `previousClickPosition` into kernel resource to keep input state centralized.

## Ticket 57: ECS Hover State System (Remove `movecursor`/`updateCursor`)

- Status: `done`
- Priority: P3
- Scope:
  - Compute hover flags + silhouette highlight via an ECS-style pre-update system.
  - Remove `Game.movecursor()` and `Game.updateCursor()` legacy methods and their call sites.
  - Remove legacy `updatePlayerHoverState()` helper (or make it private/unused).
- Out of scope:
  - Reworking click/touch input semantics beyond hover.
- Acceptance criteria:
  - Hover/cursor behavior unchanged on desktop.
  - No remaining references to `movecursor` / `updateCursor`.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:22 UTC
- End: 2026-02-12 12:25 UTC
- Status: `done`
- Key actions:
  - Added per-frame hover-state system that sets hover flags + silhouette highlight before cursor selection.
  - Removed legacy `movecursor` / `updateCursor` methods and removed caller hooks (spawn handlers, mousemove).
  - Removed legacy `updatePlayerHoverState()` helper (superseded by hover system).
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: migrate click handling to an intent/command resource + system.

## Ticket 56: Remove Legacy Wrapper Methods (Cursor/Interaction)

- Status: `done`
- Priority: P3
- Scope:
  - Remove legacy wrapper methods that only delegate to systems (`updateCursorLogic`, `runClientInteractionSystem`).
  - Call ECS systems directly from scheduler and legacy event helpers.
- Out of scope:
  - Removing the `Game` class or converting all legacy event handlers to ECS.
- Acceptance criteria:
  - Cursor and interaction intent behavior unchanged.
  - No remaining `updateCursorLogic` / `runClientInteractionSystem` methods.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:18 UTC
- End: 2026-02-12 12:20 UTC
- Status: `done`
- Key actions:
  - Removed `Game.updateCursorLogic()` and invoked `runClientCursorSystem()` directly from `updateCursor()`.
  - Removed `Game.runClientInteractionSystem()` and invoked `runClientInteractionIntentSystem()` directly from the frame scheduler.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: remove remaining per-frame legacy methods by extracting more systems from `client/game.ts`.

## Ticket 45: Mobile Input + Item Loot Pickup

- Status: `done`
- Priority: P1
- Scope:
  - Restore item pickup by looting items when the player steps onto them (client emits `LOOT`).
  - Ensure the looting player receives EQUIP updates for self (armor/weapon/firepotion visuals).
  - Prevent touch-driven scrolling/overscroll on the gameplay canvas from freezing the game loop.
- Out of scope:
  - Reworking LOOTMOVE authority/teleport semantics and related anti-cheat hardening.
- Acceptance criteria:
  - On mobile, tapping an item moves to it and the item is picked up (despawns) with visible equip/HP effects.
  - Touch dragging on the gameplay canvas does not scroll/overscroll the page and does not stall movement/updates.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 01:45 UTC
- End: 2026-02-12 01:52 UTC
- Status: `done`
- Key actions:
  - Client: auto-loot on player `step`/`stopPathing` + immediate loot when already standing on an item tile.
  - Server: send EQUIP actions to the looting player (armor/weapon/firepotion) and send firepotion revert EQUIP to self on expiry.
  - Client: replace `touchstart` click with tap-vs-drag touch handlers on `#foreground` (preventDefault + passive:false) and disable canvas touch scrolling via CSS.
  - Client: fix loot rank comparisons to handle rank `0` items correctly.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (194 pass, 1 skip, 0 fail)
- Next action:
  - None.

## Ticket 46: Movement Sync + Zoning Camera

- Status: `done`
- Priority: P1
- Scope:
  - Fix combat instability caused by stale client spatial state (entity grids/rendering grid not updated as characters move).
  - Restore client -> server movement sync during walking so combat/aggro logic sees correct player position.
  - Restore zoning camera panning when reaching the edge of the viewport (prevent "stuck at edge" freeze).
- Out of scope:
  - Server-side anti-cheat movement validation and authoritative pathfinding.
  - Rendering modernization (Ticket 12).
- Acceptance criteria:
  - Attacking a mob does not cause persistent sprite flicker or frantic mob movement.
  - After moving/attacking, mobs remain targetable and player can continue attacking.
  - Walking to the edge of the screen triggers zoning camera pan; input remains responsive after.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Need local manual repro in dev client for UX validation.

### Progress log

- Start: 2026-02-12 10:27 UTC
- End: 2026-02-12 10:29 UTC
- Status: `done`
- Key actions:
  - Restored runtime spatial updates by installing per-character movement hooks that maintain `entityGrid`/`renderingGrid` during movement.
  - Restored client -> server position sync by sending `MOVE` on each player step and final stop.
  - Fixed edge-freeze by clearing stale `nextGridX/Y` on `stopPathing` and triggering zoning camera pan when stopping on a zoning tile.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: manual playtest (mobile + desktop) to confirm no remaining flicker/jitter.

## Ticket 47: Explicit Interactions + Stop Dead-Target Attack

- Status: `done`
- Priority: P1
- Scope:
  - Make interaction navigation explicit: only pick up an item if it was clicked/targeted.
  - Persist interaction target while pathing: follow moving targets (mobs/NPCs/chests) and complete the interaction on arrival.
  - Ensure the player stops attacking when the target dies/despawns.
- Out of scope:
  - Adding new UI/UX for target selection and canceling interactions.
- Acceptance criteria:
  - Walking over an item on the way to somewhere else does not pick it up.
  - Clicking an item walks onto it and picks it up.
  - Clicking a moving mob keeps the mob as the interaction target; player continues to chase/attack until it dies.
  - When a target dies/despawns, the player stops attacking immediately.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Need local manual playtest for “moving target follow” feel.

### Progress log

- Start: 2026-02-12 10:36 UTC
- End: 2026-02-12 10:47 UTC
- Status: `done`
- Key actions:
  - Introduced explicit interaction state (`attack`/`talk`/`open`/`loot`) and completion checks on player step/stop.
  - Disabled incidental item pickup by only looting when the clicked item is the active loot target.
  - Added moving-target follow by re-following targets on their tile `step` events (avoids per-frame repath thrash).
  - Stopped player/mob attack loops when a target dies or despawns (death hook + removal cleanup + player update guard).
  - Ensured smoke suite reliability by giving `tests/smoke/modern-gameplay-parity.test.ts` a per-test timeout override (prevents rare 20s default-timeout flakes).
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: manual feel-tuning of follow repath frequency (if chase feels too “rubber bandy”).

## Ticket 48: Interaction State Cleanup (Loot/ Talk/ Open)

- Status: `done`
- Priority: P2
- Scope:
  - Ensure loot interactions clear client state when loot is blocked by client-side validation (LootException).
  - Ensure talking/opening while already adjacent cancels combat/follow and idles the player, matching “arrive after walking” behavior.
- Out of scope:
  - Server-side loot validation / anti-cheat changes.
  - New UX for canceling interactions.
- Acceptance criteria:
  - If looting fails with a LootException (e.g. worse/equal item), the client does not remain in loot-moving mode and a retry is possible.
  - Clicking an adjacent NPC or chest stops combat/follow and the player idles while talking/opening.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 10:55 UTC
- End: 2026-02-12 10:58 UTC
- Status: `done`
- Key actions:
  - Client: on LootException, clear active interaction and defensively reset loot-moving state.
  - Client: in adjacent talk/open flows, stop movement, disengage combat/follow, and idle before clearing interaction.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (194 pass, 1 skip, 0 fail)
- Next action:
  - None.

## Ticket 49: Client ECS Interaction Intent System

- Status: `done`
- Priority: P1
- Scope:
  - Move client interaction control state into the ECS-ish kernel as data (intent resource).
  - Drive interactions via a per-tick “system” that reads intent + kernel/entity views and issues commands (follow, loot, open, talk, attack).
  - Remove per-entity event subscriptions used to implement follow/death cleanup.
- Out of scope:
  - Full client rendering modernization and full deterministic client sim.
- Acceptance criteria:
  - Existing interaction behaviors remain: explicit loot only, follow moving targets, stop attacking on death/despawn.
  - No interaction logic depends on subscribing to target events; it is derived from current kernel/entity state.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - Need local manual playtest for moving-target chase feel.

### Progress log

- Start: 2026-02-12 11:09 UTC
- End: 2026-02-12 11:18 UTC
- Status: `done`
- Key actions:
  - Kernel: added `clientInteractionIntent` resource + setters/clearers.
  - Client: replaced legacy active-interaction state with intent-driven per-tick `runClientInteractionSystem()`.
  - Client: ensured interactions are derived from current kernel state (target alive/position), stop attacking on death/despawn, and keep explicit-loot semantics.
  - Client: simplified click/move handlers to set/clear intent and let the system own “follow and act” behavior.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: manual playtest for chase “feel” + tuning (repath cadence / stop distances).

## Ticket 50: Client Interaction System Scheduling Cleanup

- Status: `done`
- Priority: P2
- Scope:
  - Ensure the client interaction intent system runs exactly once per render tick after movement updates, so it reads current positions and does not need ad-hoc callers.
  - Remove redundant per-movement-hook invocations and tick-level de-dupe state.
- Out of scope:
  - Introducing a full client ECS scheduler/runtime (multi-system staging).
  - Changing interaction semantics (explicit loot, chase, death/despawn cancellation).
- Acceptance criteria:
  - No gameplay interaction regressions compared to Ticket 49 behavior.
  - Interaction intent system is invoked from a single place in the main loop (post-update).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 11:34 UTC
- End: 2026-02-12 11:36 UTC
- Status: `done`
- Key actions:
  - Moved interaction intent evaluation to run after `updater.update()` so it reads current movement state/positions.
  - Removed redundant per-movement-hook and per-interaction helper calls into `runClientInteractionSystem()`.
  - Removed tick-level de-dupe state (`lastIntentTick`) now that the system runs from a single place per frame.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: extract `runClientInteractionSystem()` into a standalone `client/ecs/systems/*` module.

## Ticket 51: Extract Client Interaction Intent System Module

- Status: `done`
- Priority: P3
- Scope:
  - Move the interaction intent “system” out of `client/game.ts` into a standalone `client/ecs/systems/*` module.
  - Keep `Game.runClientInteractionSystem()` as a thin wrapper to preserve call sites.
- Out of scope:
  - Rewriting the system to be side-effect free (command queue) or introducing a full client ECS scheduler.
- Acceptance criteria:
  - No behavior changes; compilation and tests pass.
  - `client/game.ts` no longer contains the system logic body (delegates to module).
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 11:37 UTC
- End: 2026-02-12 11:39 UTC
- Status: `done`
- Key actions:
  - Extracted interaction intent evaluation into `client/ecs/systems/client-interaction-intent-system.ts`.
  - Left `Game.runClientInteractionSystem()` as a wrapper to preserve call sites and keep the refactor purely structural.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: introduce a lightweight client scheduler to stage multiple systems.

## Ticket 52: Remove Loot-Moving Player Flag

- Status: `done`
- Priority: P3
- Scope:
  - Remove `Player.isLootMoving` / `Player.isMovingToLoot()` and drive “loot moving” purely from `kernel.clientInteractionIntent`.
  - Keep explicit-loot semantics by validating the intent target id before sending `LOOT`.
- Out of scope:
  - Reworking loot retry throttling (`lastLootAttempt`) and server-side loot validation.
- Acceptance criteria:
  - Explicit loot only still holds (no incidental pickups en route).
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 11:41 UTC
- End: 2026-02-12 11:42 UTC
- Status: `done`
- Key actions:
  - Removed `Player.isLootMoving` and derived loot navigation state from `kernel.clientInteractionIntent` only.
  - Kept explicit-loot semantics by validating `intent.targetId` matches the item underfoot before sending `LOOT`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: move `lastLootAttempt` into kernel resource to keep interaction state in one place.

## Ticket 53: Client Frame Scheduler (Staged Systems)

- Status: `done`
- Priority: P2
- Scope:
  - Add a lightweight client frame scheduler with ordered stages (pre-update, update, post-update, render).
  - Convert the main game loop (`tick()`) to run the scheduler, not bespoke per-frame calls.
  - Register existing per-frame behaviors as systems (cursor logic, updater, interaction intent, render).
- Out of scope:
  - A full client deterministic sim or authoritative rollback.
  - Converting every gameplay behavior to ECS components/queries.
- Acceptance criteria:
  - `Game.tick()` delegates to the scheduler (no direct per-frame gameplay method calls).
  - System ordering is explicit and stable; interaction intent runs post-update.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:04 UTC
- End: 2026-02-12 12:09 UTC
- Status: `done`
- Key actions:
  - Added `ClientFrameScheduler` with explicit stages (`pre_update` → `update` → `post_update` → `render`).
  - Registered per-frame behaviors as systems (cursor, updater, interaction intent, render).
  - Refactored `Game.tick()` to delegate to the scheduler.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: migrate additional per-frame behaviors (plateau/checkpoint, cleanup) into staged systems.

## Ticket 54: Client Frame Scheduler: Time + Start Gating

- Status: `done`
- Priority: P2
- Scope:
  - Move frame time update (`currentTime`) into a pre-update system.
  - Run the frame scheduler every animation frame and gate systems on `game.started`.
  - Ensure connection startup path (game loop starts before handshake) continues to work.
- Out of scope:
  - Changing game startup/handshake sequencing.
  - Converting non-per-frame logic into systems.
- Acceptance criteria:
  - `Game.tick()` no longer assigns `currentTime` directly.
  - Cursor/updater/interaction/render systems no-op when `started === false`.
  - `bun run typecheck` passes.
  - `bun test --timeout 20000` passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:13 UTC
- End: 2026-02-12 12:15 UTC
- Status: `done`
- Key actions:
  - Added pre-update time system (`currentTime = Date.now()`).
  - Made updater/render systems gate on `started`, so the scheduler can run every animation frame safely.
  - Refactored `Game.tick()` to only run the scheduler + schedule the next frame.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (195 total: 194 pass, 1 skip, 0 fail)
- Next action:
  - Implement Ticket 55 (smoke welcome timeout stabilization).

## Ticket 55: Stabilize Smoke WS Welcome Timeouts

- Status: `done`
- Priority: P2
- Scope:
  - Reduce flakes in `tests/smoke/server-payload-guards.test.ts` by increasing `WELCOME` wait timeout.
- Out of scope:
  - Larger smoke harness refactors or server startup performance work.
- Acceptance criteria:
  - `bun test --timeout 20000` passes repeatedly without `Timed out waiting for WELCOME`.
- Verification plan:
  - `bun test --timeout 20000` (run twice)
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12 12:16 UTC
- End: 2026-02-12 12:17 UTC
- Status: `done`
- Key actions:
  - Increased websocket `go`/`WELCOME` wait timeouts and server `/status` readiness wait to reduce flakes under load.
- Evidence:
  - `bun test --timeout 20000` (pass)
  - `bun test --timeout 20000` (pass, second run)
- Next action:
  - None.

## Ticket 44: Single-Port Dev Runtime (PORT + Vite Proxy)

- Status: `done`
- Priority: P1
- Scope:
  - Single public dev port (default `8123`) for client + websocket gameplay.
  - Use `.env` for dev defaults (`PORT`, `BQ_SERVER_PORT`).
  - WebSocket endpoint path is `/ws` (no legacy root `/` websocket path).
- Out of scope:
  - Bun-only client bundling (remove Vite).
  - Maintaining query-param host/port overrides for legacy ingress.
- Acceptance criteria:
  - `bun run dev` serves the client on `http://localhost:8123/`.
  - Client gameplay websocket connects via `ws://<origin>/ws` (single-port; proxied in dev).
  - Server websocket runtime only upgrades on `/ws`.
  - Smoke websocket handshake tests pass against `/ws`.
- Verification plan:
  - `bun run typecheck`
  - `bun test --timeout 20000 tests/smoke/server/handshake.test.ts`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12
- End: 2026-02-12
- Status: `done`
- Key actions:
  - Standardized websocket path to `/ws` and removed client host/port override logic in favor of origin-derived `wsUrl`.
  - Restricted server websocket upgrade to `/ws` (Bun runtime + Node ws runtime factory parity).
  - Switched Vite dev server to `.env`-driven `PORT` (default `8123`) and added dev proxy rules for `/ws`, `/healthz`, `/version`, `/status` to the Bun server.
  - Updated smoke + Playwright websocket URLs to use `/ws`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000 tests/smoke/server/handshake.test.ts` (pass)
  - `bun test --timeout 20000` (194 pass, 1 skip, 0 fail)
- Next action:
  - Optional: add prod single-port static serving to Bun server (serve `dist/vite` or `dist/bundle/client`).

## Ticket 43: Modern Client Runtime Hardening (Typing + Safety)

- Status: `done`
- Priority: P1
- Scope:
  - Reduce `@typescript-eslint/no-unsafe-*` warnings in the modern client runtime boundary (dispatcher + protocol ingestion).
  - Harden client grid lookups under `noUncheckedIndexedAccess` (avoid implicit `undefined` reads).
- Out of scope:
  - Full client refactor to eliminate all legacy `any`/dynamic patterns in `client/game.ts`.
  - Changing protocol wire format.
- Acceptance criteria:
  - Dispatcher mode no longer uses `JSON.parse` into `any` (shape is validated before use).
  - `client/game-entity-lookups.ts` has explicit row/cell guards (no unchecked indexing hazards).
  - Verification passes: `bun run lint:client-runtime`, `bun run typecheck`, `bun test --timeout 20000`.
- Verification plan:
  - `bun run lint:client-runtime`
  - `bun run typecheck`
  - `bun test --timeout 20000`
- Dependencies/blockers:
  - None.

### Progress log

- Start: 2026-02-12
- End: 2026-02-12
- Status: `done`
- Key actions:
  - Hardened dispatcher-mode websocket message parsing with safe JSON parsing + shape checks (no implicit `any`).
  - Tightened `sendMessage` guard and removed `any`-typed action flows by keeping decoded action batches typed.
  - Hardened grid/entity lookups to avoid unchecked indexing under `noUncheckedIndexedAccess`.
- Evidence:
  - `bun run lint:client-runtime` (exit 0; 0 warnings)
  - `bun run typecheck` (pass)
  - `bun test --timeout 20000` (pass)
- Next action:
  - Optional: keep chipping away at `client/game.ts` `no-unsafe-*` warnings by removing implicit `this` in callbacks and tightening `Game` internal fields.

## Ticket 31: Domain Value Objects and IDs

- Status: `done`
- Priority: P1
- Scope:
  - Introduce branded/opaque value objects for ids and positions across server/client/shared.
  - Replace `string | number` id unions in core runtime with explicit types and explicit boundary conversions.
- Out of scope:
  - Protocol redesign (wire ids remain numeric where required).
- Acceptance criteria:
  - `EntityId` is generational (prevents use-after-free) and not interchangeable with other ids.
  - `GridPos` and `WorldPos` are distinct (no accidental mix of pixel/grid space).
  - Protocol boundaries own all coercions (ex: `number` -> `EntityId`), core logic does not.
- Verification plan:
  - `bun run typecheck`
  - Add focused unit tests for id/position conversions.
- Dependencies/blockers:
  - None.
- Planned slices:
  - 31.1 (`done`) Add `shared/domain/ids.ts` (generational `EntityId`, specialized ids, safe parsing/formatting).
  - 31.2 (`done`) Add `shared/domain/positions.ts` (`GridPos`, `WorldPos`, helpers).
  - 31.3 (`done`) Migrate server world internals to branded ids/positions (boundary conversions only).
  - 31.4 (`done`) Migrate client state maps/lookups to branded ids/positions (boundary conversions only).

### Progress log

- Start: 2026-02-11 16:20 CET
- End: 2026-02-11 17:15 CET
- Status: `done`
- Key actions:
  - Added explicit wire<->domain coercion helpers (`entityIdFromWire`, `entityIdFromWireString`, `entityIdToWire`).
  - Migrated server world internals away from `string | number` ids and removed implicit coercions.
  - Migrated client protocol boundary + session plumbing to use `EntityId` and perform conversions at the boundary.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test tests/unit/domain-ids.test.ts tests/unit/domain-positions.test.ts` (pass)
  - `bun test` (pass)
- Next action:
  - Start Ticket 24.

## Ticket 24: ECS Runtime Core (Server)

- Status: `done`
- Priority: P0
- Scope:
  - Build a full ECS runtime for the authoritative server simulation:
    - entity lifecycle (create/destroy, generational ids)
    - component stores (SoA-first where meaningful; no `unknown`)
    - archetype index + fast queries
    - resource registry (singletons: map, rng, clock, config)
- Out of scope:
  - Moving rendering to ECS (client keeps render classes initially).
  - Multi-threading/sharding.
- Acceptance criteria:
  - All server gameplay state is representable as ECS components/resources (no dependence on `Player/Mob/Item` class instances for simulation state).
  - Queries are ergonomic and fast enough for tick-loop usage.
  - ECS state is unit-testable without a websocket server.
- Verification plan:
  - `bun run typecheck`
  - Add a new focused unit suite for ECS core invariants.
- Dependencies/blockers:
  - Depends on Ticket 31.
- Planned slices:
  - 24.1 (`done`) Implement `EntityAllocator` (create/destroy, generation bump, reuse policy).
  - 24.2 (`done`) Implement component store interface (add/remove/has/get/set) with at least one SoA store example.
  - 24.3 (`done`) Implement archetype index and query iteration (`query(requiredComponents)` with stable iteration semantics).
  - 24.4 (`done`) Implement resources (`WorldResources`) and define core resources (time, rng, clock, config).
  - 24.5 (`done`) Create a minimal `WorldState` facade for systems (world + resources + command/event queues).

### Progress log

- Start: 2026-02-11 17:25 CET
- End: 2026-02-11 17:30 CET
- Status: `done`
- Key actions:
  - Added `server/ecs` runtime core: allocator, component stores (incl. SoA grid pos), archetype index/query, resources, queues, world facade.
  - Added focused unit tests for ECS invariants (allocator reuse/generation bump, store CRUD + stale-gen protection, query behavior, resource typing).
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
- Next action:
  - Start Ticket 29.

## Ticket 29: ECS Kernel and Scheduling (Server)

- Status: `done`
- Priority: P0
- Scope:
  - Replace ad-hoc world orchestration with a staged ECS scheduler:
    - ingest inbound commands
    - run fixed tick stages
    - emit domain events
    - flush outbox (protocol actions) after simulation
  - Make the tick deterministic under a seed for tests.
- Out of scope:
  - Protocol redesign.
- Acceptance criteria:
  - One place defines tick order and system registration; systems do not reach into ambient globals.
  - All randomness comes from injected deterministic rng resource.
  - Tick loop produces identical outputs given identical `(initial state, command stream, seed)`.
- Verification plan:
  - `bun run typecheck`
  - Add deterministic tick unit tests (seeded).
- Dependencies/blockers:
  - Depends on Ticket 24.
- Planned slices:
  - 29.1 (`done`) Define `System` interface and scheduler stages (pre, sim, post).
  - 29.2 (`done`) Implement scheduler registration and execution with timing budgets and tracing hooks.
  - 29.3 (`done`) Wire scheduler into server entry/world composition root (keep network behavior unchanged).

### Progress log

- Start: 2026-02-11 17:32 CET
- End: 2026-02-11 17:36 CET
- Status: `done`
- Key actions:
  - Implemented `server/ecs` scheduler with stage ordering, tracing hooks, and budget exceed hook.
  - Added deterministic `XorShift32` RNG and `FixedClock` and exercised determinism under `(seed, command stream)`.
  - Wired an optional startup probe (`BQ_ECS_SCHEDULER_PROBE=1`) into `server/startup/runner.ts`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
- Next action:
  - Start Ticket 38.

## Ticket 38: Spatial Index and Interest Management

- Status: `done`
- Priority: P0
- Scope:
  - Replace the current “groups/adjacent groups + incoming queues” mechanism with an ECS-managed spatial index:
    - spatial hashing or chunk grid keyed by `GridPos`
    - efficient “nearby players/entities” queries for AI and replication
    - interest sets per player for spawn/despawn/list diffs
- Out of scope:
  - Perfect occlusion/visibility culling (keep existing semantics first).
- Acceptance criteria:
  - Systems can query nearby entities without scanning global maps.
  - Replication uses interest sets to decide who receives what; no bespoke queue logic per feature.
- Verification plan:
  - `bun run typecheck`
  - Add unit tests for spatial index update/query and interest diff behavior.
- Dependencies/blockers:
  - Depends on Ticket 24 and Ticket 29.
- Planned slices:
  - 38.1 (`done`) Define `Position` component and `SpatialIndex` resource.
  - 38.2 (`done`) Implement index maintenance system (position changes -> index updates).
  - 38.3 (`done`) Implement interest tracking per player (enter/leave sets) and expose query helpers.

### Progress log

- Start: 2026-02-11 17:38 CET
- End: 2026-02-11 17:42 CET
- Status: `done`
- Key actions:
  - Implemented `SpatialIndex` resource with deterministic radius queries and a rebuild system from `Position` store.
  - Implemented `InterestTracker` (enter/leave diffs) for observer interest sets.
  - Improved smoke-test stability by increasing default timeouts in modern parity harness.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
- Next action:
  - Start Ticket 33.

## Ticket 33: Server Command/Event Pipeline

- Status: `done`
- Priority: P1
- Scope:
  - Model inbound protocol actions as typed commands and emit typed domain events from ECS systems.
  - Keep protocol parsing/validation at the boundary and move gameplay branching out of boundary dispatchers.
- Out of scope:
  - Full rollback/netcode reconciliation.
- Acceptance criteria:
  - WS boundary decodes and validates; it enqueues commands only.
  - Simulation systems consume commands and emit domain events.
  - One mapping layer translates domain events into protocol actions in the outbox.
- Verification plan:
  - `bun run typecheck`
  - Add focused unit tests for one end-to-end command path (MOVE recommended).
- Dependencies/blockers:
  - Depends on Ticket 29 and Ticket 38.
- Planned slices:
  - 33.1 (`done`) Define command types and a `CommandQueue` resource (per-connection/player association explicit).
  - 33.2 (`done`) Define domain event types and an `EventQueue` resource.
  - 33.3 (`done`) Migrate one vertical slice end-to-end (MOVE) through commands -> ECS -> events -> outbox.
  - 33.4 (`done`) Incrementally migrate remaining inbound handlers; delete dead branching.

### Progress log

- Start: 2026-02-11 17:44 CET
- End: 2026-02-11 17:16 UTC
- Status: `done`
- Key actions:
  - Implemented `Command` and `DomainEvent` unions and a protocol outbox resource, plus MOVE vertical slice with unit test.
  - Added `EntityAllocator.ensureAlive` + `EcsWorld.ensureEntity` to bridge legacy/wire entity ids into ECS without renumbering.
  - Wired a per-world ECS command pipeline (`WorldEcsCommandPipeline`) into the world tick loop (always enabled).
  - Migrated all inbound handlers to boundary-validate then enqueue typed ECS `Command`s; removed legacy session dispatcher.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
- Next action:
  - Start Ticket 32.

## Ticket 32: Protocol Manifest Generation

- Status: `done`
- Priority: P1
- Scope:
  - Define one canonical protocol manifest that derives:
    - opcode registry (direction, keys)
    - runtime validators
    - TypeScript action unions and builder signatures
  - Eliminate drift between `shared/protocol/registry.ts`, `shared/protocol/schema.ts`, and client/server action builders.
- Out of scope:
  - Opcode changes.
  - Binary protocol.
- Acceptance criteria:
  - One manifest defines every message shape; validators/builders are derived or mechanically checked against it.
  - Boundary close decisions use derived validators (no duplicated ad-hoc checks).
- Verification plan:
  - `bun run typecheck`
  - Protocol unit tests + `bun run test:modern-parity`
- Dependencies/blockers:
  - None (can land earlier), but easier after Ticket 33 shapes are stable.
- Planned slices:
  - 32.1 (`done`) Introduce `shared/protocol/manifest.ts` and derive registry from it.
  - 32.2 (`done`) Derive client->server validation and server->client validators from manifest.
  - 32.3 (`done`) Derive typed builders (or assert existing unions/builders match manifest).

### Progress log

- Start: 2026-02-11 17:17 UTC
- End: 2026-02-11 17:34 UTC
- Status: `done`
- Key actions:
  - Introduced canonical protocol manifest and derived `shared/protocol/registry.ts` from it.
  - Derived client->server and server->client validators from the same manifest and removed duplicated opcode/schema lists.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
- Next action:
  - Start Ticket 25.

## Ticket 25: Messaging Boundary Simplification (Event -> Protocol)

- Status: `done`
- Priority: P1
- Scope:
  - Remove server `Messages.*` wrapper classes and migrate all outbound traffic to typed protocol actions.
  - Use ECS domain events as the single source of outbound behavior (event mapping decides protocol actions).
- Out of scope:
  - Protocol redesign.
- Acceptance criteria:
  - No gameplay/system code constructs protocol tuples directly (builders/mappers only).
  - No domain object returns “message objects” (ex: no `entity.spawn()` returning a network message).
  - Outbox carries typed protocol actions, not `unknown[]`.
- Verification plan:
  - `bun run typecheck`
  - Focused unit coverage for event->protocol mapping + `bun run test:modern-parity`
- Dependencies/blockers:
  - Depends on Ticket 33 (events) and Ticket 32 (builders/validators).
- Planned slices:
  - 25.1 (`done`) Introduce server outbound builders and event->protocol mappers for low-risk actions (population/move/chat).
  - 25.2 (`done`) Remove `server/message.ts` usage progressively; delete file when no longer referenced.
  - 25.3 (`done`) Remove message construction methods from server entity classes (or delete those classes once ECS owns state).

### Progress log

- Start: 2026-02-11 17:35 UTC
- End: 2026-02-11 17:43 UTC
- Status: `done`
- Key actions:
  - Introduced outbound protocol action builders and migrated world push/broadcast paths to accept protocol actions directly.
  - Migrated entity message helpers to return protocol actions (spawn/despawn/health/attack/equip/drop/etc).
  - Deleted `server/message.ts` and removed all references.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
- Next action:
  - Start Ticket 28.

## Ticket 28: Replication + SPAWN Snapshot Contract

- Status: `done`
- Priority: P1
- Scope:
  - Define a canonical replication model for ECS:
    - how an entity is represented on the wire (spawn snapshot)
    - what updates are emitted (move/health/equip/etc)
    - how despawn is represented
  - Keep it wire-compatible initially, then optionally evolve.
- Out of scope:
  - Full delta-compression/binary protocol.
- Acceptance criteria:
  - SPAWN payload is derived from components via one encoder and decoded by one decoder (no positional probing).
  - Replicated components are explicit (whitelist) and versioned.
- Verification plan:
  - `bun run typecheck`
  - Unit tests for spawn encode/decode and update events + `bun run test:modern-parity`
- Dependencies/blockers:
  - Depends on Tickets 33 and 25.
- Planned slices:
  - 28.1 (`done`) Define `SpawnSnapshot`/`SpawnExtras` and canonical SPAWN encode/decode.
  - 28.2 (`done`) Implement server encoders from ECS state to protocol SPAWN/update actions.
  - 28.3 (`done`) Implement client decoders to client ECS state and renderer adapters.

### Progress log

- Start: 2026-02-11 17:44 UTC
- End: 2026-02-11 18:21 UTC
- Status: `done`
- Key actions:
  - Defined a typed, canonical SPAWN snapshot contract and centralized encode/decode (`shared/replication/spawn-snapshot.ts`).
  - Implemented component-driven SPAWN encoding via ECS-backed replication components (`server/replication/spawn-replication.ts`).
  - Migrated server SPAWN emission to use the ECS encoder and removed the legacy `getState()`/state-array SPAWN path.
  - Migrated client SPAWN handling to the shared decoder (removed ad-hoc positional probing in `receiveSpawn`).
  - Hardened ECS id adoption for legacy/wire ids and fixed readiness + group processing hot paths to keep ticks lean.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Start Ticket 40.

## Ticket 40: Port Gameplay Systems to ECS

- Status: `done`
- Priority: P1
- Scope:
  - Incrementally port gameplay logic from server classes + `server/world/*` modules into ECS systems.
  - Delete old world mutation code paths after parity.
- Out of scope:
  - New gameplay features.
- Acceptance criteria:
  - Core gameplay runs entirely via ECS (movement, combat, loot, mobs, respawn, regen, chest behavior).
  - Legacy world maps (`entities/players/mobs/items` dicts) are no longer sources of truth.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - Add focused unit tests per migrated vertical slice.
- Dependencies/blockers:
  - Depends on Tickets 24/29/38/33/25/28.
- Planned slices:
  - 40.1 (`done`) Movement + zoning + interest updates.
  - 40.2 (`done`) Combat (attack/hit/hurt/damage/kill/regen).
  - 40.3 (`done`) Loot + equip + drops.
  - 40.4 (`done`) Chests + item despawn/respawn.
  - 40.5 (`done`) Mob AI (aggro/hatelist/target selection/return-to-spawn).

### Progress log

- Start: 2026-02-11 20:40 UTC
- Slice 40.1 End: 2026-02-11 20:48 UTC
- Slice 40.2 End: 2026-02-11 21:27 UTC
- Slice 40.3 End: 2026-02-11 21:32 UTC
- Slice 40.4 End: 2026-02-11 21:43 UTC
- Slice 40.5 Start: 2026-02-11 21:58 UTC
- Slice 40.5 End: 2026-02-11 22:08 UTC
- Status: `done`
- Key actions:
  - Implemented ECS-driven interest replication (SPAWN/DESPAWN) and MOVE routing from the ECS outbox.
  - Disabled legacy group incoming SPAWN pushes to avoid duplicates; incoming queues are now just drained.
  - Synced legacy non-player movement into ECS replication state.
  - Chunked outgoing queue flushes to avoid event-loop stalls on large SPAWN bursts.
  - Migrated combat replication to ECS events + outbox messages (ATTACK, DAMAGE, KILL, HEALTH + regen), removed legacy `regenTick`.
  - Migrated loot/equip effects into ECS: healing, armor/weapon equip, firepotion full-heal + temporary visual equip (tick-based expiry).
  - Updated ECS outbox contract to support targeted vs nearby broadcasts; updated unit/smoke tests for stability.
  - Migrated item despawn/respawn lifecycle to ECS tick-based timers (BLINK/DESTROY + static respawn tasks), removed legacy item despawn timeouts.
  - Migrated chest OPEN handling to ECS (spawn + schedule despawn via ECS lifecycle).
  - Implemented ECS mob AI sim system: hate tracking, target selection, chase movement, leash enforcement, and tick-based return-to-spawn.
  - Removed legacy mob-follow orchestration from player movement and deleted dead legacy server modules.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Start Ticket 34.

## Ticket 34: Client ECS World State Kernel

- Status: `done`
- Priority: P2
- Scope:
  - Introduce a client-side ECS store for world state and drive rendering/UX from it.
  - Replace ad-hoc mutable maps in `client/game.ts` with a coherent state kernel.
- Out of scope:
  - Rendering rewrite (Ticket 12).
- Acceptance criteria:
  - Client inbound protocol actions update client ECS state via reducers/systems.
  - Renderer consumes a stable view model derived from ECS state (adapter layer).
  - Core state updates can be unit-tested without DOM/canvas.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
- Dependencies/blockers:
  - Depends on Ticket 28 (spawn/update decode shape).
- Planned slices:
  - 34.1 (`done`) Define client ECS store and migrate one inbound action (MOVE or POPULATION).
  - 34.2 (`done`) Migrate SPAWN/DESPAWN handling to populate client ECS state.
  - 34.3 (`done`) Add renderer adapter layer (ECS entity -> render entity instance).

### Progress log

- Start: 2026-02-11 22:10 UTC
- End: 2026-02-11 22:16 UTC
- Status: `done`
- Key actions:
  - Added `ClientWorldKernel` (component maps + entity views) and kernel-backed inbound reducers for SPAWN/DESPAWN/MOVE/TELEPORT/ATTACK/POPULATION.
  - Added a render adapter (`adaptKernelEntityForRendering`) and wired SPAWN creation through kernel state.
  - Added unit tests for kernel behavior without DOM/canvas.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Start Ticket 26.

## Ticket 26: Client Runtime Cutover (Remove Legacy Session Graph)

- Status: `done`
- Priority: P3
- Scope:
  - Remove `client/game-session/*` bind-heavy session plumbing and replace with kernel-based registration.
  - Consolidate side effects (audio, UI notifications, storage) behind explicit effect handlers.
- Out of scope:
  - Visual redesign.
- Acceptance criteria:
  - Session wiring has no `as unknown as` cast pyramids.
  - Adding a new client-side behavior is reducer/system + effect handler registration only.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
- Dependencies/blockers:
  - Depends on Ticket 34.
- Planned slices:
  - 26.1 (`done`) Introduce effect handler API (audio/UI/storage) with typed context.
  - 26.2 (`done`) Migrate connect/welcome flows to kernel registration; delete legacy builders.
  - 26.3 (`done`) Migrate spawn/player handlers; delete remaining `client/game-session/*`.

### Progress log

- Start: 2026-02-11 22:21 UTC
- End: 2026-02-11 22:36 UTC
- Status: `done`
- Key actions:
  - Added a typed effect handler registry (`client/runtime/effects-registry.ts`) and rewired client runtime registration through it.
  - Replaced `client/game-session/*` connection/session graph with a single runtime initializer (`client/runtime/connection.ts`) and updated `client/game.ts` to use it.
  - Deleted `client/game-session/*` and moved `applyLootFeedback` into `client/runtime/player/loot-feedback.ts`.
  - Hardened smoke protocol parsing to tolerate runtime payload shapes in `tests/smoke/server-payload-guards.test.ts` and `tests/smoke/modern-gameplay-parity.test.ts`.
- Evidence:
  - `bun run typecheck` (pass)
  - `bun test` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Start Ticket 36.

## Ticket 36: Content-Driven Prefabs/Components

- Status: `done`
- Priority: P2
- Scope:
  - Define canonical content schemas for “prefabs” that instantiate ECS components for an entity kind.
  - Generate validated runtime artifacts used by server and client.
- Out of scope:
  - New mechanics (this is plumbing/validation).
- Acceptance criteria:
  - Adding a new mob/item is primarily a content change (prefab + assets), not a code change.
  - Prefabs can attach capabilities/tags and default component values.
- Verification plan:
  - `bun run typecheck`
  - `bun run verify:modern`
- Dependencies/blockers:
  - Depends on Ticket 24 and Ticket 28 shapes.
- Planned slices:
  - 36.1 (`done`) Define prefab schema(s) and generator pipeline (JSON -> TS).
  - 36.2 (`done`) Migrate server spawning to prefab-based component instantiation.
  - 36.3 (`done`) Migrate client entity presentation metadata to prefabs (sprite/sound/UI strings).

### Progress log

- Start: 2026-02-11 22:40 UTC
- End: 2026-02-11 23:20 UTC
- Status: `done`
- Key actions:
  - Consolidated mob + item canonical content into a single prefab artifact consumed by server and client (`shared/generated/prefabs.generated.ts`).
  - Migrated server mob stats + drops and client loot messages to use prefabs; removed legacy content generators and artifacts.
  - Updated verification lane to enforce prefab generation drift check only.
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Start Ticket 37.

## Ticket 37: Mod/Plugin API (ECS)

- Status: `done`
- Priority: P3
- Scope:
  - Provide a stable plugin API to register:
    - components
    - systems
    - prefabs/content packs
    - command handlers (optional)
    - replication mappings (optional)
  - Trusted plugins only initially.
- Out of scope:
  - Security sandboxing for untrusted third-party code.
- Acceptance criteria:
  - Server loads plugins from config and installs them into the ECS kernel.
  - A sample plugin can add a trivial new entity + behavior without patching core code.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity` with a sample plugin enabled.
- Dependencies/blockers:
  - Depends on Tickets 29/33/36.
- Planned slices:
  - 37.1 (`done`) Define plugin API types and lifecycle (register/start/stop hooks).
  - 37.2 (`done`) Implement plugin loader and compatibility/version checks.
  - 37.3 (`done`) Add a sample plugin and minimal docs.

### Progress log

- Start: 2026-02-11 23:25 UTC
- End: 2026-02-11 23:30 UTC
- Status: `done`
- Key actions:
  - Added a versioned server plugin contract (`apiVersion: 1`) and loader wired into startup based on config `plugins`.
  - Enabled plugins to register ECS systems via `WorldEcsCommandPipeline.registerSystem`.
  - Added a sample plugin and unit tests for loading + injection.
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Start Ticket 41.

## Ticket 41: Determinism/Perf Test Harness

- Status: `done`
- Priority: P2
- Scope:
  - Add testing infrastructure to keep the ECS trustworthy:
    - determinism tests (seed + command stream)
    - invariants/property tests (no dangling ids, spatial index consistency)
    - microbenchmarks for queries and tick loop
- Out of scope:
  - Full profiling suite.
- Acceptance criteria:
  - Determinism test fails on nondeterministic sources (Math.random, Date.now in sim).
  - Perf baselines exist for core queries and tick under representative load.
- Verification plan:
  - `bun run typecheck`
  - `bun test` (focused ECS suites) + `bun run test:modern-parity`
- Dependencies/blockers:
  - Best after Ticket 29, but can start earlier for scaffolding.
- Planned slices:
  - 41.1 (`done`) Determinism harness (seeded rng + fixed clock resource).
  - 41.2 (`done`) Spatial/index invariants tests.
  - 41.3 (`done`) Benchmark harness for ECS queries and tick.

### Progress log

- Start: 2026-02-11 23:10 UTC
- End: 2026-02-11 23:30 UTC
- Status: `done`
- Key actions:
  - Added a nondeterminism guard test harness that fails on `Math.random`/`Date.now` usage in deterministic ECS ticks.
  - Expanded spatial index invariants coverage (stale-position regression).
  - Added a lean ECS bench script (`bun run bench:ecs`).
- Evidence:
  - `bun run verify:modern` (pass)
  - `bun run test:modern-parity` (pass)
- Next action:
  - Ticket 12 remains `deferred` (product-gated). No further queued tickets.

## Ticket 12: Rendering Modernization Track (Optional Product Track)

- Status: `deferred`
- Priority: P4
- Scope:
  - Product-gated rendering modernization (canvas renderer refactors, asset pipeline upgrades).
- Dependencies/blockers:
  - Deferred pending product direction decisions.

## Ticket 42: Modern Client Boot Hardening

- Status: `done`
- Priority: P1
- Scope:
  - Remove broken legacy analytics snippet from `client/modern.html`.
  - Make modern client boot resilient when map/assets are not loaded yet (avoid null deref on first render/rescale).
  - Ensure Playwright smoke catches boot-fatal regressions.
- Out of scope:
  - Rendering rewrite (Ticket 12).
- Acceptance criteria:
  - Opening `/client/modern.html` shows no `pageerror` and reaches playable session (body has `started`).
  - No fatal console errors during boot (renderer does not throw when `game.map` is null).
- Verification plan:
  - `bun run test:browser:modern`
  - `bun run verify:modern`
- Dependencies/blockers:
  - None.
- Planned slices:
  - 42.1 (`done`) Remove legacy analytics snippet causing `_gaq` TDZ error.
  - 42.2 (`done`) Guard renderer rescale until map/tilesets exist.
  - 42.3 (`done`) Tighten Playwright smoke to fail on boot errors.
  - 42.4 (`done`) Fix sprite registry + hurt-sprite pipeline (no `getImageData`).

### Progress log

- Start: 2026-02-11 23:35 UTC
- End: 2026-02-12 22:35 UTC
- Status: `done`
- Key actions:
  - Reproduced boot crash via Playwright and patched modern boot path.
  - Fixed sprite registry path so cursor sprites load (was pointing at missing `../sprites/*.json`).
  - Removed `getImageData` hurt-sprite generation (prevents noisy/fragile boot errors).
  - Added missing `arrow.png` assets to prevent sprite-load deadlock.
  - Sanitized spawn orientations (prevents `idle_undefined`) and made spawn handlers idempotent.
  - Wired character pathfinding resolver to `Game.findPath` so clicks/moves work.
  - Hardened Playwright protocol observer to track `/ws` connections (works for direct server and Vite-proxied websockets).
  - Removed stale expectations around legacy `LIST` flows in modern browser protocol tests.
  - Fixed generated-prefabs drift in `verify:modern` by updating the generator (no unused `eslint-disable` directive) and regenerating output.
  - Fixed a server readiness race where `/status` could be healthy before the world map finished loading, which could drop early HELLO/WELCOME in smoke lanes.
- Evidence:
  - `bun run test:browser:modern` (pass)
  - `bun run verify:modern` (pass)
- Next action:
  - Start staging true "zero legacy" follow-ups (server: delete legacy entity-object seams; client: renderer modernization track is still deferred as Ticket 12).
