# TODO Backlog

Last updated: 2026-02-18 17:52 UTC
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

- Ticket 402 - Server authoritative movement v2: accept `move.to` and compute path server-side (no step spam)
  - Status: `todo`
  - Scope:
    - Included: Server implements `move.to` intent handler:
      - Validate target tile (bounds + collision rules).
      - Compute path from authoritative position to target using a shared pathfinder module (see below).
      - Populate server MoveQueue from computed path, capped (both by step count and by a node-visit budget).
      - ACK the intent seq on accept.
      - Respect `stopAdjacentToTarget` by trimming the final step from the path when needed.
    - Included: Implement shared pathfinding for client/server code sharing:
      - Move A* implementation out of `client/lib/astar.ts` into `shared/world/pathfinding/astar.ts` (or equivalent).
      - Move `client/pathfinder.ts` logic into `shared/world/pathfinding/pathfinder.ts` and use it from both client and server.
      - Client keeps its dynamic overlays (chunk overlays + dynamic occupancy) around the shared pathfinder call.
      - Server uses `server/map.ts` collision grid, plus a server-side occupancy overlay (players/mobs/chests/npcs) at path compute time.
    - Included: Server becomes tolerant to minor client divergence by design:
      - `move.to` never rejects for "non-adjacent" (it has no adjacency claim).
      - Keep strict invariants: max speed, collision, door rules.
    - Included: Define rejection reasons for invalid targets (blocked/out of bounds/no path).
    - Included: Movement-queue semantics for path-follow:
      - Being blocked by a transient occupant should not force a teleport correction; instead, pause (do not advance), and retry later.
      - Only hard-correct when the authoritative position itself is invalid/inconsistent (should not happen in normal play).
    - Out of scope: WASD `move.input` server handling (Ticket 405).
  - Acceptance criteria:
    - A single `move.to` can move the player along a multi-step path without client streaming steps.
    - Existing `move.step` rejects (`MOVE_STEP_REJECT_*`) are not emitted for `move.to`.
    - Client can follow an NPC/mob/chest by reissuing `move.to` as the target moves (no per-step INTENT spam).
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
      - Start local movement immediately using the client pathfinder result (same overlays as today), without waiting for the first S2C MOVE.
      - Maintain a minimal movement prediction state:
        - last authoritative tile (from S2C MOVE/TELEPORT/CORRECTION)
        - current predicted tile/path segment
        - last sent `move.to` seq (for logging/correlation)
    - Included: Server reconciliation:
      - On S2C MOVE/TELEPORT/CORRECTION:
        - if authoritative tile matches predicted next tile: keep animating smoothly
        - if drift is small (1 tile): rebase current animation origin (no hard snap)
        - if drift is large: snap to server tile and clear predicted local path
      - On S2C REJECT for `move.to`: clear prediction state and stop local movement.
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
      - Ignore movement keys while chat/name inputs are focused.
      - Ensure key repeat does not generate redundant sends (only transitions).
    - Included: Send `INTENT(move.input)` only on state change (not every frame).
    - Included: Client prediction for local movement while keys are held.
      - Disallow diagonal tile motion: resolve a single cardinal direction when multiple keys are held.
      - Direction resolution policy:
        - prefer the most recently pressed movement key still held
        - server mirrors this using the observed key transition stream (no extra bytes needed)
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
    - Included: Add an explicit S2C movement reconciliation action (new opcode) for the local player only:
      - Proposed name: `MOVE_SYNC`
      - Payload: `ackSeq:varu32` + `pos:pos20` + `tick:varu32` + `flags:u8`
        - flags bit0: `suppressed` (client should stop predicting until next input)
        - other bits reserved
      - Add FixedBin v2 layout + docs for this opcode (`docs/protocol-fixedbin.md`).
    - Included: Client consumes this message to:
      - drop pending inputs up to `ackSeq`
      - rebase predicted movement and smooth-correct small drift
    - Included: Server emits this reconciliation message:
      - at a fixed cadence (e.g. every 4-8 ticks) while the player is moving
      - immediately on any correction/teleport outcome
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
    - Included: Introduce a new S2C opcode for batched entity movement/state deltas:
      - Proposed name: `ENTITY_STATE_BATCH`
      - Layout optimized for decode speed (minimal branching + sequential reads):
        - `tick:varu32`
        - `count:varu32`
        - for each entity:
          - `id:varu32`
          - `pos:pos20`
          - `flags:u8` (bits for hasTarget/hasOrientation/isMoving etc)
          - optional `orientation:u8` (only if flag set)
          - optional `targetId:varu32` (only if flag set)
      - Keep it “mostly fixed” so hot clients can decode in a tight loop and apply directly.
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
    - Included: Implement a “decode+dispatch” fast path for hot S2C opcodes:
      - Decode directly from `ByteReader` into kernel/apply routines (no `unknown[]` allocation per action).
      - Keep the existing exported helpers as the compatibility boundary for tests/tools; runtime can use the fast path.
    - Included: Eliminate avoidable copies in binary decode:
      - Ensure `ByteReader.readBytes` returns `subarray` views for payload blobs (already true); avoid any caller converting to JS arrays.
      - Prefer `Uint8Array` byte payloads at protocol boundaries (already in Ticket 399) and keep them unconverted.
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
      - Prefer a deterministic injection point (e.g. WS runtime send/receive wrappers or bot harness) over DevTools/manual testing.
    - Included: Update `tools/bench/protocol-wire.ts` corpora to include new movement messages and vector state messages.
    - Included: Refresh `docs/protocol-wire.md` with new results + interpretation.
  - Acceptance criteria:
    - We can quantify “smooth under lag” improvements without manual eyeballing.
  - Verification plan:
    - `bun run typecheck`
    - `bun tools/bench/protocol-wire.ts`
  - Dependencies/blockers:
    - Depends on Tickets 403-406.
