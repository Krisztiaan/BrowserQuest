import log from './compat/log';
import type { GameClientEventSource } from './gameclient';

type EntityId = string | number;

type SessionEntity = {
    id: EntityId;
};

type SessionClient = {
    host: string;
    port: number;
    connect(dispatcher?: boolean): void;
    on: GameClientEventSource['on'];
    sendWho(ids: EntityId[]): void;
};

type SessionGameHost = {
    entities: Record<string, SessionEntity>;
    obsoleteEntities: SessionEntity[] | null;
    player: {
        id: EntityId;
        name: string;
    };
    username: string;
    started: boolean;
    sendHello(): void;
    removeObsoleteEntities(): void;
};

export function installGameSessionBootstrapHandlers(game: SessionGameHost, client: SessionClient): void {
    client.on('dispatched', function (host, port) {
        log.debug('Dispatched to game server ' + host + ':' + port);

        client.host = host;
        client.port = port;
        client.connect();
    });

    client.on('connected', function () {
        log.info('Starting client/server handshake');

        game.player.name = game.username;
        game.started = true;

        game.sendHello();
    });

    client.on('entityList', function (list) {
        var entityIds = Object.values(game.entities).map(function (entity) {
            return entity.id;
        });
        var knownIds = entityIds.filter(function (id) {
            return list.includes(id);
        });
        var newIds = list.filter(function (id) {
            return !knownIds.includes(id);
        });

        game.obsoleteEntities = Object.values(game.entities).filter(function (entity) {
            return !knownIds.includes(entity.id) && entity.id !== game.player.id;
        });

        game.removeObsoleteEntities();

        if (newIds.length > 0) {
            client.sendWho(newIds);
        }
    });
}
