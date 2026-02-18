# TODO Backlog

Last updated: 2026-02-18 22:20 UTC
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

- Ticket 410 - Pathfinding perf/quality v1: `ngraph.path`-inspired A* improvements
  - Status: `in_progress`
  - Scope:
    - Included: Evaluate and implement selected `../ngraph.path`-style improvements in shared pathfinding hot paths (open-set handling, visitation bookkeeping, and neighbor expansion efficiency).
    - Included: Add a repeatable pathfinding micro-benchmark for large/obstacle-dense maps and record before/after results.
    - Included: Keep current fast collision detection behavior as-is while improving planner internals.
    - Out of scope: Replacing fastCD/collision systems, adding runtime fallback pathfinders, or switching to non-grid navigation.
  - Acceptance criteria:
    - No path correctness regressions on existing movement tests (reachable/unreachable/incomplete path behavior).
    - Benchmark evidence shows measurable pathfinding throughput/latency improvement on representative workloads.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/unit/mmo/server-move-to-intent.test.ts tests/unit/client-pathing-ignore-list.test.ts tests/unit/client-pathfinder-ignore-restore.test.ts --timeout 30000`
    - `bun tools/bench/pathfinding.ts`
  - Dependencies/blockers:
    - Depends on Ticket 409.
