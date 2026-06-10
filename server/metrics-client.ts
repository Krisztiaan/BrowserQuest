interface MetricsConfig {
    memcached_port: string | number;
    memcached_host: string;
}

/** memjs Client.create-style API: get returns { value: Buffer | null }, set returns boolean. */
interface MemjsClientLike {
    set(key: string, value: string, options?: object): Promise<boolean>;
    get(key: string): Promise<{ value: Buffer | Uint8Array | null }>;
}

export interface MemjsModuleShape {
    Client?: { create(servers: string, options?: object): MemjsClientLike };
    default?: { Client?: { create(servers: string, options?: object): MemjsClientLike } };
}

export interface MetricsStoreClient {
    readonly endpoint: string;
    connect(): Promise<void>;
    setString(key: string, value: string): Promise<boolean>;
    getString(key: string): Promise<string | undefined>;
}

function resolveClientFactory(memjsModule: MemjsModuleShape | null | undefined): {
    create(servers: string, options?: object): MemjsClientLike;
} {
    const factory = memjsModule?.Client ?? memjsModule?.default?.Client;
    if (!factory || typeof factory.create !== 'function') {
        throw new Error('Unsupported memjs client API');
    }
    return factory;
}

function normalizeEndpoint(config: MetricsConfig): string {
    const host = String(config.memcached_host).trim();
    const portText = String(config.memcached_port).trim();
    if (host.length === 0 || portText.length === 0) {
        throw new Error('Invalid memcache endpoint configuration');
    }
    return `${host}:${portText}`;
}

function createMetricsClient(
    memjsModule: MemjsModuleShape | null | undefined,
    config: MetricsConfig
): MetricsStoreClient {
    const factory = resolveClientFactory(memjsModule);
    const endpoint = normalizeEndpoint(config);
    const client = factory.create(endpoint, { retries: 1, timeout: 1 });

    return {
        endpoint,
        async connect(): Promise<void> {
            // memjs connects lazily; a get against a sentinel key forces the
            // socket open so connection failures surface here, not mid-write.
            await client.get('bq:metrics:connect-probe');
        },
        async setString(key: string, value: string): Promise<boolean> {
            const result = await client.set(key, value, {});
            if (typeof result !== 'boolean') {
                throw new Error('Memcache set returned non-boolean result');
            }
            return result;
        },
        async getString(key: string): Promise<string | undefined> {
            const { value } = await client.get(key);
            if (value === null) {
                return undefined;
            }
            return Buffer.from(value).toString('utf8');
        },
    };
}

export { createMetricsClient };
export default { createMetricsClient };
