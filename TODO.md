# TODO Backlog

Last updated: 2026-02-19 21:37 UTC
Status legend: `todo` | `in_progress` | `done` | `blocked` | `deferred`

This file tracks active work only.
Design and deep planning live in `mmo-plan.md`.
Progress logs live in `PROGRESS.md`.

Definition of done (per ticket):
- Ticket status is `done` only after its verification plan passes.
- A `PROGRESS.md` entry exists with timestamp + evidence.
- Once `done`, remove the ticket from `TODO.md` (history lives in `PROGRESS.md` + git).

## Current Cycle Completion Path

Cycle objective: complete the active performance/observability modernization chain with no fallback runtime branches.

- Phase 1 (Ticket 358): remove load-character preview `toDataURL` hotspot and enforce canvas-only lifecycle control.
- Phase 2 (Tickets 359-363): ship WebAudio-only runtime, integrate all events/music, then remove legacy audio path.
- Phase 3 (Tickets 364-369): ship binary gameplay WS transport end-to-end, then remove JSON gameplay transport path.

Execution rules for this cycle:

- Keep exactly one ticket `in_progress` at a time.
- Do not start the next phase until the prior phase verification plan is fully green and logged in `PROGRESS.md`.
- Treat "optional" benchmark/profiling steps as required for phase-exit decisions in this cycle.

Cycle completion gate:

- Tickets 358-369 are all `done` and removed from this file.
- Typecheck and targeted unit/smoke verification pass for the final integrated state.
- Before/after perf evidence is recorded in `PROGRESS.md` for preview, audio, and gameplay transport hot paths.

## Active Tickets

1. Ticket 424 (Server movement rework: from grid steps to continuous motion with sub-tile collision)
  - Status: `todo`
  - Scope:
    - Replace server `player_move` application of `MoveQueue` grid steps with continuous movement:
      - `move.input` becomes authoritative velocity intent (normalized, diagonal speed fixed).
      - `move.to` becomes a waypoint list (tiles) that yields a desired velocity toward next waypoint center.
    - Movement updates `PositionSub`; `Position` is derived (Ticket 422).
    - Keep “world stays grid” semantics: waypoints are tiles; doors/zones trigger on derived tile.
  - Out of scope:
    - Client prediction changes.
    - Mob AI motion changes (can remain grid-step until later ticket, if not too coupled).
  - Acceptance criteria:
    - Player movement feels continuous, respects collisions, and does not desync doors/zoning triggers.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - Extend/add tests for move.input + move.to producing continuous pos updates, run `bun test tests/unit/mmo --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 423.

2. Ticket 425 (Protocol + replication: transmit sub-tile positions for player + entities)
  - Status: `todo`
  - Scope:
    - Extend S2C replication for `MOVE_SYNC` and `ENTITY_STATE_BATCH` to carry sub-tile positions:
      - choose fixed-point wire encoding (e.g. int32 subpixels) and update binary codec + schema.
    - Update server outbound builders and client inbound handlers to apply sub-tile positions into kernel/entities.
    - Keep over-the-wire size low: fixed-width ints, no JSON.
  - Out of scope:
    - Transport changes (WS remains).
  - Acceptance criteria:
    - Client receives authoritative sub-tile positions and uses them for rendering/prediction state.
    - Existing smoke parity test updated/extended and remains green.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - Update/add protocol unit tests under `tests/unit/protocol` and MMO unit tests, run `bun test tests/unit --timeout 30000`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 424 (server must produce sub-tile positions).

3. Ticket 426 (Client kernel/entity model: store sub-tile pos, derive grid tile for logic)
  - Status: `todo`
  - Scope:
    - Add sub-tile position to client kernel spatial records and entity instances (`x/y` in pixels or subpixels).
    - Keep `gridX/gridY` derived from `pos` for logic (interaction, targeting, zoning visuals).
  - Out of scope:
    - Visual interpolation changes (next ticket).
  - Acceptance criteria:
    - Client state can represent non-integer tile positions without rounding jitter.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 425.

4. Ticket 427 (Client rendering + interpolation for sub-tile motion)
  - Status: `todo`
  - Scope:
    - Render entities at sub-tile pixel positions (smooth, no tile snapping).
    - Update movement animation cadence to match continuous speed (walk cycles), keep 4-dir sprites.
    - Ensure camera follows smoothly using sub-tile position.
  - Out of scope:
    - New sprite assets.
  - Acceptance criteria:
    - Movement appears smooth at varying FPS; no jitter on reconciliation.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 426.

5. Ticket 428 (Server reconciliation model for sub-tile: client prediction + correction rules)
  - Status: `todo`
  - Scope:
    - Define and implement server correction strategy with sub-tile positions:
      - what gets ACKed (inputs vs waypoints),
      - correction thresholds,
      - how often `MOVE_SYNC` sends,
      - how client clears prediction on correction.
    - Ensure deterministic server simulation loop remains authoritative.
  - Out of scope:
    - Lag compensation for combat.
  - Acceptance criteria:
    - Client remains responsive; corrections are rare and not visually jarring in normal play.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - Expand `tests/unit/mmo/client-seq-reconciliation.test.ts` for sub-tile, run `bun test tests/unit/mmo --timeout 30000`
  - Dependencies/blockers:
    - Depends on Tickets 424-427.

6. Ticket 429 (Mob movement parity: port mobs/NPCs to sub-tile + collision)
  - Status: `todo`
  - Scope:
    - Update mob AI movement to use the same continuous collision kernel and `PositionSub`.
    - Keep AI planning grid-based (tile waypoints), motion continuous.
  - Out of scope:
    - AI behavior changes (targeting, pathing strategy).
  - Acceptance criteria:
    - Mobs move smoothly and collide correctly with map; no more “tile snapping” artifacts.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - Update/add a smoke test path that includes chasing/engagement with mobs, run `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 423 (collision) and Ticket 425 (replication).

7. Ticket 430 (Remove grid-step movement remnants + docs)
  - Status: `todo`
  - Scope:
    - Remove dead code paths and assumptions that movement occurs as discrete grid steps.
    - Update protocol docs and any design notes to reflect sub-tile authoritative positions.
  - Out of scope:
    - Further perf work.
  - Acceptance criteria:
    - No unused movement intent code remains; docs reflect the new model.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - `bun test tests/unit --timeout 30000`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on completing Tickets 421-429.
