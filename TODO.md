# TODO Backlog

Last updated: 2026-02-21 10:27 UTC
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

1. Ticket 428 (Server reconciliation model for sub-tile: client prediction + correction rules)
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

2. Ticket 429 (Mob movement parity: port mobs/NPCs to sub-tile + collision)
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

3. Ticket 430 (Remove grid-step movement remnants + docs)
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
