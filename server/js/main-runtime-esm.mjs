import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MainRuntime = require('./main-runtime');

export const main = MainRuntime.main;
export const getWorldDistribution = MainRuntime.getWorldDistribution;
export const createRuntimeDependencies = MainRuntime.createRuntimeDependencies;
export const createServerAndMetrics = MainRuntime.createServerAndMetrics;
export const createWorlds = MainRuntime.createWorlds;
export const createServerEventEmitter = MainRuntime.createServerEventEmitter;
export const createPopulationCheckTimer = MainRuntime.createPopulationCheckTimer;
export const createPopulationCheckCleanup = MainRuntime.createPopulationCheckCleanup;
export const createFatalReporter = MainRuntime.createFatalReporter;
export const installFatalHandlers = MainRuntime.installFatalHandlers;
export const triggerFatalTestEvent = MainRuntime.triggerFatalTestEvent;
export const createRuntimeCleanup = MainRuntime.createRuntimeCleanup;
export default MainRuntime;
