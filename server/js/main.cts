const fs = require('node:fs');

type RuntimeConfig = Record<string, unknown>;
type NullableRuntimeConfig = RuntimeConfig | null;
type ReadConfigCallback = (config: NullableRuntimeConfig) => void;

interface MainRuntimeContract {
    main(config: RuntimeConfig): void;
    getWorldDistribution(...args: unknown[]): unknown;
    createRuntimeDependencies(...args: unknown[]): unknown;
    createServerAndMetrics(...args: unknown[]): unknown;
    createWorlds(...args: unknown[]): unknown;
    createPopulationChangeHandler(...args: unknown[]): unknown;
    installWorldPopulationHooks(...args: unknown[]): unknown;
    initializeMetricsPopulation(...args: unknown[]): unknown;
    createServerEventEmitter(...args: unknown[]): unknown;
    createPopulationCheckTimer(...args: unknown[]): unknown;
    createPopulationCheckCleanup(...args: unknown[]): unknown;
    createFatalReporter(...args: unknown[]): unknown;
    installFatalHandlers(...args: unknown[]): unknown;
    triggerFatalTestEvent(...args: unknown[]): unknown;
    createRuntimeCleanup(...args: unknown[]): unknown;
}

const MainRuntime = require('./main-runtime') as MainRuntimeContract;

function getConfigFile(path: string, callback: ReadConfigCallback): void {
    fs.readFile(path, 'utf8', (err: NodeJS.ErrnoException | null, jsonString: string) => {
        if (err) {
            console.error('Could not open config file:', err.path);
            callback(null);
            return;
        }

        try {
            callback(JSON.parse(jsonString) as RuntimeConfig);
        } catch (parseErr) {
            const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
            console.error('Could not parse config file:', path, message);
            callback(null);
        }
    });
}

if (require.main === module) {
    const defaultConfigPath = './server/config.json';
    let customConfigPath = './server/config_local.json';

    process.argv.forEach((val, index) => {
        if (index === 2) {
            customConfigPath = val;
        }
    });

    getConfigFile(defaultConfigPath, (defaultConfig) => {
        getConfigFile(customConfigPath, (localConfig) => {
            if (localConfig) {
                MainRuntime.main(localConfig);
            } else if (defaultConfig) {
                MainRuntime.main(defaultConfig);
            } else {
                console.error('Server cannot start without any configuration file.');
                process.exit(1);
            }
        });
    });
}

module.exports = {
    main: MainRuntime.main,
    getConfigFile,
    getWorldDistribution: MainRuntime.getWorldDistribution,
    createRuntimeDependencies: MainRuntime.createRuntimeDependencies,
    createServerAndMetrics: MainRuntime.createServerAndMetrics,
    createWorlds: MainRuntime.createWorlds,
    createPopulationChangeHandler: MainRuntime.createPopulationChangeHandler,
    installWorldPopulationHooks: MainRuntime.installWorldPopulationHooks,
    initializeMetricsPopulation: MainRuntime.initializeMetricsPopulation,
    createServerEventEmitter: MainRuntime.createServerEventEmitter,
    createPopulationCheckTimer: MainRuntime.createPopulationCheckTimer,
    createPopulationCheckCleanup: MainRuntime.createPopulationCheckCleanup,
    createFatalReporter: MainRuntime.createFatalReporter,
    installFatalHandlers: MainRuntime.installFatalHandlers,
    triggerFatalTestEvent: MainRuntime.triggerFatalTestEvent,
    createRuntimeCleanup: MainRuntime.createRuntimeCleanup,
};
