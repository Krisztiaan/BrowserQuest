export const DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES = 64 * 1024;
export const DEFAULT_MAX_CHUNK_SNAPSHOT_PARTS = 128;
export const DEFAULT_MAX_INBOUND_COMMAND_QUEUE = 8192;

export function resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv(): number {
    const raw = process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
        return DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES;
    }
    return parsed;
}

export function resolveMaxInboundCommandQueueFromEnv(): number {
    const raw = process.env.BQ_MAX_INBOUND_COMMAND_QUEUE;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
        return DEFAULT_MAX_INBOUND_COMMAND_QUEUE;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return DEFAULT_MAX_INBOUND_COMMAND_QUEUE;
    }
    return parsed;
}

export function resolvePositiveIntegerOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}
