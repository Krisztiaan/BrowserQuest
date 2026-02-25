import type { EntityId } from '../../../shared/domain/ids';
import { createResourceKey } from '../../ecs/resources';

export type ChunkSubscription = {
    radius: number;
    lastMapId: string | null;
    lastCenterChunkX: number | null;
    lastCenterChunkY: number | null;
    knownChunks: Set<string>;
    knownChunkVersions: Map<string, number>;
    pendingChunks: Array<{ mapId: string; chunkX: number; chunkY: number }>;
    pendingChunkKeys: Set<string>;
    inFlightSnapshotKeys: Set<string>;
    pendingSnapshotParts: Array<{
        key: string;
        mapId: string;
        chunkX: number;
        chunkY: number;
        version: number;
        parts: number[][];
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
