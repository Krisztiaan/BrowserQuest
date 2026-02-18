# TODO Backlog

Last updated: 2026-02-18 11:32 UTC
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

- Ticket 397 - FixedBin v2: binary chunk snapshot/delta payloads (no JSON strings)
  - Status: `in_progress`
  - Scope:
    - Included: Replace CHUNK_SNAPSHOT/CHUNK_SNAPSHOT_PART/CHUNK_DELTA payloads with binary bytes (sparse fixed layout), end-to-end.
    - Included: Update client receive handlers and server outbound action builders to use the new binary chunk codec.
    - Included: Update protocol types/schema/manifest to reflect bytes payload shape.
    - Out of scope: Further compression (zstd/brotli) or AOI algorithm changes.
  - Acceptance criteria:
    - Chunk streaming still functions in `bun dev` gameplay (smoke parity remains green).
    - No chunk payload JSON parsing in client hot path for gameplay frames.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
    - `rg -n \"decodeChunkSnapshotPayloadJson\\(\" client/gameclient.ts` -> should be `0` matches
  - Dependencies/blockers:
    - Depends on Ticket 396.

- Ticket 398 - Protocol wire benchmarks: direction-specific fixedbin rows + updated corpus
  - Status: `todo`
  - Scope:
    - Included: Update `tools/bench/protocol-wire.ts` to benchmark fixedbin using direction-specific codec entrypoints (c2s vs s2c).
    - Included: Update corpus samples to match FixedBin v2 (chunk bytes, intent/outcome enums).
    - Included: Update `docs/protocol-wire.md` with the new benchmark output.
    - Out of scope: Adding new codecs.
  - Acceptance criteria:
    - Benchmark prints separate rows for fixedbin c2s and s2c.
    - `docs/protocol-wire.md` matches latest output.
  - Verification plan:
    - `bun tools/bench/protocol-wire.ts`
    - `git diff docs/protocol-wire.md tools/bench/protocol-wire.ts`
  - Dependencies/blockers:
    - Depends on Ticket 397.
