import { expect, test } from 'bun:test';
import {
    decodeChunkSnapshotPayloadJson,
    encodeChunkSnapshotPayloadJson,
    encodeChunkSnapshotPayloadJsonParts,
} from '../../../shared/protocol/chunks/chunk-snapshot-codec';

test('encodeChunkSnapshotPayloadJson emits json envelope under cap', () => {
    const payloadJson = encodeChunkSnapshotPayloadJson({
        chunkSize: 32,
        overrides: [[1, 2, 123]],
        maxUtf8Bytes: 10_000,
    });
    const parsed = JSON.parse(payloadJson) as { schemaVersion: number; encoding: string };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.encoding).toBe('json');

    const decoded = decodeChunkSnapshotPayloadJson(payloadJson);
    expect(decoded).toEqual({
        schemaVersion: 1,
        encoding: 'json',
        chunkSize: 32,
        overrides: [[1, 2, 123]],
    });
});

test('encodeChunkSnapshotPayloadJson switches to gzip+base64 when capped', () => {
    const overrides: Array<[number, number, number]> = Array.from({ length: 2000 }, () => [0, 0, 0]);
    const payloadJson = encodeChunkSnapshotPayloadJson({
        chunkSize: 32,
        overrides,
        maxUtf8Bytes: 500,
    });
    const parsed = JSON.parse(payloadJson) as { schemaVersion: number; encoding: string; data?: string };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.encoding).toBe('gzip+base64');
    expect(typeof parsed.data).toBe('string');

    const decoded = decodeChunkSnapshotPayloadJson(payloadJson);
    expect(decoded?.schemaVersion).toBe(1);
    expect(decoded?.encoding).toBe('gzip+base64');
    expect(decoded?.chunkSize).toBe(32);
    expect(decoded?.overrides.length).toBe(2000);
});

test('encodeChunkSnapshotPayloadJson throws when the cap is too small even after gzip', () => {
    expect(() =>
        encodeChunkSnapshotPayloadJson({
            chunkSize: 32,
            overrides: [[0, 0, 0]],
            maxUtf8Bytes: 10,
        })
    ).toThrow();
});

test('encodeChunkSnapshotPayloadJsonParts splits oversized payloads into multiple part payloads under cap', () => {
    const chunkSize = 32;
    const overrides: Array<[number, number, number]> = Array.from({ length: 1024 }, (_, i) => [
        i % 32,
        Math.floor(i / 32),
        i + 1,
    ]);

    const firstOverride = overrides[0];
    expect(firstOverride).toBeTruthy();
    if (!firstOverride) {
        throw new Error('Missing first override for snapshot cap probe.');
    }
    const one = encodeChunkSnapshotPayloadJson({ chunkSize, overrides: [firstOverride], maxUtf8Bytes: 10_000 });
    const cap = one.length + 20;

    expect(() => encodeChunkSnapshotPayloadJson({ chunkSize, overrides, maxUtf8Bytes: cap })).toThrow();

    const parts = encodeChunkSnapshotPayloadJsonParts({ chunkSize, overrides, maxUtf8Bytes: cap });
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
        expect(part.length).toBeLessThanOrEqual(cap);
        const decoded = decodeChunkSnapshotPayloadJson(part);
        expect(decoded?.chunkSize).toBe(chunkSize);
    }
});
