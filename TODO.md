# TODO Backlog

Last updated: 2026-02-18 12:10 UTC
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

- Ticket 400 - Benchmark methodology: remove stringify cost from timed loops
  - Status: `in_progress`
  - Scope:
    - Included: Move roundtrip correctness checks outside timed encode/decode loops in `tools/bench/protocol-wire.ts`.
    - Included: Normalize `Uint8Array` vs `number[]` for correctness checks.
    - Included: Refresh `docs/protocol-wire.md` with updated benchmark output.
  - Acceptance criteria:
    - Benchmark runs, prints tables, and does correctness checks without polluting timing.
    - Docs match latest output.
  - Verification plan:
    - `bun tools/bench/protocol-wire.ts`
    - `git diff docs/protocol-wire.md tools/bench/protocol-wire.ts`
  - Dependencies/blockers:
    - Depends on Ticket 399.
