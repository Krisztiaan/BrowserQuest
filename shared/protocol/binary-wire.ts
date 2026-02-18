/**
 * Binary gameplay wire contract (FixedBin v1).
 *
 * Header layout:
 * - byte 0: magic 'B' (0x42)
 * - byte 1: magic 'Q' (0x51)
 * - byte 2: protocol version
 * - byte 3: frame kind
 * - bytes 4-7: payload length (uint32 little-endian)
 * - bytes 8..: payload bytes
 */
export const BINARY_WIRE_MAGIC_B = 0x42;
export const BINARY_WIRE_MAGIC_Q = 0x51;

export const BINARY_PROTOCOL_FIXEDBIN_V1 = 5 as const;
export const BINARY_PROTOCOL_VERSION = BINARY_PROTOCOL_FIXEDBIN_V1;

export const BINARY_FRAME_KIND_ACTION_BATCH = 1 as const;

export const BINARY_FRAME_HEADER_BYTES = 8 as const;

export type BinaryFrameKind = typeof BINARY_FRAME_KIND_ACTION_BATCH;

export type BinaryWireHeader = Readonly<{
    magicB: typeof BINARY_WIRE_MAGIC_B;
    magicQ: typeof BINARY_WIRE_MAGIC_Q;
    version: typeof BINARY_PROTOCOL_VERSION;
    kind: BinaryFrameKind;
    payloadBytes: number;
}>;

/**
 * Cutover policy for gameplay WebSocket transport in this modernization cycle.
 * No JSON gameplay frame fallback is kept after binary cutover verification.
 */
export const BINARY_WIRE_NO_FALLBACK_POLICY =
    'no-fallback gameplay WS transport after FixedBin v1 cutover verification' as const;
