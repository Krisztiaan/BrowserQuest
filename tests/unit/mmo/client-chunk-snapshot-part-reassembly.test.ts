import { expect, test } from 'bun:test';
import { ClientChunkOverlayCache } from '../../../client/world/chunks/client-chunk-overlay-cache';
import {
    decodeChunkSnapshotPayloadJson,
    encodeChunkSnapshotPayloadJson,
    encodeChunkSnapshotPayloadJsonParts,
} from '../../../shared/protocol/chunks/chunk-snapshot-codec';

test('ClientChunkOverlayCache applies CHUNK_SNAPSHOT_PART sequences atomically on completion', () => {
    const chunkSize = 32;
    const chunkX = 0;
    const chunkY = 0;
    const version = 7;

    const overrides: Array<[number, number, number]> = Array.from({ length: 1024 }, (_, i) => [
        i % 32,
        Math.floor(i / 32),
        i + 1000,
    ]);

    const one = encodeChunkSnapshotPayloadJson({ chunkSize, overrides: [overrides[0]!], maxUtf8Bytes: 10_000 });
    const cap = one.length + 20;

    const parts = encodeChunkSnapshotPayloadJsonParts({ chunkSize, overrides, maxUtf8Bytes: cap });
    expect(parts.length).toBeGreaterThan(1);

    const cache = new ClientChunkOverlayCache();
    let appliedCount = 0;
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const payloadJson = parts[partIndex]!;
        const decoded = decodeChunkSnapshotPayloadJson(payloadJson);
        expect(decoded).toBeTruthy();
        if (!decoded) {
            continue;
        }
        const result = cache.applySnapshotPart({
            chunkX,
            chunkY,
            version,
            partIndex,
            partCount: parts.length,
            chunkSize: decoded.chunkSize,
            overrides: decoded.overrides,
        });
        if (result.applied) {
            appliedCount += 1;
        }
    }
    expect(appliedCount).toBe(1);

    expect(cache.getGlobal(0, 0)).toBe(1000);
    expect(cache.getGlobal(31, 31)).toBe(2023);
});

