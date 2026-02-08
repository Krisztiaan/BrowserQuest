// AUTO-GENERATED from server/js/ws.cts via `bun run build:ws-module`.
// Do not edit server/js/ws.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require('url');
const http = require('http');
const Log = require('./log');
const Utils = require('./utils');
const Protocol = require('../../shared/js/protocol-contract.js');
const CLOSE_CODES = require('../../shared/js/ws-close-codes');
const WebSocket = require('ws');
const RuntimeClassFactory = require('./ws-runtime-class-factory.cjs');
const WS = {};
const useBison = false;
const log = Log.getLogger();
/** @type {(payload: string) => unknown[]} */
const parseProtocolActionBatch = Protocol.parseProtocolActionBatch;
const protocolRuntime = Object.assign({}, Protocol, {
    parseProtocolActionBatch: parseProtocolActionBatch,
});
module.exports = WS;
WS.CLOSE_CODES = CLOSE_CODES;
const appendFields = function (baseFields, extraFields) {
    if (!extraFields) {
        return baseFields;
    }
    for (var key in extraFields) {
        if (Object.prototype.hasOwnProperty.call(extraFields, key)) {
            baseFields[key] = extraFields[key];
        }
    }
    return baseFields;
};
const logConnectionEvent = function (level, eventName, connection, extraFields) {
    log.event(level, eventName, appendFields({
        connectionId: connection.id,
        remoteAddress: connection.remoteAddress,
    }, extraFields));
};
const runtimeClasses = RuntimeClassFactory.createWebSocketRuntimeClasses({
    log: log,
    Utils: Utils,
    Protocol: protocolRuntime,
    CLOSE_CODES: CLOSE_CODES,
    WebSocket: WebSocket,
    createHttpServer: function (requestHandler) {
        return http.createServer(requestHandler);
    },
    parseUrlPathname: function (requestUrl) {
        return url.parse(requestUrl).pathname;
    },
    logConnectionEvent: logConnectionEvent,
    useBison: useBison,
});
WS.createWebSocketRuntimeClasses = RuntimeClassFactory.createWebSocketRuntimeClasses;
WS.MultiVersionWebsocketServer = runtimeClasses.MultiVersionWebsocketServer;
WS.wsWebSocketConnection = runtimeClasses.wsWebSocketConnection;
