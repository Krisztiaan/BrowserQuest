import log from '../../platform/log';
import Types from '../../../shared/gametypes-browser';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import type { ClientRuntimeEvent } from '../runtime-events';

type GridIndexedEntity = {
    id: EntityId;
    kind: EntityKind;
    gridX: number;
    gridY: number;
    setSprite(sprite: unknown): void;
    getSpriteName(): string;
    setGridPosition(x: number, y: number): void;
    setOrientation?(orientation: number): void;
    idle?(): void;
    blink?(speed: number): void;
};

export type ClientRuntimeEventSystemHost = {
    kernel: ClientWorldKernel;
    client: { sendWho(ids: EntityId[]): void } | null;
    renderer: { getEntityBoundingRect(entity: unknown): unknown; getPlayerImage(cb: (img: unknown) => void): void } | null;
    sprites: Record<string, unknown>;
    audioManager: { playSound(key: string): void } | null;
    storage: {
        hasAlreadyPlayed(): boolean;
        initPlayer(name: string): void;
        savePlayer(playerImage: unknown, spriteName: string, weaponName: string): void;
        setPlayerName(name: string): void;
    };
    entities: Record<string, GridIndexedEntity>;
    obsoleteEntities: GridIndexedEntity[] | null;
    player: {
        id: EntityId;
        name: string;
        hitPoints: number;
        setGridPosition(x: number, y: number): void;
        setMaxHitPoints(maxHp: number): void;
        getSpriteName(): string;
        getWeaponName(): string;
        dirtyRect?: unknown;
    };
    playerId: EntityId | null;
    connectionStartedCallback: (() => void) | null;

    emit(eventName: 'nbPlayersChange', worldPlayers: number, totalPlayers: number): void;
    emit(eventName: 'playerHurt'): void;
    emit(eventName: 'playerEquipmentChange'): void;

    updateBars(): void;
    resetCamera(): void;
    addEntity(entity: unknown): void;
    addItem(item: unknown, x: number, y: number): void;
    removeItem(item: unknown): void;
    removeEntity(entity: unknown): void;
    getEntityById(id: EntityId): GridIndexedEntity | undefined;
    entityIdExists(id: EntityId): boolean;
    removeObsoleteEntities(): void;
    createAttackLink(attacker: unknown, target: unknown): void;
    makeCharacterGoTo(entity: unknown, x: number, y: number): void;
    makeCharacterTeleportTo(entity: unknown, x: number, y: number): void;
    makePlayerGoToItem(item: unknown): void;
    createBubble(entityId: EntityId, text: string): void;
    showNotification(message: string): void;
    tryUnlockingAchievement(key: string): void;
};

function applyWelcome(host: ClientRuntimeEventSystemHost, id: EntityId, name: string, x: number, y: number, maxHp: number): void {
    log.info('Received player ID from server : ' + id);

    host.player.id = id;
    host.playerId = id;
    host.player.name = name;
    host.player.setGridPosition(x, y);
    host.player.setMaxHitPoints(maxHp);

    host.updateBars();
    host.resetCamera();
    // Plateau + music updates are handled by ECS post_update systems.

    host.addEntity(host.player as unknown);
    const renderer = host.renderer;
    if (renderer) {
        host.player.dirtyRect = renderer.getEntityBoundingRect(host.player);
    }

    setTimeout(function (): void {
        host.tryUnlockingAchievement('STILL_ALIVE');
    }, 1500);

    if (!host.storage.hasAlreadyPlayed()) {
        host.storage.initPlayer(host.player.name);
        const renderer = host.renderer;
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

function safeOrientation(orientation: number | undefined): number {
    return orientation === Types.Orientations.UP ||
        orientation === Types.Orientations.DOWN ||
        orientation === Types.Orientations.LEFT ||
        orientation === Types.Orientations.RIGHT
        ? orientation
        : Types.Orientations.DOWN;
}

function getEntityIdFromUnknown(entity: unknown): EntityId | undefined {
    const id = (entity as { id?: unknown } | null)?.id;
    return typeof id === 'number' ? (id as EntityId) : undefined;
}

function runSpawnItem(host: ClientRuntimeEventSystemHost, event: Extract<ClientRuntimeEvent, { type: 'spawnItem' }>): void {
    const entityId = getEntityIdFromUnknown(event.item);
    if (entityId !== undefined && host.entityIdExists(entityId)) {
        return;
    }
    host.addItem(event.item, event.x, event.y);
}

function runSpawnChest(host: ClientRuntimeEventSystemHost, event: Extract<ClientRuntimeEvent, { type: 'spawnChest' }>): void {
    const entity = event.chest as GridIndexedEntity;
    if (host.entityIdExists(entity.id)) {
        return;
    }
    entity.setSprite(host.sprites[entity.getSpriteName()]);
    entity.setGridPosition(event.x, event.y);
    host.addEntity(entity as unknown);
}

function runSpawnCharacter(host: ClientRuntimeEventSystemHost, event: Extract<ClientRuntimeEvent, { type: 'spawnCharacter' }>): void {
    const character = event.character as GridIndexedEntity;
    if (host.entityIdExists(character.id)) {
        return;
    }

    const orientation = safeOrientation(event.orientation);

    character.setSprite(host.sprites[character.getSpriteName()]);
    character.setGridPosition(event.x, event.y);
    if (typeof character.setOrientation === 'function') {
        character.setOrientation(orientation);
    }
    if (typeof character.idle === 'function') {
        character.idle();
    }

    host.addEntity(character as unknown);

    const targetId = event.targetId;
    if (targetId === undefined) {
        return;
    }
    const target = host.getEntityById(targetId) as unknown;
    if (target && typeof (target as { id?: unknown }).id === 'number') {
        host.createAttackLink(character as unknown, target as unknown);
    }
}

function runDespawnOrDestroy(host: ClientRuntimeEventSystemHost, entityId: EntityId): void {
    const entity = host.getEntityById(entityId);
    if (!entity) {
        return;
    }
    if (Types.isItem(entity.kind)) {
        host.removeItem(entity as unknown);
    } else {
        host.removeEntity(entity as unknown);
    }
}

function runEntityList(host: ClientRuntimeEventSystemHost, list: EntityId[]): void {
    if (!host.client) {
        return;
    }

    const entityIds = Object.values(host.entities).map(function (entity) {
        return entity.id;
    });
    const knownIds = entityIds.filter(function (id: EntityId) {
        return list.includes(id);
    });
    const newIds = list.filter(function (id: EntityId) {
        return !knownIds.includes(id);
    });

    host.obsoleteEntities = Object.values(host.entities).filter(function (entity) {
        return !knownIds.includes(entity.id) && entity.id !== host.player.id;
    });
    host.removeObsoleteEntities();

    if (newIds.length > 0) {
        host.client.sendWho(newIds);
    }
}

function runEquipItem(host: ClientRuntimeEventSystemHost, entityId: EntityId, itemKind: EntityKind): void {
    const entity = host.getEntityById(entityId) as
        | undefined
        | {
              setSprite(sprite: unknown): void;
              setWeaponName?(name: string): void;
          };
    if (!entity) {
        return;
    }
    if (Types.isArmor(itemKind)) {
        const kindName = Types.getKindAsString(itemKind);
        if (kindName) {
            entity.setSprite(host.sprites[kindName] ?? null);
        }
    } else if (Types.isWeapon(itemKind)) {
        const kindName = Types.getKindAsString(itemKind);
        if (kindName) {
            entity.setWeaponName?.(kindName);
        }
    }
    if (entityId === host.playerId) {
        host.emit('playerEquipmentChange');
    }
}

export function runClientRuntimeEventSystem(host: ClientRuntimeEventSystemHost): void {
    const events = host.kernel.drainClientRuntimeEvents();
    if (events.length === 0) {
        return;
    }

    for (const event of events) {
        switch (event.type) {
            case 'welcome': {
                applyWelcome(host, event.id, event.name, event.x, event.y, event.maxHp);
                host.connectionStartedCallback?.();
                host.connectionStartedCallback = null;
                break;
            }
            case 'populationChange': {
                host.emit('nbPlayersChange', event.worldPlayers, event.totalPlayers);
                break;
            }
            case 'entityList': {
                runEntityList(host, event.list);
                break;
            }
            case 'spawnItem': {
                runSpawnItem(host, event);
                break;
            }
            case 'spawnChest': {
                runSpawnChest(host, event);
                break;
            }
            case 'spawnCharacter': {
                runSpawnCharacter(host, event);
                break;
            }
            case 'despawnEntity': {
                runDespawnOrDestroy(host, event.entityId);
                break;
            }
            case 'entityDestroy': {
                runDespawnOrDestroy(host, event.entityId);
                break;
            }
            case 'entityMove': {
                const entity = host.getEntityById(event.entityId);
                if (entity) {
                    host.makeCharacterGoTo(entity as unknown, event.x, event.y);
                }
                break;
            }
            case 'playerTeleport': {
                const entity = host.getEntityById(event.entityId);
                if (entity) {
                    host.makeCharacterTeleportTo(entity as unknown, event.x, event.y);
                }
                break;
            }
            case 'entityAttack': {
                const attacker = host.getEntityById(event.attackerId);
                const target = host.getEntityById(event.targetId);
                if (attacker && target) {
                    host.createAttackLink(attacker as unknown, target as unknown);
                }
                break;
            }
            case 'playerMoveToItem': {
                if (event.playerId !== host.playerId) {
                    break;
                }
                const item = host.getEntityById(event.itemId);
                host.makePlayerGoToItem(item as unknown);
                break;
            }
            case 'playerChangeHealth': {
                host.player.hitPoints = event.points;
                host.updateBars();
                if (!event.isRegen) {
                    host.emit('playerHurt');
                }
                break;
            }
            case 'playerChangeMaxHitPoints': {
                host.player.setMaxHitPoints(event.maxHp);
                host.updateBars();
                break;
            }
            case 'chatMessage': {
                host.createBubble(event.entityId, event.text);
                host.audioManager?.playSound('chat');
                break;
            }
            case 'playerEquipItem': {
                runEquipItem(host, event.entityId, event.itemKind);
                break;
            }
            case 'dropItem': {
                const mob = host.getEntityById(event.mobId);
                if (!mob) {
                    break;
                }
                host.addItem(event.item, mob.gridX, mob.gridY);
                break;
            }
            case 'itemBlink': {
                const item = host.getEntityById(event.entityId);
                item?.blink?.(150);
                break;
            }
        }
    }
}

