import type { RuntimeEventName } from './server-event-names';
import type { EntityId } from '../shared/domain/ids';
import type { ServerPlugin } from './plugins/contracts';

export type RuntimeEventFieldValue =
    | string
    | number
    | boolean
    | null
    | RuntimeEventFieldValue[]
    | { [key: string]: RuntimeEventFieldValue };
export type RuntimeEventFields = Record<string, RuntimeEventFieldValue>;
type RuntimeErrorArg = string | Error | object | null | undefined;
export type RuntimeIntervalHandle = ReturnType<typeof setInterval>;
export type RuntimeTimeoutHandle = ReturnType<typeof setTimeout>;

export interface RuntimeLogger {
    info(message: string): void;
    error(message: string): void;
    event(level: string, eventName: RuntimeEventName, fields: RuntimeEventFields): void;
}

export interface RuntimeWorld {
    playerCount: number;
    on(eventName: 'ready' | 'playerAdded' | 'playerRemoved', callback: () => void): void;
    emit(eventName: 'playerConnect', player: RuntimePlayer): void;
    run(mapFilePath: string): void;
    updatePopulation(totalPlayers?: number): void;
}

export interface RuntimeServer {
    on(eventName: 'connect', callback: (connection: RuntimeConnection) => void): void;
    on(eventName: 'error', callback: (...args: RuntimeErrorArg[]) => void): void;
    onRequestStatus(callback: () => string): void;
    onRequestProfilePreview?(callback: (request: Request) => Response): void;
    onRequestPasskeyAuth?(callback: (request: Request) => Response | Promise<Response>): void;
    getConnection(id: string): { send(payload: unknown): void } | undefined;
}

export interface RuntimeConnection {
    id: string;
    accountNameKey?: string;
    listen(callback: (message: unknown) => void): void;
    onClose(callback: () => void): void;
    sendUTF8(payload: string): void;
    close(reason: string): void;
    closeInvalidPayload?(reason: string): void;
}

export interface RuntimeWsModule {
    MultiVersionWebsocketServer: new (port: number) => RuntimeServer;
}

export type RuntimePluginLike = ServerPlugin;

export interface RuntimeWorldServerConstructor {
    new (id: string, capacity: number, server: RuntimeServer, plugins?: readonly RuntimePluginLike[]): RuntimeWorld;
}

export interface RuntimePlayerConstructor {
    new (connection: RuntimeConnection, world: RuntimeWorld): RuntimePlayer;
}

export interface RuntimePlayer {
    id: EntityId;
}

export interface RuntimeMetrics {
    isEnabled: boolean;
    isReady: boolean;
    ready(callback: () => void): void;
    getTotalPlayers(callback: (totalPlayers: number) => void): void;
    updatePlayerCounters(worlds: RuntimeWorld[], callback: (totalPlayers: number) => void): void;
    updateWorldDistribution(distribution: number[]): void;
}

export interface RuntimeMetricsModule {
    createMetrics(config: ServerConfig, emitServerEvent: RuntimeServerEventEmitter): RuntimeMetrics;
}

export interface RuntimeProcessLike {
    env: Record<string, string | undefined>;
    exit(code: number): never;
    on(event: string, handler: (...args: RuntimeErrorArg[]) => void): void;
    off?(event: string, handler: (...args: RuntimeErrorArg[]) => void): void;
    removeListener?(event: string, handler: (...args: RuntimeErrorArg[]) => void): void;
}

export type RuntimeServerEventEmitter = (
    level: string,
    eventName: RuntimeEventName,
    fields: RuntimeEventFields
) => void;

export interface MainRuntimeDependencies {
    ws: RuntimeWsModule;
    WorldServer: RuntimeWorldServerConstructor;
    Player: RuntimePlayerConstructor;
    metricsRuntime: RuntimeMetricsModule;
    logger: RuntimeLogger;
    processObject: RuntimeProcessLike;
    setIntervalFn: (handler: () => void, timeoutMs: number) => RuntimeIntervalHandle;
    setTimeoutFn: (handler: () => void, timeoutMs: number) => RuntimeTimeoutHandle;
    clearIntervalFn: (timerHandle: RuntimeIntervalHandle) => void;
}

export type MainRuntimeDependencyOverrides = Partial<MainRuntimeDependencies>;

export interface MainRuntimeLifecycle {
    cleanup(): void;
}

export interface MainRuntimeOptions {
    dependencies?: MainRuntimeDependencyOverrides;
    onLifecycle?(lifecycle: MainRuntimeLifecycle): void;
}

export interface ServerConfig {
    port: number;
    nb_worlds: number;
    nb_players_per_world: number;
    map_filepath: string;
    metrics_enabled: boolean;
    debug_level: 'error' | 'debug' | 'info';
    plugins?: string[];
    chunk_size?: number;
    player_db_path?: string;
    chunk_overlay_db_path?: string;
    claims_db_path?: string;
    chunk_overlay_flush_interval_ms?: number;
    chunk_overlay_flush_max_chunks?: number;
    chunk_overlay_bootstrap_load_limit_chunks?: number;
    chunk_snapshot_payload_max_utf8_bytes?: number;
    chunk_snapshot_max_parts?: number;
    updates_per_second?: number;
}
