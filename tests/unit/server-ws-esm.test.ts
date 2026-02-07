import { expect, test } from 'bun:test';
import WSEsm, {
    CLOSE_CODES as CLOSE_CODES_ESM,
    MultiVersionWebsocketServer as MultiVersionWebsocketServerESM,
    wsWebSocketConnection as WsWebSocketConnectionESM,
} from '../../server/js/ws-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WSCjs = require('../../server/js/ws');

test('ws esm mirror exports cjs websocket contract', () => {
    expect(WSEsm).toBe(WSCjs);
    expect(CLOSE_CODES_ESM).toBe(WSCjs.CLOSE_CODES);
    expect(CLOSE_CODES_ESM.INVALID_PAYLOAD).toBe(1007);
    expect(CLOSE_CODES_ESM.UNSUPPORTED_DATA).toBe(1003);
    expect(MultiVersionWebsocketServerESM).toBe(WSCjs.MultiVersionWebsocketServer);
    expect(WsWebSocketConnectionESM).toBe(WSCjs.wsWebSocketConnection);
});
