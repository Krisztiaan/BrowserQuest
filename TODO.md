# TODO Backlog

Last updated: 2026-02-19 21:14 UTC
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

- Ticket 413 - Enforce `@typescript-eslint/unbound-method` (lint error, no suppressions-by-default)
  - Status: `todo`
  - Scope:
    - Included: Enable `@typescript-eslint/unbound-method` in `eslint.config.mjs` as an error.
    - Included: Fix all newly flagged violations in-repo (no blanket disables).
    - Out of scope: Broad ESLint ruleset overhaul.
  - Acceptance criteria:
    - `bun run lint` passes with the rule enabled.
  - Verification plan:
    - `bun run lint`
  - Dependencies/blockers:
    - After Ticket 412/414 to reduce churn.

- Ticket 414 - Make `Map.isOutOfBounds` auto-bound (arrow property) to reduce footguns
  - Status: `in_progress`
  - Scope:
    - Included: Convert `server/map.ts` `isOutOfBounds` from prototype method to arrow property.
    - Included: Keep public API behavior unchanged.
    - Out of scope: Refactoring the entire Map API surface.
  - Acceptance criteria:
    - `Map.isOutOfBounds` works even if referenced/captured unbound.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/unit/mmo/server-move-to-intent.test.ts --timeout 30000`
  - Dependencies/blockers:
    - None.
