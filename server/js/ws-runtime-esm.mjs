import url from 'node:url';
import http from 'node:http';
import Log from './log-esm.mjs';
import Utils from './utils-esm.mjs';
import Protocol from '../../shared/js/protocol-contract-esm.mjs';
import CLOSE_CODES from '../../shared/js/ws-close-codes-esm.mjs';
import * as WebSocket from 'ws';
import { createWebSocketRuntimeClasses } from './ws-runtime-class-factory.mjs';

const log = Log.getLogger();
const useBison = false;

function appendFields(baseFields, extraFields) {
    if (!extraFields) {
        return baseFields;
    }
    for (const key in extraFields) {
        if (Object.prototype.hasOwnProperty.call(extraFields, key)) {
            baseFields[key] = extraFields[key];
        }
    }
    return baseFields;
}

function logConnectionEvent(level, eventName, connection, extraFields) {
    log.event(
        level,
        eventName,
        appendFields(
            {
                connectionId: connection.id,
                remoteAddress: connection.remoteAddress,
            },
            extraFields
        )
    );
}

const { MultiVersionWebsocketServer, wsWebSocketConnection } = createWebSocketRuntimeClasses({
    log,
    Utils,
    Protocol,
    CLOSE_CODES,
    WebSocket,
    createHttpServer: (requestHandler) => http.createServer(requestHandler),
    parseUrlPathname: (requestUrl) => url.parse(requestUrl).pathname,
    logConnectionEvent,
    useBison,
});

const WS = {
    CLOSE_CODES,
    MultiVersionWebsocketServer,
    wsWebSocketConnection,
    createWebSocketRuntimeClasses,
};

export { CLOSE_CODES, MultiVersionWebsocketServer, wsWebSocketConnection, createWebSocketRuntimeClasses };
export default WS;
