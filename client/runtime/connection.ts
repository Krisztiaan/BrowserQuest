import log from '../platform/log';
import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import GameClient from '../gameclient';
import type Game from '../game';
import { GameClientEffectRegistry } from './effects-registry';

type GridIndexedEntity = {
    id: EntityId;
    kind: EntityKind;
    setSprite(sprite: unknown): void;
    getSpriteName(): string;
    setGridPosition(x: number, y: number): void;
    setOrientation?(orientation: number): void;
    idle?(): void;
};

function applyWelcome(game: Game, id: EntityId, name: string, x: number, y: number, maxHp: number): void {
    log.info('Received player ID from server : ' + id);

    game.player.id = id;
    game.playerId = id;
    game.player.name = name;
    game.player.setGridPosition(x, y);
    game.player.setMaxHitPoints(maxHp);

    game.updateBars();
    game.resetCamera();
    game.updatePlateauMode();
    game.audioManager?.updateMusic();

    game.addEntity(game.player as unknown as Parameters<Game['addEntity']>[0]);
    const renderer = game.renderer;
    if (renderer) {
        game.player.dirtyRect = renderer.getEntityBoundingRect(game.player);
    }

    setTimeout(function (): void {
        game.tryUnlockingAchievement('STILL_ALIVE');
    }, 1500);

    if (!game.storage.hasAlreadyPlayed()) {
        game.storage.initPlayer(game.player.name);
        const renderer = game.renderer;
        if (renderer) {
            renderer.getPlayerImage(function (playerImage: unknown) {
                game.storage.savePlayer(playerImage, game.player.getSpriteName(), game.player.getWeaponName());
            });
        }
        game.showNotification('Welcome to BrowserQuest!');
        return;
    }

    game.showNotification('Welcome back to BrowserQuest!');
    game.storage.setPlayerName(name);
}

export function initializeGameConnection(game: Game, onStarted: () => void): void {
    const runtimeConfig = game.app.config?.server ?? null;
    const client = new GameClient(game.host, game.port, game.kernel);
    game.client = client;
    const effects = new GameClientEffectRegistry({ game, client });

    effects.on('dispatched', function ({ client }, host: string, port: number) {
        log.debug('Dispatched to game server ' + host + ':' + port);
        client.host = host;
        client.port = port;
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
        applyWelcome(game, id, name, x, y, hp);
        onStarted();
    });

    effects.on('populationChange', function ({ game }, worldPlayers: number, totalPlayers: number) {
        game.emit('nbPlayersChange', worldPlayers, totalPlayers);
    });

    effects.on('entityList', function ({ game, client }, list: EntityId[]) {
        const entityIds = Object.values(game.entities).map(function (entity) {
            return entity.id;
        });
        const knownIds = entityIds.filter(function (id: EntityId) {
            return list.includes(id);
        });
        const newIds = list.filter(function (id: EntityId) {
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

    effects.on('spawnItem', function ({ game }, item: unknown, x: number, y: number) {
        const entityId = (item as { id?: EntityId }).id;
        if (entityId !== undefined && game.entityIdExists(entityId)) {
            return;
        }
        game.addItem(item as Parameters<Game['addItem']>[0], x, y);
        game.updateCursor();
    });

    effects.on('spawnChest', function ({ game }, chest: unknown, x: number, y: number) {
        const entity = chest as GridIndexedEntity;
        if (game.entityIdExists(entity.id)) {
            return;
        }
        entity.setSprite(game.sprites[entity.getSpriteName()]);
        entity.setGridPosition(x, y);
        game.addEntity(entity as unknown as Parameters<Game['addEntity']>[0]);
        game.updateCursor();
    });

    effects.on(
        'spawnCharacter',
        function (
            { game },
            entity: unknown,
            x: number,
            y: number,
            orientation: number | undefined,
            targetId: EntityId | undefined
        ) {
            const character = entity as GridIndexedEntity;
            if (game.entityIdExists(character.id)) {
                return;
            }

            const safeOrientation =
                orientation === Types.Orientations.UP ||
                orientation === Types.Orientations.DOWN ||
                orientation === Types.Orientations.LEFT ||
                orientation === Types.Orientations.RIGHT
                    ? orientation
                    : Types.Orientations.DOWN;

            character.setSprite(game.sprites[character.getSpriteName()]);
            character.setGridPosition(x, y);
            if (typeof character.setOrientation === 'function') {
                character.setOrientation(safeOrientation);
            }
            if (typeof character.idle === 'function') {
                character.idle();
            }

            game.addEntity(character as unknown as Parameters<Game['addEntity']>[0]);

            if (targetId !== undefined) {
                const target = game.getEntityById(targetId) as unknown;
                if (target && typeof (target as { id?: unknown }).id === 'number') {
                    game.createAttackLink(
                        character as unknown as Parameters<Game['createAttackLink']>[0],
                        target as unknown as Parameters<Game['createAttackLink']>[1]
                    );
                }
            }
        }
    );

    effects.on('despawnEntity', function ({ game }, entityId: EntityId) {
        const entity = game.getEntityById(entityId);
        if (!entity) {
            return;
        }
        if (Types.isItem(entity.kind)) {
            game.removeItem(entity as Parameters<Game['removeItem']>[0]);
        } else {
            game.removeEntity(entity);
        }
    });

    effects.on('entityDestroy', function ({ game }, entityId: EntityId) {
        const entity = game.getEntityById(entityId);
        if (!entity) {
            return;
        }
        if (Types.isItem(entity.kind)) {
            game.removeItem(entity as Parameters<Game['removeItem']>[0]);
        } else {
            game.removeEntity(entity);
        }
    });

    effects.on('entityMove', function ({ game }, entityId: EntityId, x: number, y: number) {
        const entity = game.getEntityById(entityId);
        if (!entity) {
            return;
        }
        game.makeCharacterGoTo(entity as Parameters<Game['makeCharacterGoTo']>[0], x, y);
    });

    effects.on('playerTeleport', function ({ game }, entityId: EntityId, x: number, y: number) {
        const entity = game.getEntityById(entityId);
        if (!entity) {
            return;
        }
        game.makeCharacterTeleportTo(entity as Parameters<Game['makeCharacterTeleportTo']>[0], x, y);
    });

    effects.on('entityAttack', function ({ game }, attackerId: EntityId, targetId: EntityId) {
        const attacker = game.getEntityById(attackerId);
        const target = game.getEntityById(targetId);
        if (!attacker || !target) {
            return;
        }
        game.createAttackLink(
            attacker as Parameters<Game['createAttackLink']>[0],
            target as Parameters<Game['createAttackLink']>[1]
        );
    });

    effects.on('playerMoveToItem', function ({ game }, playerId: EntityId, itemId: EntityId) {
        if (playerId !== game.playerId) {
            return;
        }
        const item = game.getEntityById(itemId);
        game.makePlayerGoToItem(item as Parameters<Game['makePlayerGoToItem']>[0]);
    });

    effects.on('playerChangeHealth', function ({ game }, points: number, isRegen: boolean) {
        game.player.hitPoints = points;
        game.updateBars();
        if (!isRegen) {
            game.emit('playerHurt');
        }
    });

    effects.on('playerChangeMaxHitPoints', function ({ game }, maxHp: number) {
        game.player.setMaxHitPoints(maxHp);
        game.updateBars();
    });

    effects.on('chatMessage', function ({ game }, entityId: EntityId, text: string) {
        game.createBubble(entityId, text);
        game.audioManager?.playSound('chat');
    });

    effects.on('playerEquipItem', function ({ game }, entityId: EntityId, itemKind: EntityKind) {
        const entity = game.getEntityById(entityId);
        if (!entity) {
            return;
        }
        if (game.isArmor(itemKind)) {
            entity.setSprite(game.sprites[Types.getKindAsString(itemKind)]);
        } else if (game.isWeapon(itemKind) && typeof entity.setWeaponName === 'function') {
            entity.setWeaponName(Types.getKindAsString(itemKind));
        }
        if (entityId === game.playerId) {
            game.emit('playerEquipmentChange');
        }
    });

    effects.on('dropItem', function ({ game }, item: unknown, mobId: EntityId) {
        const mob = game.getEntityById(mobId);
        if (!mob) {
            return;
        }
        game.addItem(item as Parameters<Game['addItem']>[0], mob.gridX, mob.gridY);
    });

    effects.on('itemBlink', function ({ game }, entityId: EntityId) {
        const item = game.getEntityById(entityId);
        if (item && typeof item.blink === 'function') {
            item.blink(150);
        }
    });

    effects.on('disconnected', function ({ game }, reason: string) {
        game.emit('disconnect', reason);
    });

    client.connect(runtimeConfig ? runtimeConfig.dispatcher : false);
}
