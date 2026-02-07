import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Types = require('./gametypes.js');

export { Types };
export default Types;
