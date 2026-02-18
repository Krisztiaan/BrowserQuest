import type { ChunkAoiState, ChunkSubscription } from '../chunks/chunk-aoi';
import { makeChunkKey } from '../chunks/chunk-overlay-store';
import type { ChunkOverlayStore } from '../chunks/chunk-overlay-store';
import type { EntityId } from '../../../shared/domain/ids';
import type { GridPos } from '../../../shared/domain/positions';
import type { Queue } from '../../ecs/queues';
import type { OutboxMessage } from '../../ecs/outbox';
import { buildChunkDeltaAction, buildChunkSnapshotAction, buildChunkSnapshotPartAction } from '../../protocol/outbound-actions';
import { encodeChunkDeltaPayloadBinary } from '../../../shared/protocol/chunks/chunk-delta-codec';
import {
    encodeChunkSnapshotPayloadBinary,
    encodeChunkSnapshotPayloadBinaryParts,
} from '../../../shared/protocol/chunks/chunk-snapshot-codec';

const MAX_PENDING_CHUNKS_PER_PLAYER = 1024;
const MAX_PENDING_SNAPSHOT_STREAMS_PER_PLAYER = 32;
const MAX_PENDING_SNAPSHOT_PARTS_PER_PLAYER = 2048;

function decodeChunkCoordFromKeyPart(value: bigint): number {
    const raw = Number(value & 0xffff_ffffn);
    return raw >= 0x8000_0000 ? raw - 0x1_0000_0000 : raw;
}

function decodeChunkKey(key: bigint): { chunkX: number; chunkY: number } {
    const chunkX = decodeChunkCoordFromKeyPart(key >> 32n);
    const chunkY = decodeChunkCoordFromKeyPart(key);
    return { chunkX, chunkY };
}

function isChunkInAoiWindow(
    chunkX: number,
    chunkY: number,
    centerChunkX: number | null,
    centerChunkY: number | null,
    radius: number
): boolean {
    if (centerChunkX === null || centerChunkY === null) {
        return true;
    }
    return Math.abs(chunkX - centerChunkX) <= radius && Math.abs(chunkY - centerChunkY) <= radius;
}

function enforcePendingChunkQueueBounds(sub: ChunkSubscription): void {
    while (sub.pendingChunks.length > MAX_PENDING_CHUNKS_PER_PLAYER) {
        const dropped = sub.pendingChunks.pop();
        if (!dropped) {
            break;
        }
        sub.pendingChunkKeys.delete(makeChunkKey(dropped.chunkX, dropped.chunkY));
    }
}

function enforcePendingSnapshotStreamBounds(sub: ChunkSubscription): void {
    const kept: ChunkSubscription['pendingSnapshotParts'] = [];
    const keys = new Set<bigint>();
    let totalParts = 0;

    for (let i = 0; i < sub.pendingSnapshotParts.length; i += 1) {
        const stream = sub.pendingSnapshotParts[i];
        if (!stream) {
            continue;
        }

        if (
            !isChunkInAoiWindow(stream.chunkX, stream.chunkY, sub.lastCenterChunkX, sub.lastCenterChunkY, sub.radius)
            || keys.has(stream.key)
            || kept.length >= MAX_PENDING_SNAPSHOT_STREAMS_PER_PLAYER
            || totalParts + stream.parts.length > MAX_PENDING_SNAPSHOT_PARTS_PER_PLAYER
        ) {
            continue;
        }

        kept.push(stream);
        keys.add(stream.key);
        totalParts += stream.parts.length;
    }

    sub.pendingSnapshotParts = kept;
    sub.inFlightSnapshotKeys.clear();
    keys.forEach((key) => sub.inFlightSnapshotKeys.add(key));
}

export function enqueueSnapshotPartStream(
    sub: ChunkSubscription,
    stream: ChunkSubscription['pendingSnapshotParts'][number]
): boolean {
    if (sub.inFlightSnapshotKeys.has(stream.key)) {
        return false;
    }
    sub.pendingSnapshotParts.push(stream);
    sub.inFlightSnapshotKeys.add(stream.key);
    enforcePendingSnapshotStreamBounds(sub);
    return sub.inFlightSnapshotKeys.has(stream.key);
}

export function pruneChunkSubscriptionWindow(sub: ChunkSubscription, centerChunkX: number, centerChunkY: number): void {
    for (const key of sub.knownChunks) {
        const coords = decodeChunkKey(key);
        if (!isChunkInAoiWindow(coords.chunkX, coords.chunkY, centerChunkX, centerChunkY, sub.radius)) {
            sub.knownChunks.delete(key);
            sub.knownChunkVersions.delete(key);
        }
    }

    for (const [key] of sub.knownChunkVersions.entries()) {
        const coords = decodeChunkKey(key);
        if (!isChunkInAoiWindow(coords.chunkX, coords.chunkY, centerChunkX, centerChunkY, sub.radius)) {
            sub.knownChunkVersions.delete(key);
            sub.knownChunks.delete(key);
        }
    }

    const pending: ChunkSubscription['pendingChunks'] = [];
    const keys = new Set<bigint>();
    for (let i = 0; i < sub.pendingChunks.length; i += 1) {
        const next = sub.pendingChunks[i];
        if (!next) {
            continue;
        }
        if (!isChunkInAoiWindow(next.chunkX, next.chunkY, centerChunkX, centerChunkY, sub.radius)) {
            continue;
        }
        const key = makeChunkKey(next.chunkX, next.chunkY);
        if (keys.has(key) || sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key)) {
            continue;
        }
        pending.push(next);
        keys.add(key);
        if (pending.length >= MAX_PENDING_CHUNKS_PER_PLAYER) {
            break;
        }
    }
    sub.pendingChunks = pending;
    sub.pendingChunkKeys.clear();
    keys.forEach((key) => sub.pendingChunkKeys.add(key));

    enforcePendingChunkQueueBounds(sub);
    enforcePendingSnapshotStreamBounds(sub);
}

export function enqueuePendingChunk(
    sub: ChunkSubscription,
    chunkX: number,
    chunkY: number,
    options?: { front?: boolean }
): boolean {
    if (!isChunkInAoiWindow(chunkX, chunkY, sub.lastCenterChunkX, sub.lastCenterChunkY, sub.radius)) {
        return false;
    }

    const key = makeChunkKey(chunkX, chunkY);
    if (sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key) || sub.pendingChunkKeys.has(key)) {
        return false;
    }

    if (options?.front === true) {
        sub.pendingChunks.unshift({ chunkX, chunkY });
    } else {
        sub.pendingChunks.push({ chunkX, chunkY });
    }
    sub.pendingChunkKeys.add(key);
    enforcePendingChunkQueueBounds(sub);
    return sub.pendingChunkKeys.has(key);
}

export function enqueueChunkAoiUpdates(sub: ChunkSubscription, centerChunkX: number, centerChunkY: number): void {
    const radius = sub.radius;
    for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
            enqueuePendingChunk(sub, centerChunkX + dx, centerChunkY + dy);
        }
    }
}

export function extractOverrides(present: Uint8Array, values: Uint32Array, size: number): Array<[number, number, number]> {
    const overrides: Array<[number, number, number]> = [];
    const cellCount = size * size;
    for (let i = 0; i < cellCount; i += 1) {
        if (!present[i]) {
            continue;
        }
        const localX = i % size;
        const localY = Math.floor(i / size);
        const value = values[i];
        if (value === undefined) {
            continue;
        }
        overrides.push([localX, localY, value]);
    }
    return overrides;
}

export function resolveChunkCoords(chunkSize: number, x: number, y: number): { chunkX: number; chunkY: number } {
    const chunkX = Math.floor(x / chunkSize);
    const chunkY = Math.floor(y / chunkSize);
    return { chunkX, chunkY };
}

export type ChunkStreamingWorldHost = Readonly<{
    isPlayerActive(playerId: EntityId): boolean;
    ensureChunkOverlayLoaded?(chunkX: number, chunkY: number): boolean;
}>;

export function replicateChunkSnapshots({
    world,
    outbox,
    overlays,
    chunkAoi,
    getPlayerPosition,
    maxChunkSnapshotPayloadUtf8Bytes,
    maxChunkSnapshotParts,
    maxSnapshotsPerTickPerPlayer,
}: {
    world: ChunkStreamingWorldHost;
    outbox: Queue<OutboxMessage>;
    overlays: ChunkOverlayStore;
    chunkAoi: ChunkAoiState;
    getPlayerPosition: (playerId: EntityId) => GridPos | undefined;
    maxChunkSnapshotPayloadUtf8Bytes: number;
    maxChunkSnapshotParts: number;
    maxSnapshotsPerTickPerPlayer: number;
}): void {
    for (const [playerId, sub] of chunkAoi.byPlayerId.entries()) {
        if (!world.isPlayerActive(playerId)) {
            chunkAoi.byPlayerId.delete(playerId);
            continue;
        }

        const pos = getPlayerPosition(playerId);
        if (!pos) {
            continue;
        }
        const center = resolveChunkCoords(overlays.chunkSize, pos.x, pos.y);

        if (sub.lastCenterChunkX !== center.chunkX || sub.lastCenterChunkY !== center.chunkY) {
            sub.lastCenterChunkX = center.chunkX;
            sub.lastCenterChunkY = center.chunkY;
            pruneChunkSubscriptionWindow(sub, center.chunkX, center.chunkY);
            enqueueChunkAoiUpdates(sub, center.chunkX, center.chunkY);
        } else {
            pruneChunkSubscriptionWindow(sub, center.chunkX, center.chunkY);
        }

        let sent = 0;
	        while (sent < maxSnapshotsPerTickPerPlayer) {
	            const inflight = sub.pendingSnapshotParts[0] ?? null;
	            if (inflight) {
	                const partIndex = inflight.nextPartIndex;
	                const payloadBytes = inflight.parts[partIndex] ?? null;
	                if (payloadBytes === null) {
	                    sub.pendingSnapshotParts.shift();
	                    sub.inFlightSnapshotKeys.delete(inflight.key);
	                    continue;
	                }

	                outbox.push({
	                    kind: 'to_player',
	                    playerId,
	                    action: buildChunkSnapshotPartAction(
	                        inflight.chunkX,
	                        inflight.chunkY,
	                        inflight.version,
	                        partIndex,
	                        inflight.parts.length,
	                        payloadBytes
	                    ),
	                });
                inflight.nextPartIndex += 1;
                sent += 1;

                if (inflight.nextPartIndex >= inflight.parts.length) {
                    sub.pendingSnapshotParts.shift();
                    sub.inFlightSnapshotKeys.delete(inflight.key);
                    sub.knownChunks.add(inflight.key);
                    sub.knownChunkVersions.set(inflight.key, inflight.version);
                }
                continue;
            }

            const next = sub.pendingChunks.shift();
            if (!next) {
                break;
            }
            const key = makeChunkKey(next.chunkX, next.chunkY);
            sub.pendingChunkKeys.delete(key);
            if (sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key)) {
                continue;
            }

            world.ensureChunkOverlayLoaded?.(next.chunkX, next.chunkY);
            const chunk = overlays.getChunk(next.chunkX, next.chunkY);
            const version = chunk?.version ?? 0;
	            const overrides = chunk ? extractOverrides(chunk.present, chunk.values, chunk.size) : [];

	            const encoded = (() => {
	                try {
	                    return encodeChunkSnapshotPayloadBinary({
	                        chunkSize: overlays.chunkSize,
	                        overrides,
	                        maxBytes: maxChunkSnapshotPayloadUtf8Bytes,
	                    });
	                } catch (_) {
	                    return null;
	                }
	            })();

	            if (encoded !== null) {
	                outbox.push({
	                    kind: 'to_player',
	                    playerId,
	                    action: buildChunkSnapshotAction(next.chunkX, next.chunkY, version, encoded),
	                });
	                sub.knownChunks.add(key);
	                sub.knownChunkVersions.set(key, version);
	                sent += 1;
	                continue;
	            }

	            let parts: number[][];
	            try {
	                parts = encodeChunkSnapshotPayloadBinaryParts({
	                    chunkSize: overlays.chunkSize,
	                    overrides,
	                    maxBytes: maxChunkSnapshotPayloadUtf8Bytes,
	                });
	            } catch (_) {
	                enqueuePendingChunk(sub, next.chunkX, next.chunkY);
	                sent += 1;
	                continue;
	            }

	            if (parts.length <= 1) {
	                const payloadBytes = parts[0] ?? null;
	                if (payloadBytes === null) {
	                    continue;
	                }
	                outbox.push({
	                    kind: 'to_player',
	                    playerId,
	                    action: buildChunkSnapshotAction(next.chunkX, next.chunkY, version, payloadBytes),
	                });
	                sub.knownChunks.add(key);
	                sub.knownChunkVersions.set(key, version);
	                sent += 1;
	                continue;
	            }

            const overflowParts = parts.length > maxChunkSnapshotParts;
            const queued = enqueueSnapshotPartStream(sub, {
                key,
                chunkX: next.chunkX,
                chunkY: next.chunkY,
                version,
                parts,
                nextPartIndex: 0,
            });
            if (!queued) {
                enqueuePendingChunk(sub, next.chunkX, next.chunkY);
                sent += 1;
                continue;
            }
            if (overflowParts) {
                continue;
            }
        }
    }
}

export function replicateChunkDeltas({
    world,
    outbox,
    overlays,
    chunkAoi,
    maxChunkSnapshotPayloadUtf8Bytes,
    maxChunkSnapshotParts,
    maxChunkDeltaChangesPerMessage,
}: {
    world: ChunkStreamingWorldHost;
    outbox: Queue<OutboxMessage>;
    overlays: ChunkOverlayStore;
    chunkAoi: ChunkAoiState;
    maxChunkSnapshotPayloadUtf8Bytes: number;
    maxChunkSnapshotParts: number;
    maxChunkDeltaChangesPerMessage: number;
}): void {
    const pending = overlays.listChunksWithPendingDelta();
    for (let i = 0; i < pending.length; i += 1) {
        const chunk = pending[i];
        if (!chunk) {
            continue;
        }
        const key = makeChunkKey(chunk.chunkX, chunk.chunkY);
        const delta = overlays.drainPendingDeltaForChunk(chunk.chunkX, chunk.chunkY);
        if (!delta || delta.changes.length === 0) {
            continue;
        }

	        if (delta.changes.length > maxChunkDeltaChangesPerMessage) {
	            const overrides = extractOverrides(chunk.present, chunk.values, chunk.size);
	            const encoded = (() => {
	                try {
	                    return encodeChunkSnapshotPayloadBinary({
	                        chunkSize: overlays.chunkSize,
	                        overrides,
	                        maxBytes: maxChunkSnapshotPayloadUtf8Bytes,
	                    });
	                } catch (_) {
	                    return null;
	                }
	            })();

	            const parts = (() => {
	                if (encoded !== null) {
	                    return null;
	                }
	                try {
	                    return encodeChunkSnapshotPayloadBinaryParts({
	                        chunkSize: overlays.chunkSize,
	                        overrides,
	                        maxBytes: maxChunkSnapshotPayloadUtf8Bytes,
	                    });
	                } catch (_) {
	                    return null;
	                }
	            })();

            for (const [playerId, sub] of chunkAoi.byPlayerId.entries()) {
                if (!world.isPlayerActive(playerId)) {
                    chunkAoi.byPlayerId.delete(playerId);
                    continue;
                }
                if (!sub.knownChunkVersions.has(key)) {
                    continue;
                }
	                if (encoded !== null) {
	                    outbox.push({
	                        kind: 'to_player',
	                        playerId,
	                        action: buildChunkSnapshotAction(chunk.chunkX, chunk.chunkY, chunk.version, encoded),
	                    });
	                    sub.knownChunkVersions.set(key, chunk.version);
	                    continue;
	                }
	                if (!parts || parts.length <= 1) {
	                    continue;
                }
                sub.knownChunkVersions.delete(key);
                if (!sub.inFlightSnapshotKeys.has(key)) {
                    const overflowParts = parts.length > maxChunkSnapshotParts;
                    const queued = enqueueSnapshotPartStream(sub, {
                        key,
                        chunkX: chunk.chunkX,
                        chunkY: chunk.chunkY,
                        version: chunk.version,
                        parts,
                        nextPartIndex: 0,
                    });
                    if (!queued) {
                        enqueuePendingChunk(sub, chunk.chunkX, chunk.chunkY, { front: true });
                    } else if (overflowParts) {
                        continue;
                    }
                }
            }
	            continue;
	        }

	        const payloadBytes = encodeChunkDeltaPayloadBinary({ chunkSize: overlays.chunkSize, changes: delta.changes });
	        for (const [playerId, sub] of chunkAoi.byPlayerId.entries()) {
            if (!world.isPlayerActive(playerId)) {
                chunkAoi.byPlayerId.delete(playerId);
                continue;
            }
            const known = sub.knownChunkVersions.get(key);
            if (known === undefined) {
                continue;
            }
            if (known !== delta.fromVersion) {
                if (known >= delta.toVersion) {
                    continue;
                }
                sub.knownChunks.delete(key);
                sub.knownChunkVersions.delete(key);
                if (!sub.inFlightSnapshotKeys.has(key)) {
                    enqueuePendingChunk(sub, chunk.chunkX, chunk.chunkY, { front: true });
                }
                continue;
            }
	            outbox.push({
	                kind: 'to_player',
	                playerId,
	                action: buildChunkDeltaAction(chunk.chunkX, chunk.chunkY, delta.fromVersion, delta.toVersion, payloadBytes),
	            });
	            sub.knownChunkVersions.set(key, delta.toVersion);
	        }
	    }
	}
