# Gameplay Wire Contract (Binary v1)

## Decision

The gameplay WebSocket transport contract for this cycle is:

- frame header: `BQ` magic + `version` + `kind` + `payload length`
- protocol version: `BINARY_PROTOCOL_V1 = 1`
- frame kind: `BINARY_FRAME_KIND_ACTION_BATCH = 1`
- payload encoding for v1: MessagePack-compatible subset for protocol action batches
- cutover policy: no JSON gameplay frame fallback after binary v1 verification

Source contract constants: `shared/protocol/binary-wire.ts`.

## Why this choice

We benchmarked three codecs against representative protocol action batches (movement/combat/chat/chunk/control style payloads):

- JSON (baseline)
- MessagePack subset
- custom tag-based binary v1 prototype

Benchmark command:

```bash
bun tools/bench/protocol-wire.ts
```

Latest output (2026-02-18):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 19.86 | 18.71 | 694743 | 34.74 | 90.00 |
| msgpack-subset | 27.79 | 15.32 | 481386 | 24.07 | 74.00 |
| binary-v1-custom | 30.72 | 20.72 | 1002745 | 50.14 | 101.00 |

Relative vs JSON baseline:

- `msgpack-subset`: bytes `-30.71%`, encode `+39.95%`, decode `-18.12%`
- `binary-v1-custom`: bytes `+44.33%`, encode `+54.71%`, decode `+10.74%`

Based on this corpus, MessagePack subset is the best immediate v1 payload contract (lower wire size and better decode throughput than JSON), while the current custom-tag prototype is not efficient enough yet.
