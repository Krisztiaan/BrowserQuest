import log from '../platform/log';
import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import GameClient from '../gameclient';
import type Game from '../game';
import { GameClientEffectRegistry } from './effects-registry';
import type { ClientRuntimeEvent } from '../ecs/runtime-events';

function enqueue(game: Game, event: ClientRuntimeEvent): void {
    game.kernel.enqueueClientRuntimeEvent(event);
}

export function initializeGameConnection(game: Game, onStarted: () => void): void {
    const runtimeConfig = game.app.config?.server ?? null;
    const client = new GameClient(game.wsUrl, game.kernel);
    game.client = client;
    game.connectionStartedCallback = onStarted;
    const effects = new GameClientEffectRegistry({ game, client });

    effects.on('dispatched', function ({ client }, host: string, port: number) {
        log.debug('Dispatched to game server ' + host + ':' + port);
        const scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        client.wsUrl = `${scheme}${host}:${port}/ws`;
        client.connect();
    });

    effects.on('connected', function ({ game }): void {
        log.info('Starting client/server handshake');
        game.player.name = game.username;
        if (game.hasNeverStarted) {
            game.start();
        }
        game.started = true;
        game.sendHello();
    });

    effects.on('welcome', function ({ game }, id: EntityId, name: string, x: number, y: number, hp: number) {
        enqueue(game, { type: 'welcome', id, name, x, y, maxHp: hp });
    });

    effects.on('populationChange', function ({ game }, worldPlayers: number, totalPlayers: number) {
        enqueue(game, { type: 'populationChange', worldPlayers, totalPlayers });
    });

    effects.on('entityList', function ({ game }, list: EntityId[]) {
        enqueue(game, { type: 'entityList', list });
    });

    effects.on('playerTeleport', function ({ game }, entityId: EntityId, x: number, y: number) {
        enqueue(game, { type: 'playerTeleport', entityId, x, y });
    });

    effects.on('playerMoveToItem', function ({ game }, playerId: EntityId, itemId: EntityId) {
        enqueue(game, { type: 'playerMoveToItem', playerId, itemId });
    });

    effects.on('playerChangeHealth', function ({ game }, points: number, isRegen: boolean) {
        enqueue(game, { type: 'playerChangeHealth', points, isRegen });
    });

    effects.on('playerChangeMaxHitPoints', function ({ game }, maxHp: number) {
        enqueue(game, { type: 'playerChangeMaxHitPoints', maxHp });
    });

    effects.on('chatMessage', function ({ game }, entityId: EntityId, text: string) {
        enqueue(game, { type: 'chatMessage', entityId, text });
    });

    effects.on('playerEquipItem', function ({ game }, entityId: EntityId, itemKind: EntityKind) {
        enqueue(game, { type: 'playerEquipItem', entityId, itemKind });
    });

    effects.on('dropItem', function ({ game }, item: unknown, mobId: EntityId) {
        enqueue(game, { type: 'dropItem', item, mobId });
    });

    effects.on('itemBlink', function ({ game }, entityId: EntityId) {
        enqueue(game, { type: 'itemBlink', entityId });
    });

    effects.on('playerDamageMob', function ({ game }, mobId: EntityId, points: number) {
        enqueue(game, { type: 'playerDamageMob', mobId, points });
    });

    effects.on('playerKillMob', function ({ game }, kind) {
        enqueue(game, { type: 'playerKillMob', kind });
    });

    effects.on(
        'achievementProgress',
        function ({ game }, unlockedIds, ratCount, skeletonCount, totalKills, totalDmg, totalRevives) {
            enqueue(game, {
                type: 'achievementProgress',
                unlockedIds,
                ratCount,
                skeletonCount,
                totalKills,
                totalDmg,
                totalRevives,
            });
        }
    );

    effects.on('disconnected', function ({ game }, reason: string) {
        game.emit('disconnect', reason);
    });

    client.connect(runtimeConfig ? runtimeConfig.dispatcher : false);
}
