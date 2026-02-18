# TODO Backlog

Last updated: 2026-02-18 19:30 UTC
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

- Ticket 406 - Server-to-client perf: vectorized “entity state” replication (SoA) for hot movement/tick updates
- Ticket 407 - Binary codec perf vNext: reduce allocations and per-field overhead in FixedBin decode/apply
  - Status: `in_progress`
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
