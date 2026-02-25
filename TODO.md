# TODO Backlog

Last updated: 2026-02-25 00:55 UTC
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

- Tickets 431-437 are all `done` and removed from this file.
- `bun run lint`, `bun run typecheck`, and targeted MMO/browser test suites pass for the integrated state.
- `PROGRESS.md` contains ticket-by-ticket evidence and any risk/constraint notes.

## Active Tickets

- Ticket: 431
  - Status: `in_progress`
  - Scope:
    - Add explicit map scoping to runtime claims and chunk-overlay mutation/replication so map A edits cannot affect map B at shared tile coords.
    - Scope tile-edit authorization and writes to the actor's current map.
    - Preserve existing gameplay behavior for single-map worlds.
  - Out of scope:
    - New player-facing tile-edit UI semantics.
    - Multi-world federation changes.
  - Acceptance criteria:
    - Claims are stored and queried with map identity.
    - Tile edits mutate chunk overlays in the correct map namespace.
    - Chunk snapshot/delta replication is map-scoped and does not leak across maps.
    - Existing single-map tests remain green; new cross-map regression coverage exists.
  - Verification plan:
    - `bun test tests/unit/mmo/server-map-transition.test.ts tests/unit/mmo/server-chunk-deltas.test.ts tests/unit/mmo/server-chunk-snapshot-parts-e2e.test.ts tests/unit/mmo/server-claims-store.test.ts`
    - `bun run lint`
    - `bun run typecheck`
  - Dependencies/blockers:
    - None.

- Ticket: 432
  - Status: `todo`
  - Scope:
    - Replace legacy raw `ATTACK` command transport with a sequenced combat intent in the intent pipeline.
    - Keep server authoritative hit-frame combat; remove split ordering path between movement intents and combat.
  - Out of scope:
    - Combat balance/stat tuning.
  - Acceptance criteria:
    - Client emits combat through sequenced intents only.
    - Server validates and acks/rejects combat intents through intent sequence rules.
    - Legacy raw `ATTACK` ingress path is removed or hard-rejected.
  - Verification plan:
    - `bun test tests/unit/ecs/combat-hitframe-state-machine.test.ts tests/unit/ecs/client-attack-intent-follow.test.ts tests/unit/mmo/server-seq-idempotency.test.ts`
    - `bun run lint`
    - `bun run typecheck`
  - Dependencies/blockers:
    - Depends on Ticket 431.

- Ticket: 433
  - Status: `todo`
  - Scope:
    - Add bounded inbound command buffering and per-connection flood controls.
    - Ensure overload behavior is explicit (drop/reject/close policy) and observable.
  - Out of scope:
    - Full QoS prioritization framework.
  - Acceptance criteria:
    - Inbound queue has deterministic capacity constraints.
    - Flood traffic cannot cause unbounded memory growth.
    - Behavior is covered with unit tests and structured log evidence.
  - Verification plan:
    - `bun test tests/unit/player-session.test.ts tests/unit/server/world-update-loop.test.ts`
    - `bun run lint`
    - `bun run typecheck`
  - Dependencies/blockers:
    - Depends on Ticket 432.

- Ticket: 434
  - Status: `todo`
  - Scope:
    - Replace all-player broadcast fanout with map/group scoped fanout where possible.
    - Minimize O(players) per-message loops for localized gameplay events.
  - Out of scope:
    - Cross-shard network architecture.
  - Acceptance criteria:
    - Localized events are only queued for relevant player subsets.
    - Existing visibility semantics remain correct.
  - Verification plan:
    - `bun test tests/unit/ecs/combat-interest-visibility.test.ts tests/unit/mmo/server-chunk-aoi-snapshots.test.ts`
    - `bun run lint`
    - `bun run typecheck`
  - Dependencies/blockers:
    - Depends on Ticket 433.

- Ticket: 435
  - Status: `todo`
  - Scope:
    - Remove map worker failure fallback to main-thread path and keep one deterministic load path.
    - Surface hard errors cleanly to startup UI/logging.
  - Out of scope:
    - Rewriting map worker protocol.
  - Acceptance criteria:
    - No runtime map-loading fallback branch remains.
    - Load failures are explicit and test-covered.
  - Verification plan:
    - `bun test tests/unit/map-source.test.ts tests/smoke/modern-gameplay-parity.test.ts`
    - `bun run lint`
    - `bun run typecheck`
  - Dependencies/blockers:
    - Depends on Ticket 434.

- Ticket: 436
  - Status: `todo`
  - Scope:
    - Split oversized orchestration modules into bounded domain files (movement, combat, map transitions, replication plumbing).
    - Preserve behavior while reducing coupling and regression surface.
  - Out of scope:
    - Full architecture rewrite.
  - Acceptance criteria:
    - Target modules reduced with clear domain ownership boundaries.
    - No functional regressions in covered gameplay tests.
  - Verification plan:
    - `bun run lint`
    - `bun run typecheck`
    - `bun test tests/unit/mmo --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 435.

- Ticket: 437
  - Status: `todo`
  - Scope:
    - Implement runtime map-pack lazy loading by map id (avoid eager full-pack parse in client boot path).
    - Keep map-transition correctness and cache coherence.
  - Out of scope:
    - CDN asset pipeline redesign.
  - Acceptance criteria:
    - Default load path only materializes required map payload(s).
    - Transition to other maps loads on demand and remains deterministic.
    - Existing map schema validation remains enforced.
  - Verification plan:
    - `bun test tests/unit/map-source.test.ts tests/unit/mmo/server-map-transition.test.ts tests/browser/modern-door-roundtrip.playwright.ts`
    - `bun run lint`
    - `bun run typecheck`
  - Dependencies/blockers:
    - Depends on Ticket 436.
