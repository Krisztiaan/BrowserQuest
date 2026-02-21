# Gameplay Wire Contract (FixedBin v2 / Binary v6)

## Decision

The gameplay WebSocket transport contract for this cycle is:

- frame header: `BQ` magic + `version` + `kind` + `payload length`
- protocol version: `BINARY_PROTOCOL_FIXEDBIN_V2 = 6`
- frame kind: `BINARY_FRAME_KIND_ACTION_BATCH = 1`
- payload encoding for v6: FixedBin v2 action batch
  - payload starts with `direction:u8` then `actionCount:varu32`
  - each action is encoded as `opcode:u8` followed by a fixed per-opcode layout (see `docs/protocol-fixedbin.md`)
  - action-shape validation is enforced at protocol registry boundaries (`shared/protocol/schema.ts`)
  - FixedBin v2 notable changes vs v1:
    - INTENT/OUTCOME/REJECT encode type IDs as small `varu32` enums (no UTF-8 strings for these hot fields)
    - chunk snapshot/delta payloads are binary bytes (no JSON strings on the gameplay wire)
    - movement replication uses authoritative fixed-point subpixel world coords (`worldX/worldY`) in `MOVE_SYNC` and `ENTITY_STATE_BATCH`
- cutover policy: no JSON gameplay frame fallback after FixedBin v2 verification

Source contract constants: `shared/protocol/binary-wire.ts`.

## Why this choice

We benchmarked five codecs against representative protocol action batches:

- JSON (baseline)
- MessagePack subset
- Protobuf generic value-envelope
- Custom efficient payload-only reference (`custom-efficient-v1`)
- FixedBin v2 wire (current runtime contract in `shared/protocol/binary-action-codec.ts`)

Benchmark command:

```bash
bun tools/bench/protocol-wire.ts
```

Latest output (2026-02-21, correctness checks outside timed loops):

Mixed corpus (C2S + S2C):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 14.64 | 15.25 | 561277 | 28.06 | 71.00 |
| msgpack-subset | 31.72 | 19.67 | 332991 | 16.65 | 56.00 |
| protobuf-generic | 97.90 | 41.94 | 724845 | 36.24 | 84.00 |
| custom-efficient-v1 | 22.95 | 7.34 | 301236 | 15.06 | 44.00 |
| fixedbin-v2-mixed | 45.16 | 32.98 | 445928 | 22.30 | 53.00 |
| fixedbin-v2-mixed-dispatch | 26.87 | 34.15 | 445928 | 22.30 | 53.00 |

Client-only corpus (C2S):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 7.76 | 11.42 | 337789 | 16.89 | 35.00 |
| msgpack-subset | 12.52 | 5.76 | 222235 | 11.11 | 25.00 |
| protobuf-generic | 51.81 | 19.61 | 415565 | 20.78 | 44.00 |
| custom-efficient-v1 | 10.69 | 2.71 | 168886 | 8.44 | 13.00 |
| fixedbin-v2-c2s | 21.36 | 45.56 | 344464 | 17.22 | 34.00 |
| fixedbin-v2-c2s-dispatch | 12.32 | 16.34 | 344464 | 17.22 | 34.00 |

Server-only corpus (S2C):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 17.02 | 23.42 | 812500 | 40.63 | 71.00 |
| msgpack-subset | 19.08 | 9.89 | 457500 | 22.88 | 56.00 |
| protobuf-generic | 71.40 | 41.19 | 1072500 | 53.63 | 84.00 |
| custom-efficient-v1 | 12.43 | 5.27 | 450000 | 22.50 | 44.00 |
| fixedbin-v2-s2c | 27.08 | 27.07 | 560000 | 28.00 | 53.00 |
| fixedbin-v2-s2c-dispatch | 31.11 | 16.50 | 560000 | 28.00 | 53.00 |

Movement scenario (S2C) legacy MOVE spam (80 entities/frame):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 269.88 | 508.80 | 32200000 | 1610.00 | 1610.00 |
| custom-efficient-v1 | 460.16 | 182.31 | 16120000 | 806.00 | 806.00 |

Movement scenario (S2C) vector ENTITY_STATE_BATCH (80 entities/frame):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 226.06 | 324.99 | 29272000 | 1463.60 | 1464.00 |
| custom-efficient-v1 | 179.65 | 96.63 | 13093808 | 654.69 | 655.00 |

Takeaway from this run:

- Generic Protobuf over a dynamic `Value` envelope is not competitive for this payload shape (larger bytes and slower CPU than JSON).
- Runtime transport is now FixedBin v2 (binary v6), with per-opcode fixed layouts and no JSON fallback.
- FixedBin v2 eliminates chunk JSON payload strings and removes some hot repeated strings (intent/outcome type IDs) from the wire.
- FixedBin v2 decode CPU is still not competitive with native JSON parsing on the mixed corpus in this harness, but the dispatch decode path is substantially closer.
- We now use `dispatchBinaryActionBatchPayload` for the inbound client hot path so `ENTITY_STATE_BATCH` can be applied in a single pass (no giant action tuple allocation).
- The movement scenario numbers show that message *shape* changes (vector batching) can dominate over codec changes for bandwidth and decode CPU under high entity churn.

## Measuring “Smooth Under Lag”

Repeatable delay/jitter injection and input-to-motion measurement lives in:

- `tools/harness/movement-latency.ts`

Example (deterministic 80ms +/- 20ms both directions, WASD):

```bash
bun tools/harness/movement-latency.ts --mode wasd --trials 10 --c2s 80 --c2s-jitter 20 --s2c 80 --s2c-jitter 20 --seed 123456
```

The harness reports:

- `signalLatencyMs`: time to first `MOVE_SYNC` that acknowledges the sent input/intent seq (always available even if movement stalls).
- `moveLatencyMs`: time to first observed movement after sending the input/intent.
- `outcomes.rejects`, `outcomes.corrections`: coarse health indicators under injected jitter.
