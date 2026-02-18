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

Latest output (2026-02-18, after FixedBin v2 cutover):

Mixed corpus (C2S + S2C):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 11.36 | 17.94 | 522500 | 26.13 | 71.00 |
| msgpack-subset | 26.80 | 12.45 | 313750 | 15.69 | 56.00 |
| protobuf-generic | 82.75 | 41.24 | 678750 | 33.94 | 84.00 |
| custom-efficient-v1 | 18.73 | 8.38 | 265000 | 13.25 | 29.00 |
| fixedbin-v2-mixed | 34.94 | 41.63 | 430000 | 21.50 | 53.00 |

Client-only corpus (C2S):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 8.25 | 11.12 | 337789 | 16.89 | 35.00 |
| msgpack-subset | 8.33 | 12.78 | 222235 | 11.11 | 25.00 |
| protobuf-generic | 25.62 | 21.65 | 415565 | 20.78 | 44.00 |
| custom-efficient-v1 | 6.65 | 2.57 | 168886 | 8.44 | 13.00 |
| fixedbin-v2-c2s | 12.44 | 39.61 | 344464 | 17.22 | 34.00 |

Server-only corpus (S2C):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 11.88 | 20.57 | 759992 | 38.00 | 71.00 |
| msgpack-subset | 12.12 | 7.20 | 431422 | 21.57 | 56.00 |
| protobuf-generic | 89.67 | 43.04 | 1017130 | 50.86 | 84.00 |
| custom-efficient-v1 | 12.77 | 8.50 | 388569 | 19.43 | 29.00 |
| fixedbin-v2-s2c | 18.83 | 35.10 | 539994 | 27.00 | 53.00 |

Takeaway from this run:

- Generic Protobuf over a dynamic `Value` envelope is not competitive for this payload shape (larger bytes and slower CPU than JSON).
- Runtime transport is now FixedBin v2 (binary v6), with per-opcode fixed layouts and no JSON fallback.
- FixedBin v2 eliminates chunk JSON payload strings and removes some hot repeated strings (intent/outcome type IDs) from the wire.
- FixedBin v2 decode CPU is still not competitive with native JSON parsing for these benchmark shapes; the next likely win is an even more aggressive decoder implementation (fewer method calls, fewer allocations, and fewer intermediate Arrays).
