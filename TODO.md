# TODO Backlog (Open Tickets Only)

Last updated: 2026-02-11 16:05 CET
Status legend: `todo` | `in_progress` | `blocked` | `deferred`

## Execution Queue (Work Order)

1. Ticket 31 (`todo`) - Domain value objects and IDs
2. Ticket 24 (`todo`) - ECS runtime core (server)
3. Ticket 29 (`todo`) - ECS kernel and scheduling (server)
4. Ticket 38 (`todo`) - Spatial index and interest management
5. Ticket 33 (`todo`) - Command/event pipeline (server)
6. Ticket 32 (`todo`) - Protocol manifest generation
7. Ticket 25 (`todo`) - Messaging boundary simplification (event -> protocol)
8. Ticket 28 (`todo`) - Replication + SPAWN snapshot contract
9. Ticket 40 (`todo`) - Port gameplay systems to ECS
10. Ticket 34 (`todo`) - Client ECS world state kernel
11. Ticket 26 (`todo`) - Client runtime cutover (remove legacy session graph)
12. Ticket 36 (`todo`) - Content-driven prefabs/components
13. Ticket 37 (`todo`) - Mod/plugin API (ECS)
14. Ticket 41 (`todo`) - Determinism/perf test harness
15. Ticket 12 (`blocked`) - Rendering modernization (product-gated)

## Ticket 31: Domain Value Objects and IDs

- Status: `todo`
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
  - 31.1 (`todo`) Add `shared/domain/ids.ts` (generational `EntityId`, specialized ids, safe parsing/formatting).
  - 31.2 (`todo`) Add `shared/domain/positions.ts` (`GridPos`, `WorldPos`, helpers).
  - 31.3 (`todo`) Migrate server world internals to branded ids/positions (boundary conversions only).
  - 31.4 (`todo`) Migrate client state maps/lookups to branded ids/positions (boundary conversions only).

## Ticket 24: ECS Runtime Core (Server)

- Status: `todo`
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
  - 24.1 (`todo`) Implement `EntityAllocator` (create/destroy, generation bump, reuse policy).
  - 24.2 (`todo`) Implement component store interface (add/remove/has/get/set) with at least one SoA store example.
  - 24.3 (`todo`) Implement archetype index and query iteration (`query(requiredComponents)` with stable iteration semantics).
  - 24.4 (`todo`) Implement resources (`WorldResources`) and define core resources (time, rng, map handle, config).
  - 24.5 (`todo`) Create a minimal `WorldState` facade for systems (world + resources + command/event queues).

## Ticket 29: ECS Kernel and Scheduling (Server)

- Status: `todo`
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
  - 29.1 (`todo`) Define `System` interface and scheduler stages (pre, sim, post).
  - 29.2 (`todo`) Implement scheduler registration and execution with timing budgets and tracing hooks.
  - 29.3 (`todo`) Wire scheduler into server entry/world composition root (keep network behavior unchanged).

## Ticket 38: Spatial Index and Interest Management

- Status: `todo`
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
  - 38.1 (`todo`) Define `Position` component and `SpatialIndex` resource.
  - 38.2 (`todo`) Implement index maintenance system (position changes -> index updates).
  - 38.3 (`todo`) Implement interest tracking per player (enter/leave sets) and expose query helpers.

## Ticket 33: Server Command/Event Pipeline

- Status: `todo`
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
  - 33.1 (`todo`) Define command types and a `CommandQueue` resource (per-connection/player association explicit).
  - 33.2 (`todo`) Define domain event types and an `EventQueue` resource.
  - 33.3 (`todo`) Migrate one vertical slice end-to-end (MOVE) through commands -> ECS -> events -> outbox.
  - 33.4 (`todo`) Incrementally migrate remaining inbound handlers; delete dead branching.

## Ticket 32: Protocol Manifest Generation

- Status: `todo`
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
  - 32.1 (`todo`) Introduce `shared/protocol/manifest.ts` and derive registry from it.
  - 32.2 (`todo`) Derive client->server validation and server->client validators from manifest.
  - 32.3 (`todo`) Derive typed builders (or assert existing unions/builders match manifest).

## Ticket 25: Messaging Boundary Simplification (Event -> Protocol)

- Status: `todo`
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
  - 25.1 (`todo`) Introduce server outbound builders and event->protocol mappers for low-risk actions (population/move/chat).
  - 25.2 (`todo`) Remove `server/message.ts` usage progressively; delete file when no longer referenced.
  - 25.3 (`todo`) Remove message construction methods from server entity classes (or delete those classes once ECS owns state).

## Ticket 28: Replication + SPAWN Snapshot Contract

- Status: `todo`
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
  - 28.1 (`todo`) Define `ReplicatedComponentSet` and `SpawnSnapshot` types.
  - 28.2 (`todo`) Implement server encoders from ECS state to protocol SPAWN/update actions.
  - 28.3 (`todo`) Implement client decoders to client ECS state and renderer adapters.

## Ticket 40: Port Gameplay Systems to ECS

- Status: `todo`
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
  - 40.1 (`todo`) Movement + zoning + interest updates.
  - 40.2 (`todo`) Combat (attack/hit/hurt/damage/kill/regen).
  - 40.3 (`todo`) Loot + equip + drops.
  - 40.4 (`todo`) Chests + item despawn/respawn.
  - 40.5 (`todo`) Mob AI (aggro/hatelist/target selection/return-to-spawn).

## Ticket 34: Client ECS World State Kernel

- Status: `todo`
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
  - 34.1 (`todo`) Define client ECS store and migrate one inbound action (MOVE or POPULATION).
  - 34.2 (`todo`) Migrate SPAWN/DESPAWN handling to populate client ECS state.
  - 34.3 (`todo`) Add renderer adapter layer (ECS entity -> render entity instance).

## Ticket 26: Client Runtime Cutover (Remove Legacy Session Graph)

- Status: `todo`
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
  - 26.1 (`todo`) Introduce effect handler API (audio/UI/storage) with typed context.
  - 26.2 (`todo`) Migrate connect/welcome flows to kernel registration; delete legacy builders.
  - 26.3 (`todo`) Migrate spawn/player handlers; delete remaining `client/game-session/*`.

## Ticket 36: Content-Driven Prefabs/Components

- Status: `todo`
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
  - 36.1 (`todo`) Define prefab schema(s) and generator pipeline (JSON -> TS).
  - 36.2 (`todo`) Migrate server spawning to prefab-based component instantiation.
  - 36.3 (`todo`) Migrate client entity presentation metadata to prefabs (sprite/sound/UI strings).

## Ticket 37: Mod/Plugin API (ECS)

- Status: `todo`
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
  - 37.1 (`todo`) Define plugin API types and lifecycle (register/start/stop hooks).
  - 37.2 (`todo`) Implement plugin loader and compatibility/version checks.
  - 37.3 (`todo`) Add a sample plugin and minimal docs.

## Ticket 41: Determinism/Perf Test Harness

- Status: `todo`
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
  - 41.1 (`todo`) Determinism harness (seeded rng + fixed clock resource).
  - 41.2 (`todo`) Spatial/index invariants tests.
  - 41.3 (`todo`) Benchmark harness for ECS queries and tick.

## Ticket 12: Rendering Modernization Track (Optional Product Track)

- Status: `blocked`
- Priority: P4
- Scope:
  - Product-gated rendering modernization (canvas renderer refactors, asset pipeline upgrades).
- Dependencies/blockers:
  - Blocked on product direction decisions.
