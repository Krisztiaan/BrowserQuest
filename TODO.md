# TODO Backlog

Last updated: 2026-02-18 12:35 UTC
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

- Ticket 401 - Movement intents v2: introduce `move.to` + `move.input` payload codecs + capability surfacing
  - Status: `todo`
  - Scope:
    - Included: Add new intent type ids in `shared/protocol/intents.ts`:
      - `move.to` (click-to-move target request)
      - `move.input` (WASD input-state request)
    - Included: Add encode/decode helpers for both payloads (fixed-size binary payloads; no JSON).
    - Included: Surface new intent type ids in server capabilities (so clients can gate on `supportsIntent()`).
    - Included: Update any schema/registry validation required for the new intent payload shapes.
    - Out of scope: Switching client/server behavior to use these intents (follow-up tickets).
  - Acceptance criteria:
    - `supportsIntent('move.to')` / `supportsIntent('move.input')` can become true after HELLO capabilities handshake.
    - Payload codecs round-trip in unit tests.
    - Typecheck passes.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/unit/protocol/registry.test.ts tests/unit/protocol/binary-action-codec.test.ts --timeout 30000`
  - Dependencies/blockers:
    - None.

- Ticket 402 - Server authoritative movement v2: accept `move.to` and compute path server-side (no step spam)
  - Status: `todo`
  - Scope:
    - Included: Server implements `move.to` intent handler:
      - Validate target tile (bounds + collision rules).
      - Compute path from authoritative position to target.
      - Populate server MoveQueue from computed path, capped by configured maximum.
      - ACK the intent seq on accept.
    - Included: Server becomes tolerant to minor client divergence by design:
      - `move.to` never rejects for "non-adjacent" (it has no adjacency claim).
      - Keep strict invariants: max speed, collision, door rules.
    - Included: Define rejection reasons for invalid targets (blocked/out of bounds/no path).
    - Out of scope: WASD `move.input` server handling (Ticket 405).
  - Acceptance criteria:
    - A single `move.to` can move the player along a multi-step path without client streaming steps.
    - Existing `move.step` rejects (`MOVE_STEP_REJECT_*`) are not emitted for `move.to`.
    - Smoke gameplay parity still passes.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 401.

- Ticket 403 - Client click-to-move v2: send `move.to` once per click, keep visuals smooth via prediction + reconcile
  - Status: `todo`
  - Scope:
    - Included: Switch click movement to emit `INTENT(move.to)` instead of streaming `INTENT(move.step)`.
    - Included: Client-side prediction for the local player:
      - Start local movement immediately (don’t wait for S2C MOVE per-step) using the same pathfinder result already computed client-side.
      - Maintain an input queue keyed by intent `seq` for reconciliation.
    - Included: Server reconciliation:
      - On S2C MOVE/TELEPORT/CORRECTION, reconcile local predicted state to authoritative (smooth when small, snap when large).
    - Included: Coexistence policy:
      - Click-to-move target is cancelled when WASD keys become active (Ticket 404), and may be reinstated only by a new click.
    - Out of scope: Changing S2C movement replication format (vector tick; Ticket 406).
  - Acceptance criteria:
    - One click results in exactly one outbound move intent.
    - Local player starts moving immediately after click (even with artificial network delay).
    - No `move.step queue full` / `Invalid move.step (non-adjacent)` logs during click movement.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 401 and Ticket 402.

- Ticket 404 - WASD support v1: `move.input` intent (input-state), prediction, and coexistence with click-to-move
  - Status: `todo`
  - Scope:
    - Included: Add a dedicated WASD input system (keydown/keyup) that maintains `keysMask` state for W/A/S/D.
    - Included: Send `INTENT(move.input)` only on state change (not every frame).
    - Included: Client prediction for local movement while keys are held.
    - Included: Coexistence with click-to-move:
      - While any movement key is down, click-to-move plan is cancelled/paused.
      - When keysMask returns to 0, movement stops (does not auto-resume old click target).
    - Out of scope: Transport changes (WebTransport/WebRTC) and fallbacks (explicitly not required).
  - Acceptance criteria:
    - WASD moves the local player; releasing keys stops movement.
    - Input messages are emitted only on transitions (keydown/keyup), not continuously.
    - Click-to-move still works when no keys are held.
  - Verification plan:
    - `bun run typecheck`
    - Add a smoke test scenario (or extend `tests/smoke/modern-gameplay-parity.test.ts`) that performs at least one WASD move and verifies server ack + position sync.
  - Dependencies/blockers:
    - Depends on Ticket 401.
    - Depends on Ticket 405 for server handling and reconciliation envelope.

- Ticket 405 - Reconciliation protocol v1: explicit movement state ack + authoritative base snapshot
  - Status: `todo`
  - Scope:
    - Included: Add an explicit S2C movement reconciliation action (new opcode) that carries:
      - `ackSeq` (last processed movement input seq for the local player)
      - authoritative `gridX/gridY` (and optionally nextGrid/facing)
      - a server tick marker (monotonic) to support interpolation budgets
    - Included: Client consumes this message to:
      - drop pending inputs up to `ackSeq`
      - rebase predicted movement and smooth-correct small drift
    - Included: Server sends this reconciliation message at a fixed cadence (e.g. every N ticks) and on corrections.
    - Out of scope: Vectorizing all entity replication (Ticket 406).
  - Acceptance criteria:
    - Under simulated jitter/delay, local player movement remains smooth and drift is corrected without hard rejects.
    - No reliance on parsing logs to infer ack; ack is explicit for the local player.
  - Verification plan:
    - `bun run typecheck`
    - Update/extend smoke tests to assert `ackSeq` monotonicity and correction behavior.
  - Dependencies/blockers:
    - Depends on Tickets 402-404 (movement producers/consumers).

- Ticket 406 - Server-to-client perf: vectorized “entity state” replication (SoA) for hot movement/tick updates
  - Status: `todo`
  - Scope:
    - Included: Introduce a new S2C opcode for batched entity state deltas (struct-of-arrays layout):
      - entity ids + positions + movement flags + orientation + target (as needed)
      - encoded in a fixed binary layout with typed-array-friendly blocks
    - Included: Client applies this message without constructing per-entity action arrays in hot loops.
    - Included: Remove/stop emitting the legacy hot-path per-entity MOVE spam where replaced by the vector message.
    - Out of scope: Any new transport (still WebSocket).
  - Acceptance criteria:
    - Protocol bench shows S2C decode and bytes improved relative to current per-entity MOVE path.
    - Gameplay smoke parity passes.
  - Verification plan:
    - `bun run typecheck`
    - `bun tools/bench/protocol-wire.ts`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
  - Dependencies/blockers:
    - Depends on Ticket 405 (reconcile message design should not conflict).

- Ticket 407 - Binary codec perf vNext: reduce allocations and per-field overhead in FixedBin decode/apply
  - Status: `todo`
  - Scope:
    - Included: Implement a “decode+dispatch” path for hot S2C opcodes to avoid building intermediate `unknown[]` arrays.
    - Included: Eliminate avoidable copies in binary decode (use views/subarrays where safe; avoid `.slice()` churn).
    - Included: Keep wire contract (FixedBin v2 / binary v6) unless a bump is justified by measured wins.
    - Out of scope: WASM codecs (we are not paying WASM boundary cost here).
  - Acceptance criteria:
    - Bench shows FixedBin decode improves measurably on S2C and mixed corpora without breaking correctness.
    - Unit protocol/registry tests pass.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/unit/protocol/binary-action-codec.test.ts tests/unit/protocol/registry.test.ts --timeout 30000`
    - `bun tools/bench/protocol-wire.ts`
  - Dependencies/blockers:
    - Recommended after Ticket 406 (so new hot S2C shapes exist), but can be parallelized if scoped to existing opcodes.

- Ticket 408 - Protocol measurement: latency/jitter harness + movement/replication corpora refresh
  - Status: `todo`
  - Scope:
    - Included: Add a repeatable harness for injecting client<->server delay/jitter and measuring:
      - input-to-motion latency for local player
      - correction frequency/magnitude
      - outbound message rate (C2S) during click and WASD
    - Included: Update `tools/bench/protocol-wire.ts` corpora to include new movement messages and vector state messages.
    - Included: Refresh `docs/protocol-wire.md` with new results + interpretation.
  - Acceptance criteria:
    - We can quantify “smooth under lag” improvements without manual eyeballing.
  - Verification plan:
    - `bun run typecheck`
    - `bun tools/bench/protocol-wire.ts`
  - Dependencies/blockers:
    - Depends on Tickets 403-406.
