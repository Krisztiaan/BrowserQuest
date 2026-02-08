type RuntimeServerConfig = {
    host: string;
    port: number;
    dispatcher: boolean;
};

type RuntimeConfigSurface = {
    BQ_BUILD_CONFIG?: RuntimeServerConfig;
    BQ_LOCAL_CONFIG?: RuntimeServerConfig | null;
};

const defaultConfig: RuntimeServerConfig = { host: "localhost", port: 8000, dispatcher: false };
const browserWindow: RuntimeConfigSurface = (typeof window !== "undefined" ? window : {}) as RuntimeConfigSurface;

const build = browserWindow.BQ_BUILD_CONFIG ? browserWindow.BQ_BUILD_CONFIG : defaultConfig;
const local = browserWindow.BQ_LOCAL_CONFIG ? browserWindow.BQ_LOCAL_CONFIG : null;

export default {
    dev: defaultConfig,
    build: build,
    local: local
};
