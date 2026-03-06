# TODO Backlog

Last updated: 2026-03-06 22:05 UTC
Status legend: `todo` | `in_progress` | `done` | `blocked` | `deferred`

This file tracks active work only.
Design and deep planning live in `mmo-plan.md`.
Progress logs live in `PROGRESS.md`.

Definition of done (per ticket):
- Ticket status is `done` only after its verification plan passes.
- A `PROGRESS.md` entry exists with timestamp + evidence.
- Once `done`, remove the ticket from `TODO.md` (history lives in `PROGRESS.md` + git).

## Active Tickets

Cycle objective: refactor movement into a presentation-decoupled, server-authoritative model that feels closer to real-time client authority without breaking combat, interaction, or MMO consistency.

### Ticket 754 - Local player presentation motor and immediate-response movement
- Status: `todo`
- Scope:
  - Included: local-player presentation motor with immediate response, short acceleration/deceleration shaping, soft catch-up toward authority, and stronger decoupling between predicted movement and rendered movement.
  - Included: unify `move.input` and `move.to` under the same presentation rules where practical.
  - Included: preserve “instant starts” while using catch-up speed modulation instead of visible snaps to absorb ordinary divergence.
  - Out of scope: remote-player interpolation rewrite.
- Acceptance criteria:
  - Local movement begins immediately from player input/click intent.
  - Small authoritative disagreement no longer causes visible jitter or step-like presentation.
  - Hard correction remains reserved for teleports and truly invalid drift.
- Verification plan:
  - `bun test --timeout 30000 tests/unit/ecs/client-move-input-prediction-system.test.ts tests/unit/client-command-apply-movement-correction.test.ts`
  - `bun x eslint client/ecs/systems/client-move-input-prediction-system.ts client/ecs/systems/client-command-apply-system.ts client/ecs/systems/client-simulation-system.ts`
- Dependencies/blockers:
  - Depends on Ticket 753.

### Ticket 755 - Remote player buffered interpolation and short extrapolation
- Status: `todo`
- Scope:
  - Included: remote-player snapshot buffering, interpolation delay, bounded extrapolation, and smoother catch-up on fresh snapshots.
  - Included: input-age-aware decay / undershoot bias for stale remote prediction so remotes are more likely to lag slightly than overshoot and snap back.
  - Included: explicit handling for delayed packets, duplicate snapshots, and snap-worthy discontinuities.
  - Out of scope: local movement motor internals.
- Acceptance criteria:
  - Other players move smoothly under ordinary packet jitter and moderate latency.
  - Remote entities do not visibly oscillate between stale target positions on normal movement.
  - Teleports and large discontinuities still snap promptly.
- Verification plan:
  - `bun test --timeout 30000 tests/unit/client-world-kernel.test.ts tests/unit/client-kernel-despawn-sync.test.ts`
  - `bun x eslint client/ecs/systems/client-kernel-replication-sync-system.ts client/ecs/systems/client-simulation-system.ts`
- Dependencies/blockers:
  - Depends on Ticket 753.

### Ticket 756 - Server validation envelopes and correction policy
- Status: `todo`
- Scope:
  - Included: server-side acceptance envelopes for plausible short-term divergence:
    - speed/rate limits,
    - map/collision legality,
    - bounded grace before correction,
    - optional short input buffering / throttle control if command starvation under jitter remains visible.
  - Included: reduce unnecessary correction churn without loosening gameplay truth.
  - Out of scope: full client-authoritative movement.
- Acceptance criteria:
  - Server accepts short plausible divergence without generating correction spam.
  - Impossible movement still rejects or corrects immediately.
  - Validation remains authoritative with deterministic bounds.
- Verification plan:
  - `bun test --timeout 30000 tests/unit/ecs/command-pipeline-move.test.ts tests/unit/client-command-apply-movement-correction.test.ts`
  - `bun x eslint server/world/ecs-command-pipeline.ts server/world/intents/move-to-intent.ts`
- Dependencies/blockers:
  - Depends on Ticket 753 and should be tuned after Ticket 754 prototypes the local movement feel.

### Ticket 757 - Combat and interaction grace for movement divergence
- Status: `todo`
- Scope:
  - Included: short grace windows for melee/interactions based on recent authoritative movement history or validated near-history.
  - Included: keep combat truth server-side while allowing movement/interactions to benefit from latency-state style presentation.
  - Included: eliminate “I was there locally” failures for attack, loot, talk, and open without opening obvious exploit gaps.
  - Out of scope: combat redesign or weapon rebalance.
- Acceptance criteria:
  - First-click interactions are resilient to small validated movement divergence.
  - Grace windows are bounded and do not allow wall/range exploits.
  - Movement/combat logs remain sufficient to debug acceptance vs cancellation.
- Verification plan:
  - `bun test --timeout 30000 tests/unit/ecs/client-attack-intent-follow.test.ts tests/unit/ecs/combat-hitframe-state-machine.test.ts tests/unit/ecs/server-attack-broadcast.test.ts`
  - `bun x eslint client/ecs/systems/client-interaction-intent-system.ts server/world/ecs-command-pipeline.ts`
- Dependencies/blockers:
  - Depends on Tickets 754 and 756.

### Ticket 758 - Pathing occupancy policy and crowd-flow simplification
- Status: `todo`
- Scope:
  - Included: reevaluate which entities block `move.to` pathing and local planning:
    - likely remove players as occupancy blockers for path planning,
    - keep or revisit mobs/NPCs/chests based on gameplay need.
  - Included: align client/server occupancy policy where mismatch hurts feel.
  - Out of scope: replacing tile collision with continuous physics.
- Acceptance criteria:
  - Crowd pathing is less sticky without harming core interaction/combat behavior.
  - Client/server path planning no longer diverges on the chosen occupancy policy.
  - Any occupancy removals are deliberate per entity class, not blanket.
- Verification plan:
  - `bun test --timeout 30000 tests/unit/ecs/client-player-move-outbox-system.test.ts tests/unit/ecs/command-pipeline-move.test.ts`
  - `bun x eslint client/runtime/pathing-dynamic-occupancy.ts client/ecs/systems/client-command-apply-system.ts server/world/intents/move-to-intent.ts`
- Dependencies/blockers:
  - Can begin after Ticket 753, but final tuning depends on Tickets 754-756.

### Ticket 759 - Instrumentation, tuning, and staged rollout guardrails
- Status: `todo`
- Scope:
  - Included: keep and extend the current observability hooks around movement divergence, correction frequency, attack-start timing, and remote smoothing behavior.
  - Included: define tuning knobs and rollout toggles for the new movement model.
  - Included: capture separate tuning profiles for:
    - farming/social traversal,
    - combat proximity,
    - minigame-critical movement if needed later.
  - Out of scope: permanent metrics backend or broad telemetry platform work.
- Acceptance criteria:
  - Each refactor phase exposes enough logs or counters to compare pre/post behavior.
  - Major smoothing constants and grace thresholds are centralized and adjustable.
  - Rollback/feature-flag strategy exists for risky movement changes.
- Verification plan:
  - `bun test --timeout 30000 tests/unit/server-log.test.ts tests/unit/ecs/client-attack-intent-follow.test.ts`
  - `bun x eslint client/gameclient.ts client/platform/log.ts server/log.ts`
- Dependencies/blockers:
  - Runs alongside Tickets 754-758 and closes after tuning stabilizes.
