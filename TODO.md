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

1. Ticket 416 (Diagonal step validation + no-corner-clipping rule (shared + server enforcement))
  - Status: `done`
  - Scope:
    - Extend movement step validation to allow diagonal steps (`dx=1 && dy=1`) in addition to cardinal steps.
    - Enforce "no corner clipping" for diagonal steps: a diagonal step is valid only if both orthogonal neighbor tiles are walkable (and, at execution time, not occupied by blocking entities).
    - Update server movement execution (`player_move`) to accept diagonal steps and apply the same corner/occupancy constraints.
  - Out of scope:
    - Changing click-to-move path planning to produce diagonal steps (done in a later ticket).
    - Changing sprite assets/adding 8-direction animations.
  - Acceptance criteria:
    - Server accepts valid diagonal steps and rejects diagonal corner cuts consistently.
    - A diagonal step cannot pass "through the corner" of two blocking tiles or through an occupied corner tile (player/mob/npc/chest).
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - Add/update unit tests under `tests/unit/mmo/` covering diagonal step validation + corner constraints, then run `bun test tests/unit/mmo`
  - Dependencies/blockers:
    - None.

2. Ticket 417 (WASD diagonal movement: `move.input` supports 2-axis combos + server executes diagonal)
  - Status: `todo`
  - Scope:
    - Update server held-key movement (`move.input`) to derive `dx/dy` from key-mask combos (W+A, W+D, S+A, S+D).
    - Apply the same diagonal corner/occupancy constraints as Ticket 416.
  - Out of scope:
    - Client-side animation refinements for diagonal (handled separately).
  - Acceptance criteria:
    - Holding two movement keys results in diagonal movement when allowed, otherwise falls back to a valid cardinal move (without jitter/spam).
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - Add/update unit tests for `move.input` diagonal combos under `tests/unit/mmo/`, run `bun test tests/unit/mmo`
  - Dependencies/blockers:
    - Depends on Ticket 416.

3. Ticket 418 (True diagonal click-to-move: diagonal A* planning end-to-end, no diagonal expansion)
  - Status: `todo`
  - Scope:
    - Switch client + server `move.to` planning to use constrained diagonal A* variant and keep diagonal steps (do not expand to cardinal micro-steps).
    - Remove diagonal-expansion logic from shared pathfinder; manhattan planning is achieved by choosing a non-diagonal variant, not by post-expansion.
    - Keep `stopAdjacentToTarget` candidate selection parity (from Ticket 415) while allowing diagonal steps in the path to the chosen candidate.
  - Out of scope:
    - Melee range changes (diagonal hits).
  - Acceptance criteria:
    - Click-to-move uses diagonals where appropriate and still respects no-corner-clipping.
    - Click-to-attack/follow remains stable (no oscillation regressions).
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - `bun test tests/unit/mmo/server-move-to-intent.test.ts`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 416 (server must be able to execute diagonal steps).

4. Ticket 419 (Client movement visuals: diagonal interpolation + deterministic facing (4-dir sprites))
  - Status: `todo`
  - Scope:
    - Ensure client interpolation works smoothly when both `gridX` and `gridY` change in one step.
    - Choose a deterministic facing for diagonal steps using existing 4-direction sprites (no new assets).
  - Out of scope:
    - 8-direction art/animations.
  - Acceptance criteria:
    - Diagonal movement renders without choppiness and without incorrect frame resets.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 418 (diagonal steps reaching the client).
