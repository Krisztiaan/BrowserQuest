import * as memcacheModule from 'memcache';
import MetricsClient, { type MetricsStoreClient } from './metrics-client';
import Log from './log';
import { Evented } from '../shared/evented';
import type { RuntimeEventFields } from './runtime-types';

const log = Log.getLogger();

interface MetricsConfig {
    memcached_host: string;
    memcached_port: number | string;
    server_name: string;
    game_servers?: Array<{ name: string }>;
}

interface RuntimeOptions {
    onReady?: () => void;
    onUnavailable?: (reason: string, fields: RuntimeEventFields) => void;
    createStore?: (config: MetricsConfig) => MetricsStoreClient;
}

interface WorldLike {
    playerCount: number;
}

type MetricsEvents = {
    ready: [];
};

type UnavailableSignal = Readonly<{
    reason: string;
    operation?: 'connect' | 'read' | 'write';
    key?: string;
}>;

function toMetricInteger(value: string | undefined): number {
    if (typeof value !== 'string') {
        return 0;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeServerNames(config: MetricsConfig): string[] {
    const input = Array.isArray(config.game_servers) ? config.game_servers : [];
    const names = input
        .map((entry) => (typeof entry?.name === 'string' ? entry.name.trim() : ''))
        .filter((name) => name.length > 0);
    if (typeof config.server_name === 'string' && config.server_name.trim().length > 0) {
        names.push(config.server_name.trim());
    }
    return Array.from(new Set(names));
}

class Metrics extends Evented<MetricsEvents> {
    config: MetricsConfig;
    readonly store: MetricsStoreClient;
    isEnabled: boolean;
    isReady: boolean;
    unavailableSignals: Set<string>;
    onUnavailable: (reason: string, fields: RuntimeEventFields) => void;
    onReady: () => void;

    constructor(config: MetricsConfig, options?: RuntimeOptions) {
        super();
        const runtimeOptions = options ?? {};

        this.config = config;
        this.store = (runtimeOptions.createStore ?? ((cfg) => MetricsClient.createMetricsClient(memcacheModule, cfg)))(config);
        this.isEnabled = true;
        this.isReady = false;
        this.unavailableSignals = new Set();
        this.onUnavailable =
            typeof runtimeOptions.onUnavailable === 'function' ? runtimeOptions.onUnavailable : function () {};
        this.onReady = typeof runtimeOptions.onReady === 'function' ? runtimeOptions.onReady : function () {};

        void this.connectStore();
    }

    private signalKey(signal: UnavailableSignal): string {
        return `${signal.reason}:${signal.operation ?? ''}:${signal.key ?? ''}`;
    }

    private reportUnavailable(reason: string, fields: RuntimeEventFields = {}): void {
        const signal: UnavailableSignal = {
            reason,
            operation: fields.operation === 'read' || fields.operation === 'write' || fields.operation === 'connect'
                ? fields.operation
                : undefined,
            key: typeof fields.key === 'string' ? fields.key : undefined,
        };
        const dedupeKey = this.signalKey(signal);
        if (this.unavailableSignals.has(dedupeKey)) {
            return;
        }
        this.unavailableSignals.add(dedupeKey);
        this.onUnavailable(reason, fields);
    }

    private markReady(): void {
        if (this.isReady) {
            return;
        }
        this.isReady = true;
        log.info('Metrics enabled: memcached client connected to ' + this.store.endpoint);
        this.onReady();
        this.emit('ready');
    }

    private async connectStore(): Promise<void> {
        try {
            await this.store.connect();
            this.markReady();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error('Memcached client connect failed: ' + message);
            this.reportUnavailable('connect_failed', {
                operation: 'connect',
                error: message,
            });
        }
    }

    private async setMetricString(key: string, value: string): Promise<boolean> {
        try {
            const ok = await this.store.setString(key, value);
            if (!ok) {
                this.reportUnavailable('write_failed', {
                    operation: 'write',
                    key,
                    error: 'not_stored',
                });
            }
            return ok;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.reportUnavailable('write_failed', {
                operation: 'write',
                key,
                error: message,
            });
            return false;
        }
    }

    private async getMetricString(key: string): Promise<string | undefined> {
        try {
            return await this.store.getString(key);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.reportUnavailable('read_failed', {
                operation: 'read',
                key,
                error: message,
            });
            return undefined;
        }
    }

    private playerCountKey(serverName: string): string {
        return `player_count_${serverName}`;
    }

    private totalPlayersKey(): string {
        return 'total_players';
    }

    private worldDistributionKey(): string {
        return `world_distribution_${this.config.server_name}`;
    }

    ready(callback: () => void): void {
        if (this.isReady) {
            callback();
            return;
        }
        this.once('ready', callback);
    }

    updatePlayerCounters(worlds: WorldLike[], updatedCallback?: (totalPlayers: number) => void): void {
        void this.updatePlayerCountersAsync(worlds, updatedCallback);
    }

    private async updatePlayerCountersAsync(
        worlds: WorldLike[],
        updatedCallback?: (totalPlayers: number) => void
    ): Promise<void> {
        const done = typeof updatedCallback === 'function' ? updatedCallback : () => {};
        if (!this.isReady) {
            return;
        }

        const localPlayerCount = worlds.reduce((sum, world) => sum + world.playerCount, 0);
        const localWriteOk = await this.setMetricString(this.playerCountKey(this.config.server_name), String(localPlayerCount));
        if (!localWriteOk) {
            return;
        }

        const serverNames = normalizeServerNames(this.config);
        if (serverNames.length === 0) {
            await this.setMetricString(this.totalPlayersKey(), String(localPlayerCount));
            done(localPlayerCount);
            return;
        }

        const playerCountReads = await Promise.all(
            serverNames.map(async (serverName) => this.getMetricString(this.playerCountKey(serverName)))
        );
        const totalPlayers = playerCountReads.reduce((sum, raw) => sum + toMetricInteger(raw), 0);

        const totalWriteOk = await this.setMetricString(this.totalPlayersKey(), String(totalPlayers));
        if (totalWriteOk) {
            done(totalPlayers);
        }
    }

    updateWorldDistribution(worlds: number[]): void {
        void this.updateWorldDistributionAsync(worlds);
    }

    private async updateWorldDistributionAsync(worlds: number[]): Promise<void> {
        if (!this.isReady) {
            return;
        }
        const payload = JSON.stringify(worlds);
        await this.setMetricString(this.worldDistributionKey(), payload);
    }

    getTotalPlayers(callback: (result: number) => void): void {
        if (!this.isReady) {
            callback(0);
            return;
        }

        void (async () => {
            const raw = await this.getMetricString(this.totalPlayersKey());
            callback(toMetricInteger(raw));
        })();
    }
}

export default Metrics;
