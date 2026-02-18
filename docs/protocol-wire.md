# Gameplay Wire Contract (FixedBin v1 / Binary v5)

## Decision

The gameplay WebSocket transport contract for this cycle is:

- frame header: `BQ` magic + `version` + `kind` + `payload length`
- protocol version: `BINARY_PROTOCOL_FIXEDBIN_V1 = 5`
- frame kind: `BINARY_FRAME_KIND_ACTION_BATCH = 1`
- payload encoding for v5: FixedBin v1 action batch
  - payload starts with `direction:u8` then `actionCount:varu32`
  - each action is encoded as `opcode:u8` followed by a fixed per-opcode layout (see `docs/protocol-fixedbin.md`)
  - action-shape validation is enforced at protocol registry boundaries
- cutover policy: no JSON gameplay frame fallback after FixedBin v1 verification

Source contract constants: `shared/protocol/binary-wire.ts`.

## Why this choice

We benchmarked five codecs against representative protocol action batches:

- JSON (baseline)
- MessagePack subset
- Protobuf generic value-envelope
- Custom efficient payload-only reference (`custom-efficient-v1`)
- FixedBin v1 wire (current runtime contract in `shared/protocol/binary-action-codec.ts`)

Benchmark command:

```bash
bun tools/bench/protocol-wire.ts
```

Latest output (2026-02-18, after FixedBin v1 cutover):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 16.74 | 15.20 | 606765 | 30.34 | 90.00 |
| msgpack-subset | 29.35 | 17.56 | 400073 | 20.00 | 74.00 |
| protobuf-generic | 97.02 | 36.48 | 717432 | 35.87 | 87.00 |
| custom-efficient-v1 | 27.08 | 7.52 | 249353 | 12.47 | 29.00 |
| fixedbin-v1 | 33.09 | 44.87 | 550735 | 27.54 | 82.00 |

Relative vs JSON baseline:

- `msgpack-subset`: bytes `-34.06%`, encode `+75.35%`, decode `+15.57%`
- `protobuf-generic`: bytes `+18.24%`, encode `+479.70%`, decode `+140.05%`
- `custom-efficient-v1`: bytes `-58.90%`, encode `+61.80%`, decode `-50.53%`
- `fixedbin-v1`: bytes `-9.23%`, encode `+97.72%`, decode `+195.28%`

Takeaway from this run:

- Generic Protobuf over a dynamic `Value` envelope is not competitive for this payload shape (larger bytes and slower CPU than JSON).
- Runtime transport is now FixedBin v1 (binary v5), with per-opcode fixed layouts and no JSON fallback.
- Current FixedBin v1 still carries some large string/JSON payloads (for example chunk snapshot/delta JSON), so wire-size gains vs JSON are modest; follow-up work should binary-pack these payloads and replace runtime strings with small enums/ids.
