
var cls = require("./lib/class"),
    url = require('url'),
    http = require('http'),
    Log = require('./log'),
    Utils = require('./utils'),
    WebSocket = require('ws'),
    WS = {},
    useBison = false;
var log = Log.getLogger();

module.exports = WS;

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
var Server = cls.Class.extend({
    init: function(port) {
        this.port = port;
        this._connections = {};
        this._counter = 0;
    },
    
    onConnect: function(callback) {
        this.connection_callback = callback;
    },
    
    onError: function(callback) {
        this.error_callback = callback;
    },
    
    broadcast: function(message) {
        throw new Error("Not implemented");
    },
    
    forEachConnection: function(callback) {
        Object.keys(this._connections).forEach(function(connectionId) {
            callback(this._connections[connectionId], connectionId);
        }, this);
    },
    
    addConnection: function(connection) {
        this._connections[connection.id] = connection;
    },
    
    removeConnection: function(id) {
        delete this._connections[id];
    },
    
    getConnection: function(id) {
        return this._connections[id];
    }
});


var Connection = cls.Class.extend({
    init: function(id, connection, server, remoteAddress) {
        this._connection = connection;
        this._server = server;
        this.id = id;
        this.remoteAddress = remoteAddress;
    },
    
    onClose: function(callback) {
        this.close_callback = callback;
    },
    
    listen: function(callback) {
        this.listen_callback = callback;
    },
    
    broadcast: function(message) {
        throw new Error("Not implemented");
    },
    
    send: function(message) {
        throw new Error("Not implemented");
    },
    
    sendUTF8: function(data) {
        throw new Error("Not implemented");
    },
    
    close: function(logError) {
        log.info("Closing connection to "+this.remoteAddress+". Error: "+logError);
        logConnectionEvent("info", "ws.connection.close_request", this, {
            reason: String(logError || "")
        });
        try {
            this._connection.close();
        } catch(_) {
            // ignore
        }
    }
});



/**
 * MultiVersionWebsocketServer
 * 
 * Modern WebSocket server (RFC 6455).
 */
WS.MultiVersionWebsocketServer = Server.extend({
    init: function(port) {
        var self = this;
        
        this._super(port);
        
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
    },
    
    _createId: function() {
        return '5' + Utils.random(99) + '' + (this._counter++);
    },
    
    broadcast: function(message) {
        this.forEachConnection(function(connection) {
            connection.send(message);
        });
    },
    
    onRequestStatus: function(status_callback) {
        this.status_callback = status_callback;
    }
});


/**
 * Connection class for ws
 */
WS.wsWebSocketConnection = Connection.extend({
    init: function(id, connection, server, remoteAddress) {
        var self = this;
        
        this._super(id, connection, server, remoteAddress);

        this._connection.on('message', function(data, isBinary) {
            if(!self.listen_callback || isBinary) {
                return;
            }

            var text = typeof data === "string" ? data : data.toString("utf8");
            if(useBison) {
                self.close("BISON is not supported in modern mode.");
                return;
            }

            try {
                var parsed = JSON.parse(text);
                if(!Array.isArray(parsed)) {
                    self.close("Invalid message: expected an Array.");
                    return;
                }
                self.listen_callback(parsed);
            } catch(e) {
                if(e instanceof SyntaxError) {
                    self.close("Received message was not valid JSON.");
                } else {
                    throw e;
                }
            }
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
    },
    
    send: function(message) {
        this.sendUTF8(JSON.stringify(message));
    },
    
    sendUTF8: function(data) {
        this._connection.send(data);
    }
});
