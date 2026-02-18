# TODO Backlog

Last updated: 2026-02-18 01:26 UTC
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

- Ticket 364 - Binary wire contract + codec decision lock (`todo`)
  - Scope:
    - Included: benchmark wire encoding candidates for game WS traffic (`JSON`, `MessagePack`, custom binary) using representative captured batches from `benchmarks/`.
    - Included: lock a single production wire contract version (`v1`) with explicit frame header, action-batch envelope, and numeric type constraints.
    - Included: document no-fallback cutover policy for game WS transport (no dual runtime path after cutover).
    - Out of scope: implementing runtime transport changes.
  - Acceptance criteria:
    - A concrete binary protocol contract is defined in-repo (versioned and implementation-ready).
    - Candidate benchmark output exists with CPU + payload-size comparison on the same sample set.
    - Decision rationale for selected codec is recorded with explicit tradeoffs.
  - Verification plan:
    - `bun run typecheck`
    - `bun tools/bench/protocol-wire.ts`
    - `rg -n "BINARY_PROTOCOL_V1|wire contract|no-fallback" shared/protocol docs TODO.md`
  - Dependencies/blockers:
    - Requires stable benchmark corpus from `benchmarks/` captures.

- Ticket 365 - Shared binary action codec implementation (`todo`)
  - Scope:
    - Included: add shared encoder/decoder for client<->server protocol action batches on binary frames (top-level protocol arrays).
    - Included: preserve existing opcode semantics from `shared/protocol/registry.ts` while replacing JSON string transport for gameplay WS payloads.
    - Included: strict decode guards for malformed/truncated payloads.
    - Out of scope: nested intent payload schema changes.
  - Acceptance criteria:
    - Round-trip encode/decode coverage exists for representative inbound/outbound action batches.
    - Decoder rejects malformed payloads without crashing runtime.
    - Binary codec is available from shared protocol entrypoints for both client and server use.
  - Verification plan:
    - `bun test tests/unit/protocol/registry.test.ts tests/unit/mmo/protocol-chunks-schema.test.ts tests/unit/mmo/protocol-seq-ack-schema.test.ts`
    - `bun run typecheck`
    - `bun x eslint --max-warnings=0 shared/protocol/registry.ts shared/protocol/*.ts`
  - Dependencies/blockers:
    - Depends on Ticket 364.

- Ticket 366 - WS runtime/client transport binary cutover (`todo`)
  - Scope:
    - Included: switch game WS send/receive paths to binary payloads (`ArrayBuffer`/`Uint8Array`) in client and server runtime adapters.
    - Included: set client socket binary mode explicitly and handle binary payload dispatch in `client/gameclient.ts`.
    - Included: remove JSON stringify/parse in active game WS transport paths.
    - Included: no runtime fallback to text JSON frames for gameplay sockets.
    - Out of scope: HTTP endpoint payload formats.
  - Acceptance criteria:
    - Gameplay WS frames are binary in both directions.
    - Active client/server WS game transport paths no longer depend on `JSON.stringify`/`JSON.parse` for protocol action batches.
    - Runtime smoke flow (connect, move, combat, chat) succeeds on binary transport.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/unit/ws/runtime-parity.test.ts tests/unit/ws/runtime-factory.test.ts tests/unit/client-gameclient-reconnect-silent.test.ts tests/unit/player-session.test.ts`
    - `rg -n "JSON\\.stringify\\(|JSON\\.parse\\(" client/gameclient.ts server/ws/runtime.ts server/ws/runtime-factory.ts shared/protocol/registry.ts`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts`
  - Dependencies/blockers:
    - Depends on Ticket 365.

- Ticket 367 - Intent payload binaryization (remove nested JSON payload strings) (`todo`)
  - Scope:
    - Included: replace `MSG_INTENT` nested `payloadJson` string contract with typed binary payload encoding per intent kind.
    - Included: migrate shared intent encode/decode helpers to binary payload representations.
    - Included: remove runtime nested `JSON.stringify/JSON.parse` for intent payload handling.
    - Out of scope: adding new gameplay intents.
  - Acceptance criteria:
    - Client outbound intent creation sends typed binary payloads only.
    - Server intent bridge decodes typed payloads without JSON parse.
    - Existing movement/build/claim intent behavior remains functionally equivalent.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/unit/protocol/intents.test.ts tests/unit/mmo/server-seq-idempotency.test.ts tests/unit/mmo/client-seq-reconciliation.test.ts tests/unit/player-session.test.ts`
    - `rg -n "payloadJson|JSON\\.stringify\\(\\{ x:|JSON\\.parse\\(payload" shared/protocol/intents.ts client/gameclient-outbound-actions.ts server/player-session-command-translation.ts server/world/ecs-command-pipeline.ts`
  - Dependencies/blockers:
    - Depends on Ticket 365 and Ticket 366.

- Ticket 368 - Binary-first test harness + smoke migration (`todo`)
  - Scope:
    - Included: update WS test helpers/harnesses to send and assert binary gameplay frames by default.
    - Included: migrate protocol/browser/smoke tests that currently hardcode JSON text WS frames.
    - Included: preserve assertions for ACK/CORRECTION/REJECT/combat/chat semantics under binary transport.
    - Out of scope: non-WS HTTP API test payload changes.
  - Acceptance criteria:
    - Existing relevant smoke/unit/browser protocol tests pass using binary gameplay transport.
    - Test utilities provide ergonomic binary frame helpers (encode/decode wrappers) for future coverage.
    - Legacy JSON frame assumptions are removed from active gameplay test paths.
  - Verification plan:
    - `bun test tests/unit/mmo/protocol-chunks-schema.test.ts tests/unit/mmo/protocol-seq-ack-schema.test.ts tests/browser/protocol-invariant.playwright.ts tests/smoke/modern-gameplay-parity.test.ts tests/smoke/server-payload-guards.test.ts`
    - `bun run typecheck`
  - Dependencies/blockers:
    - Depends on Ticket 366 and Ticket 367.

- Ticket 369 - Binary transport perf/memory validation + JSON path removal (`todo`)
  - Scope:
    - Included: capture before/after benchmarks for CPU hot paths, WS payload bytes, and memory pressure with binary transport enabled.
    - Included: remove dead JSON gameplay transport code after binary verification passes.
    - Included: document measured deltas and regression guardrails in `PROGRESS.md`.
    - Out of scope: asset compression/content-size optimization unrelated to WS protocol.
  - Acceptance criteria:
    - Benchmark artifacts show measurable improvement in at least one primary bottleneck axis (CPU parse/serialize, payload bytes, or memory churn) without gameplay regressions.
    - No active JSON gameplay WS transport path remains in runtime code.
    - Typecheck/tests pass after dead-path cleanup.
  - Verification plan:
    - `bun run typecheck`
    - `bun test tests/smoke/modern-gameplay-parity.test.ts tests/unit/ws/runtime-parity.test.ts tests/unit/mmo/client-seq-reconciliation.test.ts`
    - `bun tools/bench/protocol-wire.ts`
    - `rg -n "decodeServerToClientProtocolActionBatch\\(message\\)|JSON\\.stringify\\(json\\)|JSON\\.parse\\(payload\\)" client/gameclient.ts shared/protocol/registry.ts server/ws/runtime.ts server/ws/runtime-factory.ts`
  - Dependencies/blockers:
    - Depends on Ticket 364, Ticket 365, Ticket 366, Ticket 367, Ticket 368.
