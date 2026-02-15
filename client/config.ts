type RuntimeServerConfig = {
    wsUrl: string;
    dispatcher: boolean;
};

function resolveRuntimeServerConfig(): RuntimeServerConfig {
    const override = (globalThis as unknown as { __BQ_WS_URL__?: unknown }).__BQ_WS_URL__;
    if (typeof override === "string" && override.trim().length > 0) {
        return {
            wsUrl: override,
            dispatcher: false,
        };
    }

    if (typeof window === "undefined") {
        return {
            wsUrl: "ws://localhost/ws",
            dispatcher: false,
        };
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host.length > 0 ? window.location.host : "localhost";
    return {
        wsUrl: `${protocol}//${host}/ws`,
        dispatcher: false,
    };
}

export default {
    server: resolveRuntimeServerConfig(),
};
