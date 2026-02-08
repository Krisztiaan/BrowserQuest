type Operation = "write" | "read";

interface MetricsConfig {
    memcached_port: string | number;
    memcached_host: string;
}

interface OperationErrorPayload {
    operation: Operation;
    key: string;
    error: string;
}

interface MetricsClientHooks {
    onReady?: () => void;
    onError?: (error: unknown) => void;
    onOperationError?: (payload: OperationErrorPayload) => void;
}

interface LegacyMemcacheClient {
    on(event: string, listener: (...args: unknown[]) => void): void;
    connect(): void;
    set(key: string, value: unknown, callback: (error: unknown) => void): void;
    get(
        key: string,
        callback: (error: unknown, result: unknown) => void
    ): void;
}

type LegacyMemcacheClientCtor = new (
    port: string | number,
    host: string
) => LegacyMemcacheClient;

interface ModernMemcacheClient {
    on?(event: string, listener: (...args: unknown[]) => void): void;
    connect(): unknown;
    set(key: string, value: unknown): unknown;
    get(key: string): unknown;
}

type ModernMemcacheClientCtor = new (endpoint: string) => ModernMemcacheClient;

interface MemcacheModuleShape {
    Client?: LegacyMemcacheClientCtor;
    Memcache?: ModernMemcacheClientCtor;
    default?: ModernMemcacheClientCtor;
}

interface MetricsClientAdapter {
    clientType: "legacy" | "modern";
    connect(): void;
    set(key: string, value: unknown, callback: (ok: boolean) => void): void;
    get(key: string, callback: (result: unknown) => void): void;
}

function normalizeError(error: unknown): string {
    if (!error) {
        return "unknown_error";
    }
    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
    ) {
        return String((error as { message: string }).message);
    }
    return String(error);
}

function createMetricsClient(
    memcacheModule: MemcacheModuleShape | null | undefined,
    config: MetricsConfig,
    hooks: MetricsClientHooks = {}
): MetricsClientAdapter {
    const onReady =
        typeof hooks.onReady === "function" ? hooks.onReady : () => {};
    const onError =
        typeof hooks.onError === "function" ? hooks.onError : () => {};
    const onOperationError =
        typeof hooks.onOperationError === "function"
            ? hooks.onOperationError
            : () => {};

    const LegacyClient = memcacheModule?.Client;
    const ModernClient = memcacheModule?.Memcache || memcacheModule?.default;

    if (typeof LegacyClient === "function") {
        const legacyClient = new LegacyClient(
            config.memcached_port,
            config.memcached_host
        );
        legacyClient.on("connect", onReady);
        legacyClient.on("error", onError);

        return {
            clientType: "legacy",
            connect() {
                legacyClient.connect();
            },
            set(key, value, callback) {
                legacyClient.set(key, value, (error) => {
                    if (error) {
                        onOperationError({
                            operation: "write",
                            key,
                            error: normalizeError(error),
                        });
                        callback(false);
                        return;
                    }
                    callback(true);
                });
            },
            get(key, callback) {
                legacyClient.get(key, (error, result) => {
                    if (error) {
                        onOperationError({
                            operation: "read",
                            key,
                            error: normalizeError(error),
                        });
                    }
                    callback(result);
                });
            },
        };
    }

    if (typeof ModernClient === "function") {
        const modernClient = new ModernClient(
            `${config.memcached_host}:${config.memcached_port}`
        );
        if (typeof modernClient.on === "function") {
            modernClient.on("connect", onReady);
            modernClient.on("error", onError);
        }

        return {
            clientType: "modern",
            connect() {
                Promise.resolve(modernClient.connect())
                    .then(onReady)
                    .catch((error) => {
                        onError(normalizeError(error));
                    });
            },
            set(key, value, callback) {
                Promise.resolve(modernClient.set(key, value))
                    .then((result) => {
                        callback(result !== false);
                    })
                    .catch((error) => {
                        onOperationError({
                            operation: "write",
                            key,
                            error: normalizeError(error),
                        });
                        callback(false);
                    });
            },
            get(key, callback) {
                Promise.resolve(modernClient.get(key))
                    .then((result) => {
                        callback(result);
                    })
                    .catch((error) => {
                        onOperationError({
                            operation: "read",
                            key,
                            error: normalizeError(error),
                        });
                        callback(undefined);
                    });
            },
        };
    }

    throw new Error("Unsupported memcache client API");
}

module.exports = {
    createMetricsClient,
};
