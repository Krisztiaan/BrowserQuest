import type { EntityId } from '../../../shared/domain/ids';
import { createResourceKey } from '../../ecs/resources';

export type ChunkSubscription = {
    radius: number;
    lastCenterChunkX: number | null;
    lastCenterChunkY: number | null;
    knownChunks: Set<bigint>;
    knownChunkVersions: Map<bigint, number>;
    pendingChunks: Array<{ chunkX: number; chunkY: number }>;
    pendingChunkKeys: Set<bigint>;
    inFlightSnapshotKeys: Set<bigint>;
    pendingSnapshotParts: Array<{
        key: bigint;
        chunkX: number;
        chunkY: number;
        version: number;
        parts: string[];
        nextPartIndex: number;
    }>;
};

export type ChunkAoiState = Readonly<{
    byPlayerId: Map<EntityId, ChunkSubscription>;
}>;

export const CHUNK_AOI_STATE_RESOURCE = createResourceKey<ChunkAoiState>('chunk_aoi_state');

export function createChunkAoiState(): ChunkAoiState {
    return { byPlayerId: new Map() };
}
