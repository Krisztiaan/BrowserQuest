# Gameplay Wire Contract (Binary v1)

## Decision

The gameplay WebSocket transport contract for this cycle is:

- frame header: `BQ` magic + `version` + `kind` + `payload length`
- protocol version: `BINARY_PROTOCOL_V1 = 1`
- frame kind: `BINARY_FRAME_KIND_ACTION_BATCH = 1`
- payload encoding for v1: full MessagePack payload for protocol action batches
- cutover policy: no JSON gameplay frame fallback after binary v1 verification

Source contract constants: `shared/protocol/binary-wire.ts`.

## Why this choice

We benchmarked three codecs against representative protocol action batches (movement/combat/chat/chunk/control style payloads):

- JSON (baseline)
- MessagePack subset
- runtime full MessagePack codec (current implementation in `shared/protocol/binary-action-codec.ts`)

Benchmark command:

```bash
bun tools/bench/protocol-wire.ts
```

Latest output (2026-02-18, after full-MessagePack runtime cutover):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 13.32 | 18.28 | 694743 | 34.74 | 90.00 |
| msgpack-subset | 27.43 | 15.06 | 481386 | 24.07 | 74.00 |
| msgpack-full-runtime | 102.26 | 69.88 | 626719 | 31.34 | 82.00 |

Relative vs JSON baseline:

- `msgpack-subset`: bytes `-30.71%`, encode `+105.91%`, decode `-17.60%`
- `msgpack-full-runtime`: bytes `-9.79%`, encode `+667.65%`, decode `+282.36%`

Current direction is intentionally full MessagePack runtime payloads for gameplay WS framing (user-requested no-fallback cutover). Benchmark deltas are tracked here as guardrails for follow-up optimization.
