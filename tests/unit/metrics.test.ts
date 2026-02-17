import { expect, test } from 'bun:test';
import Metrics from '../../server/metrics';
import type { MetricsStoreClient } from '../../server/metrics-client';
import type { RuntimeEventFields } from '../../server/runtime-types';

type MetricsConfig = {
    memcached_host: string;
    memcached_port: number;
    server_name: string;
    game_servers: Array<{ name: string }>;
};

class FakeStore implements MetricsStoreClient {
    readonly endpoint = 'fake:11211';
    values = new Map<string, string>();
    writes: Array<{ key: string; value: string }> = [];
    connectError: Error | null = null;

    connect(): Promise<void> {
        if (this.connectError) {
            return Promise.reject(this.connectError);
        }
        return Promise.resolve();
    }

    setString(key: string, value: string): Promise<boolean> {
        this.values.set(key, value);
        this.writes.push({ key, value });
        return Promise.resolve(true);
    }

    getString(key: string): Promise<string | undefined> {
        return Promise.resolve(this.values.get(key));
    }
}

function createConfig(overrides?: Partial<MetricsConfig>): MetricsConfig {
    return {
        memcached_host: '127.0.0.1',
        memcached_port: 11211,
        server_name: 'local',
        game_servers: [{ name: 'local' }, { name: 'other' }],
        ...overrides,
    };
}

test('metrics signals ready once through constructor lifecycle', async () => {
    const store = new FakeStore();
    let readySignals = 0;
    const metrics = new Metrics(createConfig(), {
        createStore: () => store,
        onReady: () => {
            readySignals += 1;
        },
    });

    await new Promise<void>((resolve) => metrics.ready(resolve));
    expect(readySignals).toBe(1);

    await new Promise<void>((resolve) => metrics.ready(resolve));
    expect(readySignals).toBe(1);
    expect(metrics.isReady).toBe(true);
});

test('metrics updatePlayerCounters uses explicit string codec and updates total count', async () => {
    const store = new FakeStore();
    store.values.set('player_count_other', '3');

    const metrics = new Metrics(createConfig(), {
        createStore: () => store,
    });
    await new Promise<void>((resolve) => metrics.ready(resolve));

    const totalPlayers = await new Promise<number>((resolve) => {
        metrics.updatePlayerCounters([{ playerCount: 1 }, { playerCount: 2 }], resolve);
    });

    expect(totalPlayers).toBe(6);
    expect(store.values.get('player_count_local')).toBe('3');
    expect(store.values.get('total_players')).toBe('6');
});

test('metrics updateWorldDistribution stores JSON payload string', async () => {
    const store = new FakeStore();
    const metrics = new Metrics(createConfig(), {
        createStore: () => store,
    });
    await new Promise<void>((resolve) => metrics.ready(resolve));

    metrics.updateWorldDistribution([3, 2, 1]);
    await Bun.sleep(0);

    expect(store.values.get('world_distribution_local')).toBe('[3,2,1]');
});

test('metrics reports connect failure as unavailable signal', async () => {
    const store = new FakeStore();
    store.connectError = new Error('connect refused');
    const unavailable: Array<{ reason: string; fields: RuntimeEventFields }> = [];

    const metrics = new Metrics(createConfig(), {
        createStore: () => store,
        onUnavailable: (reason, fields) => unavailable.push({ reason, fields }),
    });

    await Bun.sleep(0);
    expect(metrics.isReady).toBe(false);
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0]?.reason).toBe('connect_failed');
    expect(unavailable[0]?.fields.operation).toBe('connect');
});
