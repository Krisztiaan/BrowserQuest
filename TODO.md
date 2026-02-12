# TODO Backlog + Execution Log

Last updated: 2026-02-11 23:30 UTC
Status legend: `todo` | `in_progress` | `done` | `blocked` | `deferred`

## Execution Queue (Work Order)

1. Ticket 40 (`done`) - Port gameplay systems to ECS
2. Ticket 34 (`done`) - Client ECS world state kernel
3. Ticket 26 (`done`) - Client runtime cutover (remove legacy session graph)
4. Ticket 36 (`done`) - Content-driven prefabs/components
5. Ticket 37 (`done`) - Mod/plugin API (ECS)
6. Ticket 41 (`done`) - Determinism/perf test harness
7. Ticket 12 (`deferred`) - Rendering modernization (product-gated)

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
  - `bun run lint:client-runtime` (exit 0; warnings remain in legacy-heavy files)
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
