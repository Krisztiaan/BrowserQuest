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

Latest output (2026-02-18, correctness checks outside timed loops):

Mixed corpus (C2S + S2C):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 12.63 | 15.36 | 522500 | 26.13 | 71.00 |
| msgpack-subset | 29.09 | 14.79 | 313750 | 15.69 | 56.00 |
| protobuf-generic | 81.90 | 44.66 | 678750 | 33.94 | 84.00 |
| custom-efficient-v1 | 19.49 | 11.44 | 265000 | 13.25 | 29.00 |
| fixedbin-v2-mixed | 36.27 | 36.80 | 430000 | 21.50 | 53.00 |

Client-only corpus (C2S):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 7.03 | 9.80 | 337789 | 16.89 | 35.00 |
| msgpack-subset | 7.76 | 4.80 | 222235 | 11.11 | 25.00 |
| protobuf-generic | 35.87 | 17.45 | 415565 | 20.78 | 44.00 |
| custom-efficient-v1 | 10.80 | 2.74 | 168886 | 8.44 | 13.00 |
| fixedbin-v2-c2s | 14.94 | 23.44 | 344464 | 17.22 | 34.00 |

Server-only corpus (S2C):

| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |
|---|---:|---:|---:|---:|---:|
| json | 10.36 | 22.59 | 759992 | 38.00 | 71.00 |
| msgpack-subset | 12.26 | 7.59 | 431422 | 21.57 | 56.00 |
| protobuf-generic | 78.05 | 40.89 | 1017130 | 50.86 | 84.00 |
| custom-efficient-v1 | 9.36 | 4.44 | 388569 | 19.43 | 29.00 |
| fixedbin-v2-s2c | 26.46 | 22.11 | 539994 | 27.00 | 53.00 |

Takeaway from this run:

- Generic Protobuf over a dynamic `Value` envelope is not competitive for this payload shape (larger bytes and slower CPU than JSON).
- Runtime transport is now FixedBin v2 (binary v6), with per-opcode fixed layouts and no JSON fallback.
- FixedBin v2 eliminates chunk JSON payload strings and removes some hot repeated strings (intent/outcome type IDs) from the wire.
- FixedBin v2 decode CPU is still not competitive with native JSON parsing on the mixed and C2S corpora in this harness, but S2C decode is now roughly at parity with JSON.
- The next likely win is an even more aggressive FixedBin decoder implementation (fewer method calls, fewer allocations, fewer intermediate Arrays, and possibly direct decode+dispatch for hot opcodes).
