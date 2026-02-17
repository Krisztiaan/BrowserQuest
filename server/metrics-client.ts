interface MetricsConfig {
    memcached_port: string | number;
    memcached_host: string;
}

interface MemcacheClientLike {
    connect(): Promise<unknown> | unknown;
    set(key: string, value: string): Promise<unknown> | unknown;
    get(key: string): Promise<unknown> | unknown;
}

type MemcacheClientCtor = new (endpoint: string) => MemcacheClientLike;

interface MemcacheModuleShape {
    Memcache?: MemcacheClientCtor;
    default?: MemcacheClientCtor;
}

export interface MetricsStoreClient {
    readonly endpoint: string;
    connect(): Promise<void>;
    setString(key: string, value: string): Promise<boolean>;
    getString(key: string): Promise<string | undefined>;
}

function resolveClientCtor(memcacheModule: MemcacheModuleShape | null | undefined): MemcacheClientCtor {
    const clientCtor = memcacheModule?.Memcache ?? memcacheModule?.default;
    if (typeof clientCtor !== 'function') {
        throw new Error('Unsupported memcache client API');
    }
    return clientCtor;
}

function normalizeEndpoint(config: MetricsConfig): string {
    const host = String(config.memcached_host ?? '').trim();
    const portText = String(config.memcached_port ?? '').trim();
    if (host.length === 0 || portText.length === 0) {
        throw new Error('Invalid memcache endpoint configuration');
    }
    return `${host}:${portText}`;
}

function assertBooleanResult(value: unknown, operation: 'set'): boolean {
    if (typeof value !== 'boolean') {
        throw new Error(`Memcache ${operation} returned non-boolean result`);
    }
    return value;
}

function assertStringOrUndefinedResult(value: unknown, operation: 'get'): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new Error(`Memcache ${operation} returned non-string result`);
    }
    return value;
}

function createMetricsClient(
    memcacheModule: MemcacheModuleShape | null | undefined,
    config: MetricsConfig
): MetricsStoreClient {
    const ClientCtor = resolveClientCtor(memcacheModule);
    const endpoint = normalizeEndpoint(config);
    const client = new ClientCtor(endpoint);

    return {
        endpoint,
        connect(): Promise<void> {
            return Promise.resolve(client.connect()).then(() => {});
        },
        async setString(key: string, value: string): Promise<boolean> {
            return assertBooleanResult(await client.set(key, value), 'set');
        },
        async getString(key: string): Promise<string | undefined> {
            return assertStringOrUndefinedResult(await client.get(key), 'get');
        },
    };
}

export { createMetricsClient };
export default { createMetricsClient };
