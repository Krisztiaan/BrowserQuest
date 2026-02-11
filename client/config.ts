type RuntimeServerConfig = {
    host: string;
    port: number;
    dispatcher: boolean;
};

const defaultConfig: RuntimeServerConfig = { host: "localhost", port: 8000, dispatcher: false };

function toValidPort(rawPort: string): number | null {
    if (!rawPort) {
        return null;
    }
    const parsed = Number.parseInt(rawPort, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function resolveRuntimeServerConfig(): RuntimeServerConfig {
    if (typeof window === "undefined" || !window.location) {
        return defaultConfig;
    }

    const hostname = window.location.hostname || defaultConfig.host;
    const protocol = window.location.protocol;
    const explicitPort = toValidPort(window.location.port);
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocalHost) {
        return defaultConfig;
    }

    const inferredPort = explicitPort ?? (protocol === "https:" ? 443 : 80);
    return {
        host: hostname,
        port: inferredPort,
        dispatcher: false,
    };
}

export default {
    server: resolveRuntimeServerConfig(),
};
