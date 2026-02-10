import type { RuntimeEventName } from './server-event-names';

export interface RuntimeLogger {
    info(message: string): void;
    error(message: string): void;
    event(level: string, eventName: RuntimeEventName, fields: Record<string, unknown>): void;
}

export interface RuntimeWorld {
    playerCount: number;
    on(eventName: 'playerAdded' | 'playerRemoved', callback: () => void): void;
    emit(eventName: 'playerConnect', player: RuntimePlayer): void;
    run(mapFilePath: string): void;
    updatePopulation(totalPlayers?: number): void;
}

export interface RuntimeServer {
    onConnect(callback: (connection: RuntimeConnection) => void): void;
    onError(callback: (...args: unknown[]) => void): void;
    onRequestStatus(callback: () => string): void;
}

export interface RuntimeConnection {
    close(reason: string): void;
}

export interface RuntimeWsModule {
    MultiVersionWebsocketServer: new (port: number) => RuntimeServer;
}

export interface RuntimeWorldServerConstructor {
    new (id: string, capacity: number, server: RuntimeServer): RuntimeWorld;
}

export interface RuntimePlayerConstructor {
    new (connection: RuntimeConnection, world: RuntimeWorld): RuntimePlayer;
}

export interface RuntimePlayer {
    id?: string | number;
}

export interface RuntimeMetrics {
    isEnabled: boolean;
    isReady: boolean;
    ready(callback: () => void): void;
    getTotalPlayers(callback: (totalPlayers: number) => void): void;
    getOpenWorldCount(callback: (openWorldCount: number | string) => void): void;
    updatePlayerCounters(worlds: RuntimeWorld[], callback: (totalPlayers: number) => void): void;
    updateWorldDistribution(distribution: number[]): void;
}

export interface RuntimeMetricsModule {
    createMetrics(config: ServerConfig, emitServerEvent: RuntimeServerEventEmitter): RuntimeMetrics;
}

export interface RuntimeProcessLike {
    env: Record<string, string | undefined>;
    exit(code: number): never;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off?(event: string, handler: (...args: unknown[]) => void): void;
    removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export type RuntimeServerEventEmitter = (
    level: string,
    eventName: RuntimeEventName,
    fields: Record<string, unknown>
) => void;

export interface MainRuntimeDependencies {
    ws: RuntimeWsModule;
    WorldServer: RuntimeWorldServerConstructor;
    Player: RuntimePlayerConstructor;
    metricsRuntime: RuntimeMetricsModule;
    logger: RuntimeLogger;
    processObject: RuntimeProcessLike;
    setIntervalFn: (handler: () => void, timeoutMs: number) => unknown;
    setTimeoutFn: (handler: () => void, timeoutMs: number) => unknown;
    clearIntervalFn: (timerHandle: unknown) => void;
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
}
