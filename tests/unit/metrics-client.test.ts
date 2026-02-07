import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MetricsClient = require('../../server/js/metrics-client');

type MetricsConfig = {
    memcached_host: string;
    memcached_port: number;
};

const config: MetricsConfig = {
    memcached_host: '127.0.0.1',
    memcached_port: 11211,
};

test('metrics client uses legacy memcache Client API when available', async () => {
    let connectHandler: (() => void) | null = null;
    let setCalls = 0;
    let getCalls = 0;
    const state: { lastSetKey?: string; lastSetValue?: unknown; lastGetKey?: string } = {};
    const readySignals: number[] = [];

    class LegacyClient {
        on(event: string, cb: () => void) {
            if (event === 'connect') {
                connectHandler = cb;
            }
        }
        connect() {
            connectHandler?.();
        }
        set(key: string, value: unknown, cb: () => void) {
            setCalls += 1;
            state.lastSetKey = key;
            state.lastSetValue = value;
            cb();
        }
        get(key: string, cb: (error: unknown, result: string) => void) {
            getCalls += 1;
            state.lastGetKey = key;
            cb(null, '7');
        }
    }

    const client = MetricsClient.createMetricsClient({ Client: LegacyClient }, config, {
        onReady: () => readySignals.push(Date.now()),
    });

    expect(client.clientType).toBe('legacy');
    client.connect();

    expect(readySignals.length).toBe(1);

    const setResult = await new Promise<boolean>((resolve) => client.set('player_count_local', 3, resolve));
    const getResult = await new Promise<string | undefined>((resolve) => client.get('total_players', resolve));

    expect(setResult).toBe(true);
    expect(getResult).toBe('7');
    expect(setCalls).toBe(1);
    expect(getCalls).toBe(1);
    expect(state.lastSetKey).toBe('player_count_local');
    expect(state.lastSetValue).toBe(3);
    expect(state.lastGetKey).toBe('total_players');
});

test('metrics client uses modern Memcache API and resolves connect/set/get promises', async () => {
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

        async connect() {
            this.connectHandler?.();
        }

        async set(key: string, value: unknown) {
            keys.push(`${key}:${String(value)}`);
            return true;
        }

        async get(key: string) {
            keys.push(key);
            return '9';
        }
    }

    const client = MetricsClient.createMetricsClient({ Memcache: ModernMemcacheClient }, config, {
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
        async connect() {
            throw new Error('connect refused');
        }
        async set() {
            return true;
        }
        async get() {
            return '0';
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
        async connect() {}
        async set() {
            throw new Error('write timeout');
        }
        async get() {
            throw new Error('read timeout');
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

test('metrics client surfaces legacy read/write callback errors through onOperationError hook', async () => {
    const operationErrors: Array<{ operation?: string; key?: string; error?: string }> = [];
    let connectHandler: (() => void) | null = null;

    class LegacyClient {
        on(event: string, cb: () => void) {
            if (event === 'connect') {
                connectHandler = cb;
            }
        }
        connect() {
            connectHandler?.();
        }
        set(_key: string, _value: unknown, cb: (error?: unknown) => void) {
            cb(new Error('legacy write failed'));
        }
        get(_key: string, cb: (error: unknown, result?: string) => void) {
            cb(new Error('legacy read failed'));
        }
    }

    const client = MetricsClient.createMetricsClient({ Client: LegacyClient }, config, {
        onOperationError: (details: { operation?: string; key?: string; error?: string }) =>
            operationErrors.push(details),
    });

    client.connect();

    const setResult = await new Promise<boolean>((resolve) => client.set('player_count_local', 2, resolve));
    const getResult = await new Promise<string | undefined>((resolve) => client.get('total_players', resolve));

    expect(setResult).toBe(false);
    expect(getResult).toBeUndefined();
    expect(operationErrors.length).toBe(2);
    expect(operationErrors[0].operation).toBe('write');
    expect(operationErrors[0].key).toBe('player_count_local');
    expect(operationErrors[0].error).toContain('legacy write failed');
    expect(operationErrors[1].operation).toBe('read');
    expect(operationErrors[1].key).toBe('total_players');
    expect(operationErrors[1].error).toContain('legacy read failed');
});
