# TODO Backlog

Last updated: 2026-02-25 04:07 UTC
Status legend: `todo` | `in_progress` | `done` | `blocked` | `deferred`

This file tracks active work only.
Design and deep planning live in `mmo-plan.md`.
Progress logs live in `PROGRESS.md`.

Definition of done (per ticket):
- Ticket status is `done` only after its verification plan passes.
- A `PROGRESS.md` entry exists with timestamp + evidence.
- Once `done`, remove the ticket from `TODO.md` (history lives in `PROGRESS.md` + git).

## Current Cycle Completion Path

Cycle objective: close the audit findings for ECS boundaries, server/client sync + reconciliation, map-area split idioms, and 20-200 player scalability risks.

- Phase 1 (Ticket 431): eliminate cross-map contamination by map-scoping claims + chunk overlays + tile edits.
- Phase 2 (Ticket 432): unify combat input onto sequenced intents (remove legacy raw `ATTACK` path).
- Phase 3 (Ticket 433): add inbound command backpressure + rate limiting safeguards.
- Phase 4 (Ticket 434): reduce broadcast fanout overhead with map/group-scoped delivery.
- Phase 5 (Ticket 435): remove map-loader fallback branch and enforce single modern path.
- Phase 6 (Ticket 436): split oversized gameplay orchestration modules into bounded domain services.
- Phase 7 (Ticket 437): add map-pack lazy loading for runtime area splits and verify transition behavior.

Execution rules for this cycle:

- Keep exactly one ticket `in_progress` at a time.
- Execute tickets in dependency order (`431 -> 432 -> 433 -> 434 -> 435 -> 436 -> 437`) unless a concrete blocker is recorded.
- Do not mark a ticket `done` until its verification plan is fully green and logged in `PROGRESS.md`.

Cycle completion gate:

- Remaining tickets in this file are `done` and removed.
- `bun run lint` and `bun run typecheck` pass.
- Targeted MMO/browser test suites pass for the integrated state.
- `PROGRESS.md` contains ticket-by-ticket evidence and risk/constraint notes.

## Active Tickets

- No active tickets in this cycle.
