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

function createFakeMemjs({
    onSet,
    onGet,
}: {
    onSet?: (key: string, value: string) => Promise<boolean> | boolean;
    onGet?: (key: string) => Promise<Buffer | null> | Buffer | null;
} = {}) {
    const calls: string[] = [];
    const created: string[] = [];
    const module = {
        Client: {
            create(servers: string) {
                created.push(servers);
                return {
                    async set(key: string, value: string): Promise<boolean> {
                        calls.push(`set:${key}:${value}`);
                        return onSet ? onSet(key, value) : true;
                    },
                    async get(key: string): Promise<{ value: Buffer | null }> {
                        calls.push(`get:${key}`);
                        const value = onGet ? await onGet(key) : null;
                        return { value };
                    },
                };
            },
        },
    };
    return { module, calls, created };
}

test('metrics client creates a memjs client for the configured endpoint and round-trips values', async () => {
    const fake = createFakeMemjs({ onGet: () => Buffer.from('9') });
    const client = MetricsClient.createMetricsClient(fake.module, config);

    expect(client.endpoint).toBe('127.0.0.1:11211');
    expect(fake.created).toEqual(['127.0.0.1:11211']);

    await client.connect();
    const setResult = await client.setString('player_count_local', '4');
    const getResult = await client.getString('total_players');

    expect(setResult).toBe(true);
    expect(getResult).toBe('9');
    expect(fake.calls).toContain('set:player_count_local:4');
    expect(fake.calls).toContain('get:total_players');
});

test('metrics client supports the default-export module shape', async () => {
    const fake = createFakeMemjs({ onGet: () => Buffer.from('11') });
    const client = MetricsClient.createMetricsClient({ default: fake.module }, config);
    expect(await client.getString('total_players')).toBe('11');
});

test('metrics client throws on unsupported module shape', () => {
    expect(() => {
        MetricsClient.createMetricsClient({}, config);
    }).toThrow('Unsupported memjs client API');
});

test('metrics client connect bubbles connection failures via the probe read', async () => {
    const fake = createFakeMemjs({
        onGet: () => {
            throw new Error('connect refused');
        },
    });
    const client = MetricsClient.createMetricsClient(fake.module, config);
    try {
        await client.connect();
        throw new Error('expected client.connect to reject');
    } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain('connect refused');
    }
});

test('metrics client maps missing values to undefined and enforces boolean set results', async () => {
    const fake = createFakeMemjs({
        onSet: () => 'ok' as never,
        onGet: () => null,
    });
    const client = MetricsClient.createMetricsClient(fake.module, config);
    expect(await client.getString('absent')).toBeUndefined();
    try {
        await client.setString('k', 'v');
        throw new Error('expected client.setString to reject');
    } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain('non-boolean');
    }
});
