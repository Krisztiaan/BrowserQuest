import log from '../../platform/log';
import Types from '../../../shared/gametypes-browser';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { EntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
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
    getEntityById(id: EntityId): GridIndexedEntity | undefined;
    removeObsoleteEntities(): void;
    makeCharacterTeleportTo(entity: unknown, x: number, y: number): void;
    makePlayerGoToItem(item: unknown): void;
    createBubble(entityId: EntityId, text: string): void;
    showNotification(message: string): void;
    tryUnlockingAchievement(key: string): void;
    addItem(item: unknown, x: number, y: number): void;
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
    host.kernel.clientLastSentMovePos = gridPos(x, y);
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
            case 'playerTeleport': {
                const entity = host.getEntityById(event.entityId);
                if (entity) {
                    host.makeCharacterTeleportTo(entity as unknown, event.x, event.y);
                }
                host.kernel.clientReplicationLastPos.set(event.entityId, gridPos(event.x, event.y));
                if (event.entityId === host.playerId) {
                    host.kernel.clientLastSentMovePos = gridPos(event.x, event.y);
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
