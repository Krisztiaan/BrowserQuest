# Gameplay Wire Contract (Binary v4)

## Decision

The gameplay WebSocket transport contract for this cycle is:

- frame header: `BQ` magic + `version` + `kind` + `payload length`
- protocol version: `BINARY_PROTOCOL_V4 = 4`
- frame kind: `BINARY_FRAME_KIND_ACTION_BATCH = 1`
- payload encoding for v4: custom-efficient batch payload
  - top-level payload stores an action batch (`count + action values`)
  - action values use a compact tagged encoding (int32 varint / float64 / string / static string / array / int32-array)
  - no schema-driven runtime encode/decode branch in the hot path
  - action-shape validation is enforced at protocol registry boundaries
- cutover policy: no JSON gameplay frame fallback after binary v4 verification

Source contract constants: `shared/protocol/binary-wire.ts`.

## Why this choice

We benchmarked five codecs against representative protocol action batches:

- JSON (baseline)
- MessagePack subset
- Protobuf generic value-envelope
- Custom efficient payload-only reference (`custom-efficient-v1`)
- Runtime custom v4 wire (current implementation in `shared/protocol/binary-action-codec.ts`)

Benchmark command:

```bash
bun tools/bench/protocol-wire.ts
```

Latest output (2026-02-18, after runtime v4 cutover):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 14.02 | 15.44 | 606765 | 30.34 | 90.00 |
| msgpack-subset | 28.67 | 18.89 | 400073 | 20.00 | 74.00 |
| protobuf-generic | 75.91 | 31.30 | 717432 | 35.87 | 87.00 |
| custom-efficient-v1 | 21.04 | 8.51 | 249353 | 12.47 | 29.00 |
| runtime-custom-v4 | 48.59 | 38.63 | 542721 | 27.14 | 88.00 |

Relative vs JSON baseline:

- `msgpack-subset`: bytes `-34.06%`, encode `+104.43%`, decode `+22.37%`
- `protobuf-generic`: bytes `+18.24%`, encode `+441.34%`, decode `+102.73%`
- `custom-efficient-v1`: bytes `-58.90%`, encode `+50.00%`, decode `-44.88%`
- `runtime-custom-v4`: bytes `-10.55%`, encode `+246.47%`, decode `+150.24%`

Takeaway from this run:

- Generic Protobuf over a dynamic `Value` envelope is not competitive for this payload shape (larger bytes and slower CPU than JSON).
- Runtime transport has removed schema-driven runtime encode/decode paths and now uses the custom-efficient v4 codec path only (no fallback).
- Payload-only `custom-efficient-v1` remains the fastest benchmark row and is the reference target for further v4 wire-layout tuning.
