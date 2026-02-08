// AUTO-GENERATED from server/js/metrics-client.cts via bun run build:metrics-client.
// Do not edit server/js/metrics-client.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function normalizeError(error) {
    if (!error) {
        return "unknown_error";
    }
    if (typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string") {
        return String(error.message);
    }
    return String(error);
}
function createMetricsClient(memcacheModule, config, hooks = {}) {
    const onReady = typeof hooks.onReady === "function" ? hooks.onReady : () => { };
    const onError = typeof hooks.onError === "function" ? hooks.onError : () => { };
    const onOperationError = typeof hooks.onOperationError === "function"
        ? hooks.onOperationError
        : () => { };
    const LegacyClient = memcacheModule?.Client;
    const ModernClient = memcacheModule?.Memcache || memcacheModule?.default;
    if (typeof LegacyClient === "function") {
        const legacyClient = new LegacyClient(config.memcached_port, config.memcached_host);
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
        const modernClient = new ModernClient(`${config.memcached_host}:${config.memcached_port}`);
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
