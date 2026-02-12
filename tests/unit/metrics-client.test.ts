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

test('metrics client uses modern Memcache API when available', async () => {
    const readySignals: number[] = [];
    const keys: string[] = [];

    class ModernMemcacheClient {
        endpoint: string;
        connectHandler: (() => void) | null = null;

        constructor(endpoint: string) {
            this.endpoint = endpoint;
        }

        on(event: string, cb: () => void) {
            if (event === 'connect') {
                this.connectHandler = cb;
            }
        }

        connect(): Promise<void> {
            this.connectHandler?.();
            return Promise.resolve();
        }

        set(key: string, value: unknown): Promise<boolean> {
            keys.push(`${key}:${String(value)}`);
            return Promise.resolve(true);
        }

        get(key: string): Promise<string> {
            keys.push(key);
            return Promise.resolve('9');
        }
    }

    const client = MetricsClient.createMetricsClient({ Memcache: ModernMemcacheClient }, config, {
        onReady: () => readySignals.push(Date.now()),
    });

    expect(client.clientType).toBe('modern');
    client.connect();
    await Bun.sleep(0);

    const setResult = await new Promise<boolean>((resolve) => client.set('player_count_local', 4, resolve));
    const getResult = await new Promise<string | undefined>((resolve) => client.get('total_players', resolve));

    expect(setResult).toBe(true);
    expect(getResult).toBe('9');
    expect(keys).toContain('player_count_local:4');
    expect(keys).toContain('total_players');
    expect(readySignals.length).toBeGreaterThan(0);
});

test('metrics client supports modern default export API and resolves connect/set/get promises', async () => {
    const readySignals: number[] = [];
    const errors: string[] = [];
    const keys: string[] = [];

    class ModernMemcacheClient {
        endpoint: string;
        connectHandler: (() => void) | null = null;

        constructor(endpoint: string) {
            this.endpoint = endpoint;
        }

        on(event: string, cb: () => void) {
            if (event === 'connect') {
                this.connectHandler = cb;
            }
        }

        connect(): Promise<void> {
            this.connectHandler?.();
            return Promise.resolve();
        }

        set(key: string, value: unknown): Promise<boolean> {
            keys.push(`${key}:${String(value)}`);
            return Promise.resolve(true);
        }

        get(key: string): Promise<string> {
            keys.push(key);
            return Promise.resolve('9');
        }
    }

    const client = MetricsClient.createMetricsClient({ default: ModernMemcacheClient }, config, {
        onReady: () => readySignals.push(Date.now()),
        onError: (err: unknown) => errors.push(String(err)),
    });

    expect(client.clientType).toBe('modern');
    client.connect();

    await Bun.sleep(0);

    const setResult = await new Promise<boolean>((resolve) => client.set('player_count_local', 4, resolve));
    const getResult = await new Promise<string | undefined>((resolve) => client.get('total_players', resolve));

    expect(setResult).toBe(true);
    expect(getResult).toBe('9');
    expect(keys).toContain('player_count_local:4');
    expect(keys).toContain('total_players');
    expect(readySignals.length).toBeGreaterThan(0);
    expect(errors.length).toBe(0);
});

test('metrics client throws on unsupported memcache module shape', () => {
    expect(() => {
        MetricsClient.createMetricsClient({}, config, {});
    }).toThrow('Unsupported memcache client API');
});

test('metrics client surfaces modern connect failures through onError hook', async () => {
    const errors: string[] = [];

    class ModernMemcacheClient {
        constructor(_endpoint: string) {}
        on(_event: string, _cb: () => void) {}
        connect(): Promise<void> {
            return Promise.reject(new Error('connect refused'));
        }
        set(): Promise<boolean> {
            return Promise.resolve(true);
        }
        get(): Promise<string> {
            return Promise.resolve('0');
        }
    }

    const client = MetricsClient.createMetricsClient({ Memcache: ModernMemcacheClient }, config, {
        onError: (err: unknown) => errors.push(String(err)),
    });

    client.connect();
    await Bun.sleep(0);

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('connect refused');
});

test('metrics client surfaces modern read/write operation failures through onOperationError hook', async () => {
    const operationErrors: Array<{ operation?: string; key?: string; error?: string }> = [];

    class ModernMemcacheClient {
        constructor(_endpoint: string) {}
        on(_event: string, _cb: () => void) {}
        connect(): Promise<void> {
            return Promise.resolve();
        }
        set(): Promise<boolean> {
            return Promise.reject(new Error('write timeout'));
        }
        get(): Promise<string> {
            return Promise.reject(new Error('read timeout'));
        }
    }

    const client = MetricsClient.createMetricsClient({ Memcache: ModernMemcacheClient }, config, {
        onOperationError: (details: { operation?: string; key?: string; error?: string }) =>
            operationErrors.push(details),
    });

    const setResult = await new Promise<boolean>((resolve) => client.set('player_count_local', 1, resolve));
    const getResult = await new Promise<string | undefined>((resolve) => client.get('total_players', resolve));

    expect(setResult).toBe(false);
    expect(getResult).toBeUndefined();
    expect(operationErrors.length).toBe(2);
    expect(operationErrors[0].operation).toBe('write');
    expect(operationErrors[0].key).toBe('player_count_local');
    expect(operationErrors[0].error).toContain('write timeout');
    expect(operationErrors[1].operation).toBe('read');
    expect(operationErrors[1].key).toBe('total_players');
    expect(operationErrors[1].error).toContain('read timeout');
});
