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

function resolveQueryOverrides(): Partial<RuntimeServerConfig> | null {
    if (typeof window === "undefined" || !window.location) {
        return null;
    }

    const params = new URLSearchParams(window.location.search);
    const host = params.get("bq_host") || undefined;
    const port = toValidPort(params.get("bq_port") || "");
    const dispatcherRaw = params.get("bq_dispatcher");

    if (!host && port === null && dispatcherRaw === null) {
        return null;
    }

    const dispatcher =
        dispatcherRaw === null
            ? undefined
            : dispatcherRaw === "1" || dispatcherRaw.toLowerCase() === "true" || dispatcherRaw.toLowerCase() === "yes";

    return {
        host,
        port: port ?? undefined,
        dispatcher,
    };
}

function resolveRuntimeServerConfig(): RuntimeServerConfig {
    if (typeof window === "undefined" || !window.location) {
        return defaultConfig;
    }

    const hostname = window.location.hostname || defaultConfig.host;
    const protocol = window.location.protocol;
    const explicitPort = toValidPort(window.location.port);
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    const queryOverrides = resolveQueryOverrides();
    if (queryOverrides?.host || queryOverrides?.port || queryOverrides?.dispatcher !== undefined) {
        return {
            host: queryOverrides.host ?? hostname,
            port: queryOverrides.port ?? defaultConfig.port,
            dispatcher: queryOverrides.dispatcher ?? false,
        };
    }

    if (isLocalHost) {
        return defaultConfig;
    }

    const inferredPort = explicitPort ?? (protocol === "https:" ? 443 : 80);

    // Port-subdomain ingress: `5173.app.krsz.dev` proxies to internal `:5173`.
    // When this is used for the Vite frontend, the runtime server should be reached via `8000.app.krsz.dev`.
    const portSubdomainMatch = hostname.match(/^(\d+)\.(.+)$/);
    if (portSubdomainMatch && portSubdomainMatch[2]) {
        return {
            host: `${defaultConfig.port}.${portSubdomainMatch[2]}`,
            port: inferredPort,
            dispatcher: false,
        };
    }

    return {
        host: hostname,
        port: inferredPort,
        dispatcher: false,
    };
}

export default {
    server: resolveRuntimeServerConfig(),
};
