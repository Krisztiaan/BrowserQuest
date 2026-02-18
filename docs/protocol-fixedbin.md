# FixedBin v2 (Fixed-Layout Gameplay Wire)

This document defines the FixedBin v2 gameplay transport format used over the gameplay WebSocket (binary frames only, no JSON fallback).

Goals:
- Minimal over-the-wire size for this repo’s fixed opcode set.
- Fast encode/decode (no generic tagged values, no schema walking).
- Stable, explicit per-opcode layouts.

Non-goals:
- Backward compatibility with legacy JSON gameplay frames.

## Frame

WebSocket binary payload is a `BQ` frame:

- byte 0: magic `B` (`0x42`)
- byte 1: magic `Q` (`0x51`)
- byte 2: protocol version (`BINARY_PROTOCOL_VERSION` in `shared/protocol/binary-wire.ts`)
- byte 3: frame kind (`BINARY_FRAME_KIND_ACTION_BATCH = 1`)
- bytes 4..7: payload length (uint32 LE)
- bytes 8..: payload bytes

Payload bytes are an `ActionBatch`.

## Encodings

All multi-byte integers are little-endian.

### `varu32` (unsigned LEB128)

Encodes unsigned 32-bit integers:
- Emit 7 bits per byte, low bits first.
- Set continuation bit (`0x80`) on all but final byte.
- Maximum 5 bytes.

### `S` (UTF-8 string)

FixedBin strings are length-prefixed UTF-8:
- `varu32 byteLen`
- `byteLen` raw UTF-8 bytes

Notes:
- This avoids a hard 255-byte limit (chat/claims can exceed 255).
- Over-the-wire bytes stay small for short strings because `varu32` is 1 byte for lengths < 128.

### `Pos20` (packed x/y)

Grid positions are packed into 20 bits:
- Assumes `0 <= x <= 1023` and `0 <= y <= 1023`.
- `packed = (x & 0x3FF) | ((y & 0x3FF) << 10)` (u32)
- Serialized as 3 bytes, little-endian: `b0 = packed & 0xFF`, `b1 = (packed >> 8) & 0xFF`, `b2 = (packed >> 16) & 0xFF`.

This is smaller than `u16 x + u16 y` (3 bytes vs 4).

### `IntentTypeId` (enum)

FixedBin v2 encodes `intentTypeId` values as small numeric IDs:
- `varu32 intentTypeId`

The mapping is fixed and derived from `shared/protocol/intents.ts`:
- `0`: `move.step`
- `1`: `door.teleport`
- `2`: `tile.edit`
- `3`: `claim.create`
- `4`: `claim.update`
- `5`: `claim.delete`

### `OutcomeTypeId` (enum)

FixedBin v2 encodes `outcomeTypeId` values as small numeric IDs:
- `varu32 outcomeTypeId`

Current mapping:
- `0`: `teleport.door`

### `Kind` (entity kind)

Entity kinds (`EntityKind`) are encoded as numeric kind IDs:
- `varu32 kindId`

The decoder returns numeric kind IDs to the game layer.

### `Id` (entity id)

Entity IDs are encoded as:
- `varu32 id`

Rationale:
- Many entity IDs are small; varints compress well.
- Some IDs (e.g. connection-local player ids) can be large; still bounded to 5 bytes.

### `Bytes` (raw bytes)

For binary blob fields:
- `varu32 byteLen`
- `byteLen` raw bytes

## ActionBatch

Payload bytes:
- `varu32 actionCount`
- `actionCount` × `Action`

## Action

- `u8 opcode`
- opcode-specific body (defined below)

Opcodes are `Types.Messages.*` from `shared/gametypes-browser.ts`.

## Opcode Layouts

This section covers every opcode listed in `shared/protocol/manifest.ts`.

### Client -> Server (C2S)

#### `HELLO` (0)

Body:
- `S name`
- `Kind armorKind`
- `Kind weaponKind`
- Optional extras:
  - `varu32 protocolRevision`
  - `S capabilitiesJson`

Rule:
- If the action has 6 items (`[HELLO, name, armor, weapon, protocolRevision, capabilitiesJson]`), include extras.
- Otherwise (4 items), omit extras.

#### `LOOTMOVE` (5) C2S

Body:
- `Pos20 playerPos` (x,y)
- `Id targetId`

#### `AGGRO` (6)

Body:
- `Id targetId`

#### `ATTACK` (7) C2S

Body:
- `Id targetId`

#### `CHAT` (11) C2S

Body:
- `S message`

#### `LOOT` (12)

Body:
- `Id itemId`

#### `WHO` (20)

Body:
- `varu32 count` (must be >= 1)
- `count` × `Id entityId`

#### `ZONE` (21)

Body: none

#### `OPEN` (25)

Body:
- `Id objectId`

#### `CHECK` (26)

Body:
- `Id checkpointId`

#### `ACHIEVEMENT` (27)

Body:
- `varu32 achievementId`

#### `INTENT` (29)

Body:
- `varu32 seq`
- `IntentTypeId intentTypeId`
- `varu32 payloadByteCount`
- `payloadByteCount` × `u8` payload bytes (raw)

Notes:
- Payload bytes are the existing intent payload encoding in `shared/protocol/intents.ts` (already binary).
- FixedBin v2 removes UTF-8 encoding for `intentTypeId` to cut encode/decode CPU and repeated wire bytes.

#### `CHUNK_SUBSCRIBE` (34)

Body:
- `varu32 chunkX`
- `varu32 chunkY`
- `varu32 radius`

#### `CHUNK_UNSUBSCRIBE` (35)

Body: none

### Server -> Client (S2C)

#### `WELCOME` (1)

Body:
- `Id playerId`
- `S name`
- `Pos20 playerPos`
- `varu32 hp`
- Optional extras:
  - `varu32 protocolRevision`
  - `S capabilitiesJson`

Rule:
- If the action has 8 items (`[WELCOME, id, name, x, y, hp, protocolRevision, capabilitiesJson]`), include extras.
- Otherwise omit extras.

#### `SPAWN` (2)

Body:
- `Id id`
- `Kind kind`
- `Pos20 pos`
- `u8 flags`
- Optional extras (ordered by flag bits):
  - bit0: `S name`
  - bit1: `varu32 orientation`
  - bit2: `Kind armorKind` then `Kind weaponKind`
  - bit3: `Id targetId`

Rules:
- For player spawns, set bit0/bit1/bit2 and optionally bit3 if targetId exists.
- For mob spawns, set bit1 and optionally bit3.
- For simple entities/items/chests, flags = 0.

The decoder reconstructs the legacy SPAWN tail shape used by `shared/replication/spawn-snapshot.ts`.

#### `DESPAWN` (3)

Body:
- `Id id`

#### `MOVE` (4)

Body:
- `Id id`
- `Pos20 pos`

#### `LOOTMOVE` (5) S2C

Body:
- `Id playerId`
- `Id itemId`

#### `ATTACK` (7) S2C

Body:
- `Id attackerId`
- `Id targetId`

#### `HEALTH` (10)

Body:
- `varu32 points`
- `u8 isRegenFlag` (`0` or `1`)

The decoder returns `[HEALTH, points]` when `isRegenFlag==0`, else `[HEALTH, points, 1]`.

#### `CHAT` (11) S2C

Body:
- `Id playerId`
- `S message`

#### `EQUIP` (13)

Body:
- `Id playerId`
- `Kind itemKind`

#### `DROP` (14)

Body:
- `Id mobId`
- `Id itemId`
- `Kind itemKind`
- `varu32 haterCount`
- `haterCount` × `Id playerId`

#### `TELEPORT` (15)

Body:
- `Id id`
- `Pos20 pos`

#### `DAMAGE` (16)

Body:
- `Id id`
- `varu32 points`

#### `POPULATION` (17)

Body:
- `varu32 worldPlayers`
- `varu32 totalPlayers`

#### `KILL` (18)

Body:
- `Kind mobKind`

#### `LIST` (19)

Body:
- `varu32 count`
- `count` × `Id entityId`

#### `DESTROY` (22)

Body:
- `Id id`

#### `HP` (23)

Body:
- `varu32 maxHp`

#### `BLINK` (24)

Body:
- `Id id`

#### `ACHIEVEMENTS` (28)

Body:
- `varu32 unlockedCount`
- `unlockedCount` × `varu32 achievementId`
- `varu32 ratCount`
- `varu32 skeletonCount`
- `varu32 totalKills`
- `varu32 totalDmg`
- `varu32 totalRevives`

#### `OUTCOME` (30)

Body:
- `varu32 seq`
- `OutcomeTypeId outcomeTypeId`
- `S payload` (currently JSON string)

#### `REJECT` (31)

Body:
- `varu32 seq`
- `IntentTypeId intentTypeId`
- `S reason`

#### `ACK` (32)

Body:
- `varu32 seq`

#### `CORRECTION` (33)

Body:
- `varu32 seq`
- Variant tag `u8 variant`
  - `0`: move correction: `Pos20 pos`
  - `1`: string correction: `S a`, `S b`

#### `CHUNK_SNAPSHOT` (36)

Body:
- `varu32 chunkX`
- `varu32 chunkY`
- `varu32 version`
- `varu32 payloadByteCount`
- `payloadByteCount` × `u8` payload bytes (raw)

Payload bytes are the binary chunk snapshot encoding (see `shared/protocol/chunks/chunk-snapshot-codec.ts`).

#### `CHUNK_SNAPSHOT_PART` (38)

Body:
- `varu32 chunkX`
- `varu32 chunkY`
- `varu32 version`
- `varu32 partIndex`
- `varu32 partCount`
- `varu32 payloadByteCount`
- `payloadByteCount` × `u8` payload bytes (raw)

#### `CHUNK_DELTA` (37)

Body:
- `varu32 chunkX`
- `varu32 chunkY`
- `varu32 fromVersion`
- `varu32 toVersion`
- `varu32 payloadByteCount`
- `payloadByteCount` × `u8` payload bytes (raw)

Payload bytes are the binary chunk delta encoding (see `shared/protocol/chunks/chunk-delta-codec.ts`).

## Compatibility Notes

- This v1 spec preserves the existing protocol action array shapes in `shared/protocol/types.ts` (IDs stay numeric, strings stay strings) so game logic does not need a full rewrite.
- It removes the generic tagged runtime value encoding and replaces it with explicit per-opcode layouts.
- Future FixedBin revisions can negotiate:
  - String tables for intent/outcome/reject literals.
  - Binary chunk snapshot/delta payloads (replace JSON strings).
