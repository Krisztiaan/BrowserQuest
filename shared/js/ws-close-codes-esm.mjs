import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CLOSE_CODES = require('./ws-close-codes.js');

export const NORMAL = CLOSE_CODES.NORMAL;
export const UNSUPPORTED_DATA = CLOSE_CODES.UNSUPPORTED_DATA;
export const INVALID_PAYLOAD = CLOSE_CODES.INVALID_PAYLOAD;
export default CLOSE_CODES;
