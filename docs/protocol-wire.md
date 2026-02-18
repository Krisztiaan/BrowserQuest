# Gameplay Wire Contract (Binary v1)

## Decision

The gameplay WebSocket transport contract for this cycle is:

- frame header: `BQ` magic + `version` + `kind` + `payload length`
- protocol version: `BINARY_PROTOCOL_V1 = 1`
- frame kind: `BINARY_FRAME_KIND_ACTION_BATCH = 1`
- payload encoding for v1: custom native binary payload codec for protocol action batches
- cutover policy: no JSON gameplay frame fallback after binary v1 verification

Source contract constants: `shared/protocol/binary-wire.ts`.

## Why this choice

We benchmarked three codecs against representative protocol action batches (movement/combat/chat/chunk/control style payloads):

- JSON (baseline)
- MessagePack subset
- runtime custom binary codec (current implementation in `shared/protocol/binary-action-codec.ts`)

Benchmark command:

```bash
bun tools/bench/protocol-wire.ts
```

Latest output (2026-02-18, after custom-runtime cutover):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 14.29 | 16.97 | 694743 | 34.74 | 90.00 |
| msgpack-subset | 31.80 | 15.14 | 481386 | 24.07 | 74.00 |
| custom-runtime | 35.22 | 19.94 | 670725 | 33.54 | 83.00 |

Relative vs JSON baseline:

- `msgpack-subset`: bytes `-30.71%`, encode `+122.51%`, decode `-10.80%`
- `custom-runtime`: bytes `-3.46%`, encode `+146.43%`, decode `+17.46%`

Current direction is intentionally custom runtime codec for gameplay WS framing (user-requested no-fallback cutover). Benchmark deltas are tracked here as guardrails for follow-up optimization.
