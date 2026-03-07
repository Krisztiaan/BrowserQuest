# TODO Backlog

Last updated: 2026-03-07 14:56 UTC
Status legend: `todo` | `in_progress` | `done` | `blocked` | `deferred`

This file tracks active work only.
Design and deep planning live in `mmo-plan.md`.
Progress logs live in `PROGRESS.md`.

Definition of done (per ticket):
- Ticket status is `done` only after its verification plan passes.
- A `PROGRESS.md` entry exists with timestamp + evidence.
- Once `done`, remove the ticket from `TODO.md` (history lives in `PROGRESS.md` + git).

## Active Tickets

Cycle objective: decouple movement/combat presentation from gameplay truth so ordinary movement never visibly snaps, repeated commands preserve continuity, and larger divergence is expressed with intentional visual states instead of ugly correction artifacts.

Architectural target for this cycle:
- `ClientWorldKernel` and ECS systems own gameplay truth only.
- `Character` becomes a visual actor/view object, not a holder of gameplay movement truth.
- A dedicated visual bridge translates gameplay deltas into render-motor targets and state transitions.
- Ordinary movement may not directly write visible position; only explicit discontinuity classes may snap.

Execution guidance for this cycle:
- Tickets are intentionally small enough that a fast but mediocre developer can complete one without inventing architecture.
- Each ticket should leave the codebase more one-directional:
  - gameplay truth -> bridge -> visual actor -> animation
- Do not “temporarily” add new direct render writes in old systems while implementing these tickets.
- If a ticket leaves legacy coupling in place, document it explicitly in code comments and `PROGRESS.md`.

No active tickets.
