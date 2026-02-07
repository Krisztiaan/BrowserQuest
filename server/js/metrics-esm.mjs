import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Metrics = require('./metrics');

export { Metrics };
export default Metrics;
