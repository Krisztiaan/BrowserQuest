import type { ChunkAoiState, ChunkSubscription } from '../chunks/chunk-aoi';
import { makeScopedChunkKey } from '../chunks/chunk-overlay-store';
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

type PendingChunkEntry = ChunkSubscription['pendingChunks'][number];
type PendingSnapshotStream = ChunkSubscription['pendingSnapshotParts'][number];

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

function unreadPendingChunkCount(sub: ChunkSubscription): number {
    const unread = sub.pendingChunks.length - sub.pendingChunksHead;
    return Math.max(0, unread) + sub.pendingPriorityChunks.length;
}

function compactPendingChunks(sub: ChunkSubscription): void {
    if (sub.pendingChunksHead <= 0) {
        return;
    }
    if (sub.pendingChunksHead >= sub.pendingChunks.length) {
        sub.pendingChunks.length = 0;
        sub.pendingChunksHead = 0;
        return;
    }
    sub.pendingChunks = sub.pendingChunks.slice(sub.pendingChunksHead);
    sub.pendingChunksHead = 0;
}

function maybeCompactPendingChunks(sub: ChunkSubscription): void {
    const unread = sub.pendingChunks.length - sub.pendingChunksHead;
    if (sub.pendingChunksHead >= 128 && sub.pendingChunksHead >= unread) {
        compactPendingChunks(sub);
    }
}

function pushPendingChunk(sub: ChunkSubscription, entry: PendingChunkEntry, front: boolean): void {
    if (front) {
        // Front inserts must outrank normal FIFO entries without O(N) unshift.
        sub.pendingPriorityChunks.push(entry);
        return;
    }
    sub.pendingChunks.push(entry);
}

function popPendingChunk(sub: ChunkSubscription): PendingChunkEntry | undefined {
    const priority = sub.pendingPriorityChunks.pop();
    if (priority) {
        return priority;
    }
    while (sub.pendingChunksHead < sub.pendingChunks.length) {
        const next = sub.pendingChunks[sub.pendingChunksHead];
        sub.pendingChunksHead += 1;
        if (!next) {
            continue;
        }
        maybeCompactPendingChunks(sub);
        return next;
    }
    compactPendingChunks(sub);
    return undefined;
}

function dropNewestPendingChunk(sub: ChunkSubscription): PendingChunkEntry | undefined {
    if (sub.pendingChunks.length > sub.pendingChunksHead) {
        const dropped = sub.pendingChunks.pop();
        if (sub.pendingChunksHead > sub.pendingChunks.length) {
            sub.pendingChunksHead = sub.pendingChunks.length;
        }
        return dropped;
    }
    return sub.pendingPriorityChunks.pop();
}

function compactPendingSnapshotParts(sub: ChunkSubscription): void {
    if (sub.pendingSnapshotPartsHead <= 0) {
        return;
    }
    if (sub.pendingSnapshotPartsHead >= sub.pendingSnapshotParts.length) {
        sub.pendingSnapshotParts.length = 0;
        sub.pendingSnapshotPartsHead = 0;
        return;
    }
    sub.pendingSnapshotParts = sub.pendingSnapshotParts.slice(sub.pendingSnapshotPartsHead);
    sub.pendingSnapshotPartsHead = 0;
}

function maybeCompactPendingSnapshotParts(sub: ChunkSubscription): void {
    const unread = sub.pendingSnapshotParts.length - sub.pendingSnapshotPartsHead;
    if (sub.pendingSnapshotPartsHead >= 32 && sub.pendingSnapshotPartsHead >= unread) {
        compactPendingSnapshotParts(sub);
    }
}

function peekPendingSnapshotPart(sub: ChunkSubscription): PendingSnapshotStream | undefined {
    while (sub.pendingSnapshotPartsHead < sub.pendingSnapshotParts.length) {
        const stream = sub.pendingSnapshotParts[sub.pendingSnapshotPartsHead];
        if (stream) {
            return stream;
        }
        sub.pendingSnapshotPartsHead += 1;
    }
    compactPendingSnapshotParts(sub);
    return undefined;
}

function popPendingSnapshotPart(sub: ChunkSubscription): PendingSnapshotStream | undefined {
    const stream = peekPendingSnapshotPart(sub);
    if (!stream) {
        return undefined;
    }
    sub.pendingSnapshotPartsHead += 1;
    maybeCompactPendingSnapshotParts(sub);
    return stream;
}

function iterPendingChunks(sub: ChunkSubscription, each: (entry: PendingChunkEntry) => void): void {
    // Priority entries are LIFO to match previous unshift+shift behavior.
    for (let i = sub.pendingPriorityChunks.length - 1; i >= 0; i -= 1) {
        const entry = sub.pendingPriorityChunks[i];
        if (entry) {
            each(entry);
        }
    }
    for (let i = sub.pendingChunksHead; i < sub.pendingChunks.length; i += 1) {
        const entry = sub.pendingChunks[i];
        if (entry) {
            each(entry);
        }
    }
}

function clearChunkSubscriptionState(sub: ChunkSubscription, mapId: string, centerChunkX: number | null, centerChunkY: number | null): void {
    sub.lastMapId = mapId;
    sub.lastCenterChunkX = centerChunkX;
    sub.lastCenterChunkY = centerChunkY;
    sub.knownChunks.clear();
    sub.knownChunkVersions.clear();
    sub.pendingChunks.length = 0;
    sub.pendingChunksHead = 0;
    sub.pendingPriorityChunks.length = 0;
    sub.pendingChunkKeys.clear();
    sub.inFlightSnapshotKeys.clear();
    sub.pendingSnapshotParts.length = 0;
    sub.pendingSnapshotPartsHead = 0;
}

function enforcePendingChunkQueueBounds(sub: ChunkSubscription): void {
    while (unreadPendingChunkCount(sub) > MAX_PENDING_CHUNKS_PER_PLAYER) {
        const dropped = dropNewestPendingChunk(sub);
        if (!dropped) {
            break;
        }
        sub.pendingChunkKeys.delete(makeScopedChunkKey(dropped.mapId, dropped.chunkX, dropped.chunkY));
    }
    maybeCompactPendingChunks(sub);
}

function enforcePendingSnapshotStreamBounds(sub: ChunkSubscription): void {
    const kept: ChunkSubscription['pendingSnapshotParts'] = [];
    const keys = new Set<string>();
    let totalParts = 0;

    for (let i = sub.pendingSnapshotPartsHead; i < sub.pendingSnapshotParts.length; i += 1) {
        const stream = sub.pendingSnapshotParts[i];
        if (!stream) {
            continue;
        }

        if (
            stream.mapId !== sub.lastMapId
            || !isChunkInAoiWindow(stream.chunkX, stream.chunkY, sub.lastCenterChunkX, sub.lastCenterChunkY, sub.radius)
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
    sub.pendingSnapshotPartsHead = 0;
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

export function pruneChunkSubscriptionWindow(sub: ChunkSubscription, mapId: string, centerChunkX: number, centerChunkY: number): void {
    for (const key of sub.knownChunks) {
        if (!key.startsWith(`${mapId}:`)) {
            sub.knownChunks.delete(key);
            sub.knownChunkVersions.delete(key);
            continue;
        }
        const chunkPart = key.slice(mapId.length + 1);
        const splitIndex = chunkPart.indexOf(':');
        if (splitIndex < 0) {
            continue;
        }
        const chunkX = Number.parseInt(chunkPart.slice(0, splitIndex), 10);
        const chunkY = Number.parseInt(chunkPart.slice(splitIndex + 1), 10);
        if (!Number.isSafeInteger(chunkX) || !Number.isSafeInteger(chunkY)) {
            continue;
        }
        if (!isChunkInAoiWindow(chunkX, chunkY, centerChunkX, centerChunkY, sub.radius)) {
            sub.knownChunks.delete(key);
            sub.knownChunkVersions.delete(key);
        }
    }

    for (const [key] of sub.knownChunkVersions.entries()) {
        if (!key.startsWith(`${mapId}:`)) {
            sub.knownChunkVersions.delete(key);
            sub.knownChunks.delete(key);
        }
    }

    const pending: ChunkSubscription['pendingChunks'] = [];
    const keys = new Set<string>();
    iterPendingChunks(sub, (next) => {
        if (next.mapId !== mapId) {
            return;
        }
        if (!isChunkInAoiWindow(next.chunkX, next.chunkY, centerChunkX, centerChunkY, sub.radius)) {
            return;
        }
        const key = makeScopedChunkKey(next.mapId, next.chunkX, next.chunkY);
        if (keys.has(key) || sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key)) {
            return;
        }
        pending.push(next);
        keys.add(key);
    });
    sub.pendingChunks = pending;
    sub.pendingChunksHead = 0;
    sub.pendingPriorityChunks.length = 0;
    sub.pendingChunkKeys.clear();
    keys.forEach((key) => sub.pendingChunkKeys.add(key));

    enforcePendingChunkQueueBounds(sub);
    enforcePendingSnapshotStreamBounds(sub);
}

export function enqueuePendingChunk(
    sub: ChunkSubscription,
    mapId: string,
    chunkX: number,
    chunkY: number,
    options?: { front?: boolean }
): boolean {
    if (sub.lastMapId !== mapId) {
        return false;
    }
    if (!isChunkInAoiWindow(chunkX, chunkY, sub.lastCenterChunkX, sub.lastCenterChunkY, sub.radius)) {
        return false;
    }

    const key = makeScopedChunkKey(mapId, chunkX, chunkY);
    if (sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key) || sub.pendingChunkKeys.has(key)) {
        return false;
    }

    const entry = { mapId, chunkX, chunkY };
    pushPendingChunk(sub, entry, options?.front === true);
    sub.pendingChunkKeys.add(key);
    enforcePendingChunkQueueBounds(sub);
    return sub.pendingChunkKeys.has(key);
}

export function enqueueChunkAoiUpdates(sub: ChunkSubscription, mapId: string, centerChunkX: number, centerChunkY: number): void {
    const radius = sub.radius;
    for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
            enqueuePendingChunk(sub, mapId, centerChunkX + dx, centerChunkY + dy);
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
    ensureChunkOverlayLoaded?(mapId: string, chunkX: number, chunkY: number): boolean;
}>;

export function replicateChunkSnapshots({
    world,
    outbox,
    overlays,
    chunkAoi,
    getPlayerPosition,
    getPlayerMapId,
    maxChunkSnapshotPayloadUtf8Bytes,
    maxChunkSnapshotParts,
    maxSnapshotsPerTickPerPlayer,
}: {
    world: ChunkStreamingWorldHost;
    outbox: Queue<OutboxMessage>;
    overlays: ChunkOverlayStore;
    chunkAoi: ChunkAoiState;
    getPlayerPosition: (playerId: EntityId) => GridPos | undefined;
    getPlayerMapId: (playerId: EntityId) => string;
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
        const mapId = getPlayerMapId(playerId);
        const center = resolveChunkCoords(overlays.chunkSize, pos.x, pos.y);

        if (sub.lastMapId !== mapId) {
            clearChunkSubscriptionState(sub, mapId, center.chunkX, center.chunkY);
            enqueueChunkAoiUpdates(sub, mapId, center.chunkX, center.chunkY);
        } else if (sub.lastCenterChunkX !== center.chunkX || sub.lastCenterChunkY !== center.chunkY) {
            sub.lastCenterChunkX = center.chunkX;
            sub.lastCenterChunkY = center.chunkY;
            pruneChunkSubscriptionWindow(sub, mapId, center.chunkX, center.chunkY);
            enqueueChunkAoiUpdates(sub, mapId, center.chunkX, center.chunkY);
        } else {
            pruneChunkSubscriptionWindow(sub, mapId, center.chunkX, center.chunkY);
        }

        let sent = 0;
        while (sent < maxSnapshotsPerTickPerPlayer) {
            const inflight = peekPendingSnapshotPart(sub) ?? null;
            if (inflight) {
                const partIndex = inflight.nextPartIndex;
                const payloadBytes = inflight.parts[partIndex] ?? null;
                if (payloadBytes === null) {
                    popPendingSnapshotPart(sub);
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
                    popPendingSnapshotPart(sub);
                    sub.inFlightSnapshotKeys.delete(inflight.key);
                    sub.knownChunks.add(inflight.key);
                    sub.knownChunkVersions.set(inflight.key, inflight.version);
                }
                continue;
            }

            const next = popPendingChunk(sub);
            if (!next) {
                break;
            }
            const key = makeScopedChunkKey(next.mapId, next.chunkX, next.chunkY);
            sub.pendingChunkKeys.delete(key);
            if (sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key)) {
                continue;
            }

            world.ensureChunkOverlayLoaded?.(next.mapId, next.chunkX, next.chunkY);
            const chunk = overlays.getChunk(next.chunkX, next.chunkY, next.mapId);
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
                enqueuePendingChunk(sub, next.mapId, next.chunkX, next.chunkY);
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
                mapId: next.mapId,
                chunkX: next.chunkX,
                chunkY: next.chunkY,
                version,
                parts,
                nextPartIndex: 0,
            });
            if (!queued) {
                enqueuePendingChunk(sub, next.mapId, next.chunkX, next.chunkY);
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
        const key = makeScopedChunkKey(chunk.mapId, chunk.chunkX, chunk.chunkY);
        const delta = overlays.drainPendingDeltaForChunk(chunk.chunkX, chunk.chunkY, chunk.mapId);
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
                if (sub.lastMapId !== chunk.mapId) {
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
                        mapId: chunk.mapId,
                        chunkX: chunk.chunkX,
                        chunkY: chunk.chunkY,
                        version: chunk.version,
                        parts,
                        nextPartIndex: 0,
                    });
                    if (!queued) {
                        enqueuePendingChunk(sub, chunk.mapId, chunk.chunkX, chunk.chunkY, { front: true });
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
            if (sub.lastMapId !== chunk.mapId) {
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
                    enqueuePendingChunk(sub, chunk.mapId, chunk.chunkX, chunk.chunkY, { front: true });
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
