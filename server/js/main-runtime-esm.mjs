import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MainRuntime = require('./main-runtime');

export const main = MainRuntime.main;
export const getWorldDistribution = MainRuntime.getWorldDistribution;
export const createRuntimeDependencies = MainRuntime.createRuntimeDependencies;
export default MainRuntime;
