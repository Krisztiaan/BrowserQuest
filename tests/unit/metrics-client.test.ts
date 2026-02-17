import { expect, test } from 'bun:test';
import MetricsClient from '../../server/metrics-client';

type MetricsConfig = {
    memcached_host: string;
    memcached_port: number;
};

const config: MetricsConfig = {
    memcached_host: '127.0.0.1',
    memcached_port: 11211,
};

test('metrics client uses named Memcache export and exposes typed store methods', async () => {
    const writes: string[] = [];

    class ModernMemcacheClient {
        endpoint: string;
        constructor(endpoint: string) {
            this.endpoint = endpoint;
        }
        connect(): Promise<void> {
            return Promise.resolve();
        }
        set(key: string, value: string): Promise<boolean> {
            writes.push(`${key}:${value}`);
            return Promise.resolve(true);
        }
        get(key: string): Promise<string | undefined> {
            writes.push(`get:${key}`);
            return Promise.resolve('9');
        }
    }

    const client = MetricsClient.createMetricsClient({ Memcache: ModernMemcacheClient }, config);
    expect(client.endpoint).toBe('127.0.0.1:11211');
    await client.connect();

    const setResult = await client.setString('player_count_local', '4');
    const getResult = await client.getString('total_players');

    expect(setResult).toBe(true);
    expect(getResult).toBe('9');
    expect(writes).toContain('player_count_local:4');
    expect(writes).toContain('get:total_players');
});

test('metrics client supports default Memcache export', async () => {
    class ModernMemcacheClient {
        endpoint: string;
        constructor(endpoint: string) {
            this.endpoint = endpoint;
        }
        connect(): Promise<void> {
            return Promise.resolve();
        }
        set(_key: string, _value: string): Promise<boolean> {
            return Promise.resolve(true);
        }
        get(_key: string): Promise<string | undefined> {
            return Promise.resolve('11');
        }
    }

    const client = MetricsClient.createMetricsClient({ default: ModernMemcacheClient }, config);
    await client.connect();
    expect(await client.getString('total_players')).toBe('11');
});

test('metrics client throws on unsupported memcache module shape', () => {
    expect(() => {
        MetricsClient.createMetricsClient({}, config);
    }).toThrow('Unsupported memcache client API');
});

test('metrics client bubbles connect failure', async () => {
    class ModernMemcacheClient {
        constructor(_endpoint: string) {}
        connect(): Promise<void> {
            return Promise.reject(new Error('connect refused'));
        }
        set(_key: string, _value: string): Promise<boolean> {
            return Promise.resolve(true);
        }
        get(_key: string): Promise<string | undefined> {
            return Promise.resolve(undefined);
        }
    }

    const client = MetricsClient.createMetricsClient({ Memcache: ModernMemcacheClient }, config);
    try {
        await client.connect();
        throw new Error('expected client.connect to reject');
    } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain('connect refused');
    }
});

test('metrics client enforces strict result types for set/get', async () => {
    class ModernMemcacheClient {
        constructor(_endpoint: string) {}
        connect(): Promise<void> {
            return Promise.resolve();
        }
        set(_key: string, _value: string): Promise<boolean> {
            return Promise.resolve('ok' as never);
        }
        get(_key: string): Promise<string | undefined> {
            return Promise.resolve(123 as never);
        }
    }

    const client = MetricsClient.createMetricsClient({ Memcache: ModernMemcacheClient }, config);
    await client.connect();
    try {
        await client.setString('k', 'v');
        throw new Error('expected client.setString to reject');
    } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain('non-boolean');
    }
    try {
        await client.getString('k');
        throw new Error('expected client.getString to reject');
    } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain('non-string');
    }
});
