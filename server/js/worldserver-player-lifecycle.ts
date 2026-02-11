import Log from './log';
import Messages from './message';
import { WORLD_EVENT_NAMES } from './server-event-names';

type Position = { x: number; y: number };

type AttackerMob = {
    target: string | number;
    clearTarget(): void;
    forgetEveryone(): void;
    distanceToSpawningPoint(x: number, y: number): number;
};

type EnteringPlayer = {
    id: number;
    name: string;
    group: string | number;
    hasEnteredGame: boolean;
    lastCheckpoint: { getRandomPosition(): Position } | null;
    setPositionResolver(resolver: () => Position): void;
    on(eventName: 'move', callback: (x: number, y: number) => void): void;
    on(eventName: 'lootMove', callback: (x: number, y: number) => void): void;
    on(eventName: 'zone', callback: () => void): void;
    on(eventName: 'broadcast', callback: (message: unknown, ignoreSelf?: boolean) => void): void;
    on(eventName: 'broadcastZone', callback: (message: unknown, ignoreSelf?: boolean) => void): void;
    on(eventName: 'exit', callback: () => void): void;
    forEachAttacker(callback: (mob: AttackerMob) => void): void;
    removeAttacker(mob: AttackerMob): void;
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
    pushRelevantEntityListTo(player: EnteringPlayer): void;
    getEntityById(id: string | number): { id?: string | number } | null | undefined;
    findPositionNextTo(
        attacker: AttackerMob,
        target: { id?: string | number } | null | undefined
    ): Position;
    moveEntity(entity: AttackerMob, x: number, y: number): void;
    handleEntityGroupMembership(player: EnteringPlayer): boolean;
    pushToPreviousGroups(player: EnteringPlayer, message: unknown): void;
    pushToAdjacentGroups(groupId: string | number, message: unknown, ignoredPlayer: string | number | null): void;
    pushToGroup(groupId: string | number, message: unknown, ignoredPlayer: string | number | null): void;
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

        world.pushToPlayer(player, new Messages.Population(world.playerCount));
        world.pushRelevantEntityListTo(player);

        var onMove = function (x, y) {
            log.debug(player.name + ' is moving to (' + x + ', ' + y + ').');

            player.forEachAttacker(function (mob) {
                var target = world.getEntityById(mob.target);
                if (target) {
                    var pos = world.findPositionNextTo(mob, target);
                    if (mob.distanceToSpawningPoint(pos.x, pos.y) > 50) {
                        mob.clearTarget();
                        mob.forgetEveryone();
                        player.removeAttacker(mob);
                    } else {
                        world.moveEntity(mob, pos.x, pos.y);
                    }
                }
            });
        };

        player.on('move', onMove);
        player.on('lootMove', onMove);

        player.on('zone', function () {
            var hasChangedGroups = world.handleEntityGroupMembership(player);

            if (hasChangedGroups) {
                world.pushToPreviousGroups(player, new Messages.Destroy(player));
                world.pushRelevantEntityListTo(player);
            }
        });

        player.on('broadcast', function (message, ignoreSelf) {
            world.pushToAdjacentGroups(player.group, message, ignoreSelf ? player.id : null);
        });

        player.on('broadcastZone', function (message, ignoreSelf) {
            world.pushToGroup(player.group, message, ignoreSelf ? player.id : null);
        });

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
