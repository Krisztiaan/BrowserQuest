import log from '../../platform/log';
import type { GameClientEventSource } from '../../gameclient';

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
    client.on('dispatched', function (host: string, port: number) {
        log.debug('Dispatched to game server ' + host + ':' + port);

        client.host = host;
        client.port = port;
        client.connect();
    });

    client.on('connected', function (): void {
        log.info('Starting client/server handshake');

        game.player.name = game.username;
        game.started = true;

        game.sendHello();
    });

    client.on('entityList', function (list: EntityId[]) {
        const entityIds = Object.values(game.entities).map(function (entity: SessionEntity) {
            return entity.id;
        });
        const knownIds = entityIds.filter(function (id: EntityId) {
            return list.includes(id);
        });
        const newIds = list.filter(function (id: EntityId) {
            return !knownIds.includes(id);
        });

        game.obsoleteEntities = Object.values(game.entities).filter(function (entity: SessionEntity) {
            return !knownIds.includes(entity.id) && entity.id !== game.player.id;
        });

        game.removeObsoleteEntities();

        if (newIds.length > 0) {
            client.sendWho(newIds);
        }
    });
}
