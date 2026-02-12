import Log from '../log';
import { buildPopulationAction } from '../protocol/outbound-actions';
import { WORLD_EVENT_NAMES } from '../server-event-names';
import type { EntityId } from '../../shared/domain/ids';

type Position = { x: number; y: number };

type EnteringPlayer = {
    id: EntityId;
    name: string;
    hasEnteredGame: boolean;
    lastCheckpoint: { getRandomPosition(): Position } | null;
    setPositionResolver(resolver: () => Position): void;
    on(eventName: 'move', callback: (x: number, y: number) => void): void;
    on(eventName: 'lootMove', callback: (x: number, y: number) => void): void;
    on(eventName: 'exit', callback: () => void): void;
};

type LifecycleWorld = {
    id: string;
    map: {
        getRandomStartingPosition(): Position;
    };
    playerCount: number;
    on(eventName: 'playerConnect', callback: (player: EnteringPlayer) => void): void;
    on(eventName: 'playerEnter', callback: (player: EnteringPlayer) => void): void;
    emit(eventName: 'playerRemoved'): void;
    emit(eventName: 'playerAdded'): void;
    incrementPlayerCount(): void;
    decrementPlayerCount(): void;
    pushToPlayer(player: EnteringPlayer, message: unknown): void;
    removePlayer(player: EnteringPlayer): void;
};

const log = Log.getLogger();

export function installWorldPlayerLifecycle(world: LifecycleWorld): void {
    const logPlayerEvent = (
        eventName: typeof WORLD_EVENT_NAMES.PLAYER_JOIN | typeof WORLD_EVENT_NAMES.PLAYER_LEAVE,
        player: EnteringPlayer
    ): void => {
        log.event('info', eventName, {
            worldId: world.id,
            playerId: player.id,
            playerName: player.name,
        });
    };

    world.on('playerConnect', function (player) {
        player.setPositionResolver(function () {
            if (player.lastCheckpoint) {
                return player.lastCheckpoint.getRandomPosition();
            }
            return world.map.getRandomStartingPosition();
        });
    });

    world.on('playerEnter', function (player) {
        log.info(player.name + ' has joined ' + world.id);
        logPlayerEvent(WORLD_EVENT_NAMES.PLAYER_JOIN, player);

        if (!player.hasEnteredGame) {
            world.incrementPlayerCount();
        }

        world.pushToPlayer(player, buildPopulationAction(world.playerCount));

        const onMove = function (x: number, y: number) {
            log.debug(player.name + ' is moving to (' + x + ', ' + y + ').');
        };

        player.on('move', onMove);
        player.on('lootMove', onMove);

        player.on('exit', function () {
            log.info(player.name + ' has left the game.');
            logPlayerEvent(WORLD_EVENT_NAMES.PLAYER_LEAVE, player);
            world.removePlayer(player);
            world.decrementPlayerCount();

            world.emit('playerRemoved');
        });

        world.emit('playerAdded');
    });
}
