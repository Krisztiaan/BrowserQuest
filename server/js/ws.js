
var url = require('url'),
    http = require('http'),
    Log = require('./log'),
    Utils = require('./utils'),
    Protocol = require('../../shared/js/protocol-contract'),
    CLOSE_CODES = require('../../shared/js/ws-close-codes'),
    WebSocket = require('ws'),
    WS = {},
    useBison = false;
var log = Log.getLogger();

/** @typedef {import('../../shared/js/protocol-types').ProtocolAction} ProtocolAction */

module.exports = WS;
WS.CLOSE_CODES = CLOSE_CODES;

var appendFields = function(baseFields, extraFields) {
    if(!extraFields) {
        return baseFields;
    }
    for(var key in extraFields) {
        if(Object.prototype.hasOwnProperty.call(extraFields, key)) {
            baseFields[key] = extraFields[key];
        }
    }
    return baseFields;
};

var logConnectionEvent = function(level, eventName, connection, extraFields) {
    log.event(level, eventName, appendFields({
        connectionId: connection.id,
        remoteAddress: connection.remoteAddress
    }, extraFields));
};


/**
 * Abstract Server and Connection classes
 */
class Server {
    constructor(port) {
        this.port = port;
        this._connections = {};
        this._counter = 0;
    }
    
    onConnect(callback) {
        this.connection_callback = callback;
    }
    
    onError(callback) {
        this.error_callback = callback;
    }
    
    broadcast(message) {
        throw new Error("Not implemented");
    }
    
    forEachConnection(callback) {
        Object.keys(this._connections).forEach(function(connectionId) {
            callback(this._connections[connectionId], connectionId);
        }, this);
    }
    
    addConnection(connection) {
        this._connections[connection.id] = connection;
    }
    
    removeConnection(id) {
        delete this._connections[id];
    }
    
    getConnection(id) {
        return this._connections[id];
    }
}


class Connection {
    constructor(id, connection, server, remoteAddress) {
        this._connection = connection;
        this._server = server;
        this.id = id;
        this.remoteAddress = remoteAddress;
    }
    
    onClose(callback) {
        this.close_callback = callback;
    }
    
    listen(callback) {
        this.listen_callback = callback;
    }
    
    broadcast(message) {
        throw new Error("Not implemented");
    }
    
    send(message) {
        throw new Error("Not implemented");
    }
    
    sendUTF8(data) {
        throw new Error("Not implemented");
    }
    
    close(logError, closeCode) {
        var reason = String(logError || ""),
            sanitizedReason = reason.length > 120 ? reason.slice(0, 117) + "..." : reason,
            code = Number.isInteger(closeCode) ? closeCode : CLOSE_CODES.NORMAL;

        log.info("Closing connection to "+this.remoteAddress+". Error: "+reason);
        logConnectionEvent("info", "ws.connection.close_request", this, {
            code: code,
            reason: reason
        });
        try {
            this._connection.close(code, sanitizedReason);
        } catch(_) {
            // ignore
        }
    }

    closeInvalidPayload(logError) {
        this.close(logError, CLOSE_CODES.INVALID_PAYLOAD);
    }

    closeUnsupportedData(logError) {
        this.close(logError, CLOSE_CODES.UNSUPPORTED_DATA);
    }
}



/**
 * MultiVersionWebsocketServer
 * 
 * Modern WebSocket server (RFC 6455).
 */
WS.MultiVersionWebsocketServer = class MultiVersionWebsocketServer extends Server {
    constructor(port) {
        super(port);
        var self = this;
        
        this._httpServer = http.createServer(function(request, response) {
            var requestPath = url.parse(request.url).pathname;
            if(requestPath === '/status' && self.status_callback) {
                response.writeHead(200);
                response.write(self.status_callback());
                response.end();
                return;
            }

            response.writeHead(404);
            response.end();
        });
        this._httpServer.listen(port, function() {
            log.info("Server is listening on port "+port);
            log.event("info", "ws.server.listen", { port: port });
        });

        this._wss = new WebSocket.WebSocketServer({
            server: this._httpServer,
            maxPayload: 64 * 1024,
            perMessageDeflate: false
        });
        this._wss.on('error', function(err) {
            log.error("WebSocket server error: " + err);
            log.event("error", "ws.server.error", { error: String(err) });
        });
        this._wss.on('connection', function(connection, req) {
            var remoteAddress = req && req.socket ? req.socket.remoteAddress : "unknown";
            var c = new WS.wsWebSocketConnection(self._createId(), connection, self, remoteAddress);

            if(self.connection_callback) {
                self.connection_callback(c);
            }
            self.addConnection(c);
            logConnectionEvent("info", "ws.connection.open", c);
        });
    }
    
    _createId() {
        return '5' + Utils.random(99) + '' + (this._counter++);
    }
    
    broadcast(message) {
        this.forEachConnection(function(connection) {
            connection.send(message);
        });
    }
    
    onRequestStatus(status_callback) {
        this.status_callback = status_callback;
    }
};


/**
 * Connection class for ws
 */
WS.wsWebSocketConnection = class wsWebSocketConnection extends Connection {
    constructor(id, connection, server, remoteAddress) {
        super(id, connection, server, remoteAddress);
        var self = this;

        this._connection.on('message', function(data, isBinary) {
            if(!self.listen_callback) {
                return;
            }
            if(isBinary) {
                self.closeUnsupportedData("Binary websocket frames are not supported.");
                return;
            }

            var text = typeof data === "string" ? data : data.toString("utf8");
            if(useBison) {
                self.closeUnsupportedData("BISON is not supported in modern mode.");
                return;
            }

            /** @type {ProtocolAction[]} */
            var actions = Protocol.parseProtocolActionBatch(text);
            if(actions.length !== 1) {
                self.closeInvalidPayload("Invalid message: expected a single protocol action Array.");
                return;
            }

            self.listen_callback(actions[0]);
        });

        this._connection.on('close', function() {
            logConnectionEvent("info", "ws.connection.closed", self);
            if(self.close_callback) {
                self.close_callback();
            }
            self._server.removeConnection(self.id);
        });

        this._connection.on('error', function(err) {
            log.error("WebSocket connection error: " + err);
            logConnectionEvent("error", "ws.connection.error", self, {
                error: String(err)
            });
        });
    }
    
    send(message) {
        this.sendUTF8(JSON.stringify(message));
    }
    
    sendUTF8(data) {
        this._connection.send(data);
    }
};
