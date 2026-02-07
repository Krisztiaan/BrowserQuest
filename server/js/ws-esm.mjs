import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WS = require('./ws');

export const CLOSE_CODES = WS.CLOSE_CODES;
export const MultiVersionWebsocketServer = WS.MultiVersionWebsocketServer;
export const wsWebSocketConnection = WS.wsWebSocketConnection;
export default WS;
