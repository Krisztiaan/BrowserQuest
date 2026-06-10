import type { ServerConfig } from '../runtime-types';
import type { ChunkOverlayStore } from './chunks/chunk-overlay-store';
import type { ClaimsStore } from './claims/claims-store';
import { ChunkFlushScheduler } from './chunks/chunk-flush-scheduler';
import { SqliteChunkOverlayPersistence } from './chunks/chunk-overlay-persistence';
import { SqliteClaimsPersistence } from './claims/claims-persistence';

type ChunkFlushConfig = Readonly<{
    flushIntervalMs: number;
    maxChunksPerFlush: number;
    loadLimitChunks: number;
}>;

type PersistenceEnv = Readonly<{
    BQ_CHUNK_OVERLAY_DB_PATH?: string;
    BQ_CLAIMS_DB_PATH?: string;
    BQ_CHUNK_OVERLAY_FLUSH_INTERVAL_MS?: string;
    BQ_CHUNK_OVERLAY_FLUSH_MAX_CHUNKS?: string;
    BQ_CHUNK_OVERLAY_BOOTSTRAP_LOAD_LIMIT_CHUNKS?: string;
}>;

type OpenWorldPersistenceParams = Readonly<{
    worldId: string;
    serverConfig: ServerConfig | null;
    chunkOverlays: ChunkOverlayStore;
    claimsStore: ClaimsStore;
    env?: PersistenceEnv;
}>;

export type OpenWorldPersistenceResult = Readonly<{
    chunkOverlayPersistence: SqliteChunkOverlayPersistence;
    chunkFlushScheduler: ChunkFlushScheduler;
    claimsPersistence: SqliteClaimsPersistence;
}>;

function resolveWorldScopedDbPath(configured: string | undefined, fallbackPath: string, worldId: string): string {
    const trimmed = typeof configured === 'string' ? configured.trim() : '';
    const resolvedPath = trimmed.length === 0 ? fallbackPath : trimmed;
    return resolvedPath.replaceAll('{world}', worldId).replaceAll('{worldId}', worldId);
}

function resolveChunkOverlayDbPath(worldId: string, serverConfig: ServerConfig | null, env: PersistenceEnv): string {
    const configuredFromEnv =
        typeof env.BQ_CHUNK_OVERLAY_DB_PATH === 'string' ? env.BQ_CHUNK_OVERLAY_DB_PATH.trim() : '';
    const configuredPath = configuredFromEnv.length > 0 ? configuredFromEnv : serverConfig?.chunk_overlay_db_path;
    const fallbackPath = `./server/.data/chunk-overlays.${worldId}.sqlite`;
    return resolveWorldScopedDbPath(configuredPath, fallbackPath, worldId);
}

function resolveClaimsDbPath(worldId: string, serverConfig: ServerConfig | null, env: PersistenceEnv): string {
    const configuredFromEnv = typeof env.BQ_CLAIMS_DB_PATH === 'string' ? env.BQ_CLAIMS_DB_PATH.trim() : '';
    const configuredPath = configuredFromEnv.length > 0 ? configuredFromEnv : serverConfig?.claims_db_path;
    const fallbackPath = `./server/.data/claims.${worldId}.sqlite`;
    return resolveWorldScopedDbPath(configuredPath, fallbackPath, worldId);
}

function parsePositiveInteger(value: string | undefined): number | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function resolveChunkFlushConfig(serverConfig: ServerConfig | null, env: PersistenceEnv): ChunkFlushConfig {
    const flushIntervalFromEnv = parsePositiveInteger(env.BQ_CHUNK_OVERLAY_FLUSH_INTERVAL_MS);
    const maxChunksFromEnv = parsePositiveInteger(env.BQ_CHUNK_OVERLAY_FLUSH_MAX_CHUNKS);
    const loadLimitFromEnv = parsePositiveInteger(env.BQ_CHUNK_OVERLAY_BOOTSTRAP_LOAD_LIMIT_CHUNKS);

    const flushIntervalMs = flushIntervalFromEnv ?? serverConfig?.chunk_overlay_flush_interval_ms ?? 10_000;
    const maxChunksPerFlush = maxChunksFromEnv ?? serverConfig?.chunk_overlay_flush_max_chunks ?? 64;
    const loadLimitChunks = loadLimitFromEnv ?? serverConfig?.chunk_overlay_bootstrap_load_limit_chunks ?? 4096;

    return Object.freeze({
        flushIntervalMs,
        maxChunksPerFlush,
        loadLimitChunks,
    });
}

export function openWorldPersistence(params: OpenWorldPersistenceParams): OpenWorldPersistenceResult {
    const env = params.env ?? (process.env as PersistenceEnv);
    const chunkDbPath = resolveChunkOverlayDbPath(params.worldId, params.serverConfig, env);
    const claimsDbPath = resolveClaimsDbPath(params.worldId, params.serverConfig, env);
    const flushConfig = resolveChunkFlushConfig(params.serverConfig, env);

    const chunkOverlayPersistence = new SqliteChunkOverlayPersistence(chunkDbPath);
    chunkOverlayPersistence.loadRecentIntoStore(params.chunkOverlays, { limitChunks: flushConfig.loadLimitChunks });

    const chunkFlushScheduler = new ChunkFlushScheduler({
        store: params.chunkOverlays,
        persistence: chunkOverlayPersistence,
        config: {
            flushIntervalMs: flushConfig.flushIntervalMs,
            maxChunksPerFlush: flushConfig.maxChunksPerFlush,
        },
    });

    const claimsPersistence = new SqliteClaimsPersistence(claimsDbPath);
    params.claimsStore.loadClaims(claimsPersistence.loadAllClaims());

    return Object.freeze({
        chunkOverlayPersistence,
        chunkFlushScheduler,
        claimsPersistence,
    });
}

export function flushChunkPersistenceOnShutdown(
    chunkFlushScheduler: ChunkFlushScheduler | null,
    onError: (error: unknown) => void
): void {
    try {
        chunkFlushScheduler?.flushAllNow();
    } catch (error) {
        onError(error);
    }
}

export function closeWorldPersistence(
    chunkOverlayPersistence: SqliteChunkOverlayPersistence | null,
    claimsPersistence: SqliteClaimsPersistence | null,
    onError: (target: 'chunk_overlays' | 'claims', error: unknown) => void
): void {
    try {
        chunkOverlayPersistence?.close();
    } catch (error) {
        onError('chunk_overlays', error);
    }

    try {
        claimsPersistence?.close();
    } catch (error) {
        onError('claims', error);
    }
}
