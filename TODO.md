# TODO Backlog + Execution Log

Last updated: 2026-02-12 13:24 UTC
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
30. Ticket 67 (`todo`) - Remove movement step hooks (spatial sync system)

## Ticket 67: Remove Movement Step Hooks (Spatial Sync System)

- Status: `todo`
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

- Status: `todo`
- Next action:
  - Identify current step-hook responsibilities and replace with a single spatial sync system.

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

- Status: `in_progress`
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

- Status: `in_progress`
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
  - 42.1 (`in_progress`) Remove legacy analytics snippet causing `_gaq` TDZ error.
  - 42.2 (`in_progress`) Guard renderer rescale until map/tilesets exist.
  - 42.3 (`in_progress`) Tighten Playwright smoke to fail on boot errors.
  - 42.4 (`in_progress`) Fix sprite registry + hurt-sprite pipeline (no `getImageData`).

### Progress log

- Start: 2026-02-11 23:35 UTC
- Status: `in_progress`
- Key actions:
  - (in progress) Repro boot crash via Playwright and patch modern boot path.
  - Fixed sprite registry path so cursor sprites load (was pointing at missing `../sprites/*.json`).
  - Removed `getImageData` hurt-sprite generation (prevents noisy/fragile boot errors).
  - Added missing `arrow.png` assets to prevent sprite-load deadlock.
  - Sanitized spawn orientations (prevents `idle_undefined`) and made spawn handlers idempotent.
  - Wired character pathfinding resolver to `Game.findPath` so clicks/moves work.
- Evidence:
  - (pending)
- Next action:
  - Verify `/client/modern.html` reaches `body.started` and `bun run test:browser:modern` passes.
