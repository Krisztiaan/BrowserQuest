import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import Chest from '../../chest';
import type Player from '../../player';
import type { EntityId } from '../../../shared/domain/ids';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import { gridPos } from '../../../shared/domain/positions';
import log from '../../platform/log';
import Types from '../../../shared/gametypes-browser';
import type { ClientCommand } from '../client-commands';
import type { ClientWorldKernel } from '../world-kernel';
import { adaptKernelEntityForRendering } from '../kernel-entity-adapter';
import Exceptions from '../../exceptions';

type GridIndexedEntity = {
    id: EntityId;
    kind: EntityKind;
    gridX: number;
    gridY: number;
    setSprite(sprite: unknown): void;
    setWeaponName?(name: string): void;
    getSpriteName(): string;
    getWeaponName?(): string;
    setGridPosition(x: number, y: number): void;
    setMaxHitPoints?(hp: number): void;
    blink?(speed: number): void;
    dirtyRect?: unknown;
};

export type ClientCommandApplySystemHost = {
    kernel: ClientWorldKernel;
    started: boolean;
    client:
        | {
              sendLoot(item: { id: EntityId }): void;
              sendOpen(chest: { id: EntityId }): void;
              sendWho(ids: EntityId[]): void;
          }
        | null;
    playerId: EntityId | null;
    player: Player;
    emit(eventName: 'notification', message: string): void;
    emit(eventName: 'nbPlayersChange', worldPlayers: number, totalPlayers: number): void;
    emit(eventName: 'playerHurt'): void;
    emit(eventName: 'playerEquipmentChange'): void;

    stopPlayerCombat(): void;
    makePlayerGoTo(x: number, y: number): void;
    makePlayerGoToItem(item: Item | null): void;
    getEntityById(id: EntityId): unknown;
    makeCharacterTeleportTo(entity: unknown, x: number, y: number): void;
    makeCharacterGoTo(entity: unknown, x: number, y: number): void;
    createAttackLink(attacker: unknown, target: unknown): void;
    removeItem(item: Item | null): void;
    removeEntity(entity: unknown): void;

    makePlayerAttack(mob: Mob): void;
    makePlayerTalkTo(npc: Npc): void;
    makePlayerOpenChest(chest: Chest): void;
    makeNpcTalk(npc: Npc): void;

    // Runtime/welcome side effects
    renderer: { getEntityBoundingRect(entity: unknown): unknown; getPlayerImage(cb: (img: unknown) => void): void } | null;
    storage: {
        hasAlreadyPlayed(): boolean;
        initPlayer(name: string): void;
        savePlayer(playerImage: unknown, spriteName: string, weaponName: string): void;
        setPlayerName(name: string): void;
    };
    updateBars(): void;
    resetCamera(): void;
    addEntity(entity: unknown): void;
    showNotification(message: string): void;
    tryUnlockingAchievement(key: string): void;
    audioManager: { playSound(key: string): void } | null;
    createBubble(entityId: EntityId, text: string): void;
    sprites: Record<string, unknown>;
    entities: Record<string, GridIndexedEntity>;
    obsoleteEntities: GridIndexedEntity[] | null;
    removeObsoleteEntities(): void;
    connectionStartedCallback: (() => void) | null;
    setPlayerId(id: EntityId): void;
    setPlayerName(name: string): void;
    setPlayerGridPosition(x: number, y: number): void;
    setPlayerMaxHitPoints(hp: number): void;
    setPlayerHealth(points: number): void;
    addItemFromUnknown(item: unknown, x: number, y: number): void;
};

function safeOrientation(orientation: number | undefined): number {
    return orientation === Types.Orientations.UP ||
        orientation === Types.Orientations.DOWN ||
        orientation === Types.Orientations.LEFT ||
        orientation === Types.Orientations.RIGHT
        ? orientation
        : Types.Orientations.DOWN;
}

function applyWelcome(host: ClientCommandApplySystemHost, id: EntityId, name: string, x: number, y: number, maxHp: number): void {
    log.info('Received player ID from server : ' + id);

    host.setPlayerId(id);
    host.setPlayerName(name);
    host.setPlayerGridPosition(x, y);
    host.setPlayerMaxHitPoints(maxHp);

    host.kernel.clientLastSentMovePos = gridPos(x, y);

    host.updateBars();
    host.resetCamera();
    host.addEntity(host.player as unknown);
    const renderer = host.renderer;
    if (renderer) {
        (host.player as unknown as GridIndexedEntity).dirtyRect = renderer.getEntityBoundingRect(host.player);
    }

    setTimeout(function (): void {
        host.tryUnlockingAchievement('STILL_ALIVE');
    }, 1500);

    if (!host.storage.hasAlreadyPlayed()) {
        host.storage.initPlayer(host.player.name);
        if (renderer) {
            renderer.getPlayerImage(function (playerImage: unknown) {
                host.storage.savePlayer(playerImage, host.player.getSpriteName(), host.player.getWeaponName());
            });
        }
        host.showNotification('Welcome to BrowserQuest!');
        return;
    }

    host.showNotification('Welcome back to BrowserQuest!');
    host.storage.setPlayerName(name);
}

export function runClientCommandApplySystem(host: ClientCommandApplySystemHost): void {
    const commands: ClientCommand[] = host.kernel.drainClientCommands();
    if (commands.length === 0) {
        return;
    }

    const getKnownEntity = (id: EntityId): GridIndexedEntity | undefined => host.entities[String(id)];

    for (const command of commands) {
        switch (command.type) {
            case 'stopPlayerCombat': {
                host.stopPlayerCombat();
                break;
            }
            case 'playerGoTo': {
                host.makePlayerGoTo(command.x, command.y);
                break;
            }
            case 'playerGoToItem': {
                const entity = getKnownEntity(command.itemId);
                host.makePlayerGoToItem(entity instanceof Item ? entity : null);
                break;
            }
            case 'playerAttack': {
                const entity = getKnownEntity(command.targetId);
                if (entity instanceof Mob) {
                    host.makePlayerAttack(entity);
                }
                break;
            }
            case 'playerFollow': {
                const entity = getKnownEntity(command.targetId);
                if (entity && typeof (entity as { gridX?: unknown; gridY?: unknown }).gridX === 'number') {
                    host.player.follow(entity as never);
                }
                break;
            }
            case 'playerTalkTo': {
                const entity = getKnownEntity(command.npcId);
                if (entity instanceof Npc) {
                    host.makePlayerTalkTo(entity);
                }
                break;
            }
            case 'npcTalk': {
                const entity = getKnownEntity(command.npcId);
                if (entity instanceof Npc) {
                    host.makeNpcTalk(entity);
                }
                break;
            }
            case 'playerOpenChest': {
                const entity = getKnownEntity(command.chestId);
                if (entity instanceof Chest) {
                    host.makePlayerOpenChest(entity);
                }
                break;
            }
            case 'clientSendOpen': {
                const entity = getKnownEntity(command.chestId);
                if (host.started && host.client && entity instanceof Chest) {
                    host.client.sendOpen(entity);
                }
                break;
            }
            case 'tryLoot': {
                if (!host.started || !host.client || !host.playerId) {
                    break;
                }
                const intent = host.kernel.clientInteractionIntent;
                if (!intent || intent.kind !== 'loot' || intent.targetId !== command.itemId) {
                    break;
                }

                const entity = getKnownEntity(command.itemId);
                if (!(entity instanceof Item)) {
                    host.kernel.clearClientLootAttempt();
                    host.kernel.clearClientInteractionIntent();
                    break;
                }

                try {
                    host.player.loot({
                        id: entity.id,
                        kind: entity.kind,
                        type: entity.type,
                        onLoot: () => {},
                    });
                } catch (err) {
                    if (err instanceof Exceptions.LootException) {
                        host.emit('notification', err.message);
                        host.kernel.clearClientLootAttempt();
                        if (
                            host.kernel.clientInteractionIntent?.kind === 'loot' &&
                            host.kernel.clientInteractionIntent.targetId === entity.id
                        ) {
                            host.kernel.clearClientInteractionIntent();
                        }
                        break;
                    }
                    throw err;
                }

                host.client.sendLoot(entity);
                host.kernel.clearClientLootAttempt();
                if (
                    host.kernel.clientInteractionIntent?.kind === 'loot' &&
                    host.kernel.clientInteractionIntent.targetId === entity.id
                ) {
                    host.kernel.clearClientInteractionIntent();
                }
                break;
            }
            case 'playerStop': {
                host.player.stop();
                break;
            }
            case 'playerDisengage': {
                host.player.disengage();
                break;
            }
            case 'playerIdle': {
                host.player.idle();
                break;
            }
            case 'emitNotification': {
                host.emit('notification', command.message);
                break;
            }
            case 'applyWelcome': {
                applyWelcome(host, command.id, command.name, command.x, command.y, command.maxHp);
                break;
            }
            case 'invokeConnectionStartedCallback': {
                host.connectionStartedCallback?.();
                host.connectionStartedCallback = null;
                break;
            }
            case 'emitNbPlayersChange': {
                host.emit('nbPlayersChange', command.worldPlayers, command.totalPlayers);
                break;
            }
            case 'applyEntityList': {
                if (!host.client || !host.playerId) {
                    break;
                }
                const entityIds = Object.values(host.entities).map(function (entity) {
                    return entity.id;
                });
                const knownIds = entityIds.filter(function (id: EntityId) {
                    return command.list.includes(id);
                });
                const newIds = command.list.filter(function (id: EntityId) {
                    return !knownIds.includes(id);
                });

                host.obsoleteEntities = Object.values(host.entities).filter(function (entity) {
                    return !knownIds.includes(entity.id) && entity.id !== host.playerId;
                });
                host.removeObsoleteEntities();

                if (newIds.length > 0) {
                    host.client.sendWho(newIds);
                }
                break;
            }
            case 'teleportEntity': {
                const entity = getKnownEntity(command.entityId);
                if (entity) {
                    // Use legacy immediate teleport effect when available.
                    host.makeCharacterTeleportTo(entity as unknown, command.x, command.y);
                }
                host.kernel.clientReplicationLastPos.set(command.entityId, gridPos(command.x, command.y));
                if (command.entityId === host.playerId) {
                    host.kernel.clientLastSentMovePos = gridPos(command.x, command.y);
                }
                break;
            }
            case 'playerMoveToItem': {
                if (command.playerId !== host.playerId) {
                    break;
                }
                const entity = host.getEntityById(command.itemId);
                host.makePlayerGoToItem(entity instanceof Item ? entity : null);
                break;
            }
            case 'setPlayerHealth': {
                host.setPlayerHealth(command.points);
                host.updateBars();
                if (!command.isRegen) {
                    host.emit('playerHurt');
                }
                break;
            }
            case 'setPlayerMaxHitPoints': {
                host.setPlayerMaxHitPoints(command.maxHp);
                host.updateBars();
                break;
            }
            case 'chatMessage': {
                host.createBubble(command.entityId, command.text);
                host.audioManager?.playSound('chat');
                break;
            }
            case 'equipItem': {
                const entity = getKnownEntity(command.entityId) as
                    | undefined
                    | {
                          setSprite(sprite: unknown): void;
                          setWeaponName?(name: string): void;
                      };
                if (!entity) {
                    break;
                }
                if (Types.isArmor(command.itemKind)) {
                    const kindName = Types.getKindAsString(command.itemKind);
                    if (kindName) {
                        entity.setSprite(host.sprites[kindName] ?? null);
                    }
                } else if (Types.isWeapon(command.itemKind)) {
                    const kindName = Types.getKindAsString(command.itemKind);
                    if (kindName) {
                        entity.setWeaponName?.(kindName);
                    }
                }
                if (command.entityId === host.playerId) {
                    host.emit('playerEquipmentChange');
                }
                break;
            }
            case 'dropItem': {
                const mob = getKnownEntity(command.mobId);
                if (!mob) {
                    break;
                }
                host.addItemFromUnknown(command.item, mob.gridX, mob.gridY);
                break;
            }
            case 'itemBlink': {
                const entity = getKnownEntity(command.entityId);
                entity?.blink?.(150);
                break;
            }
            case 'spawnEntityFromKernel': {
                const id = command.entityId;
                if (getKnownEntity(id)) {
                    break;
                }

                const view = host.kernel.getEntityView(id);
                const adapted = adaptKernelEntityForRendering(host.kernel, id);

                if (adapted.type === 'item') {
                    host.addItemFromUnknown(adapted.entity, view.position.x, view.position.y);
                    break;
                }

                if (adapted.type === 'chest') {
                    const entity = adapted.entity as unknown as GridIndexedEntity;
                    entity.setSprite(host.sprites[entity.getSpriteName()] ?? null);
                    entity.setGridPosition(view.position.x, view.position.y);
                    host.addEntity(entity as unknown);
                    break;
                }

                const character = adapted.entity as unknown as GridIndexedEntity;
                character.setSprite(host.sprites[character.getSpriteName()] ?? null);
                character.setGridPosition(view.position.x, view.position.y);
                if (typeof character.setOrientation === 'function') {
                    character.setOrientation(safeOrientation(adapted.orientation));
                }
                character.idle?.();
                host.addEntity(character as unknown);

                if (adapted.targetId !== undefined) {
                    const target = getKnownEntity(adapted.targetId);
                    if (target) {
                        host.createAttackLink(character as unknown, target as unknown);
                    }
                }
                break;
            }
            case 'removeEntityById': {
                const entity = getKnownEntity(command.entityId);
                if (!entity) {
                    break;
                }
                if (entity instanceof Item) {
                    host.removeItem(entity);
                } else {
                    host.removeEntity(entity);
                }
                break;
            }
            case 'characterGoTo': {
                const entity = getKnownEntity(command.entityId);
                if (!entity) {
                    break;
                }
                if (entity instanceof Item || entity instanceof Chest) {
                    break;
                }
                host.makeCharacterGoTo(entity as unknown, command.x, command.y);
                break;
            }
            case 'createAttackLink': {
                const attacker = getKnownEntity(command.attackerId);
                const target = getKnownEntity(command.targetId);
                if (!attacker || !target) {
                    break;
                }
                host.createAttackLink(attacker as unknown, target as unknown);
                break;
            }
        }
    }
}
