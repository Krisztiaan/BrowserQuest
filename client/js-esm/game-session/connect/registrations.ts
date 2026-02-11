import Character from '../../character';
import Item from '../../item';
import { handleChatMessage } from '../connection/chat-message';
import { handleEntityDespawn } from '../entity/despawn';
import { handleEntityAttack } from '../entity/attack';
import { handleEntityDestroy } from '../entity/destroy';
import { handleEntityMove } from '../entity/move';
import { handleDisconnected } from '../connection/disconnected';
import { handleDropItem } from '../item/drop';
import { handleItemBlink } from '../item/blink';
import { handlePlayerChangeHealth } from '../player/change-health';
import { handlePlayerDamageMob } from '../player/damage-mob';
import { handlePlayerEquipItem } from '../player/equip-item';
import { handlePlayerKillMob } from '../player/kill-mob';
import { handlePlayerMaxHitPoints } from '../player/max-hit-points';
import { handlePlayerMoveToItem } from '../player/move-to-item';
import { handlePlayerTeleport } from '../player/teleport';
import { handlePopulationChange } from '../connection/population-change';
import type { EntityKind } from '../../../../shared/js/entity-kind-domain';
import type { GameClientEventSource } from '../../gameclient';

type EntityId = string | number;
type GridPosition = { x: number; y: number };

type ConnectRegistrationClient = {
    on: GameClientEventSource['on'];
};

type SessionPlayer = {
    hitPoints: number;
    maxHitPoints: number;
    isDead: boolean;
    invincible: boolean;
    x: number;
    y: number;
    die(): void;
    hurt(): void;
    isAttackedBy(entity: Character): boolean;
};

type ConnectRegistrationHost = {
    client: ConnectRegistrationClient;
    playerId: EntityId | null;
    player: SessionPlayer | null;
    previousClickPosition: Partial<GridPosition>;
    resolveEntity(entityId: EntityId): unknown | null;
    clearPreviousClickPosition(): void;
    describeKind(kind: EntityKind): string;
    logInfo(message: string): void;
    logDebug(message: string): void;
    removeItem(item: Item): void;
    removeEntity(entity: { id: EntityId }): void;
    moveCharacterTo(character: Character, x: number, y: number): void;
    createAttackLink(attacker: Character, target: Character): void;
    schedule(callback: () => void, delayMs: number): void;
    addDamageInfo(value: number | string, x: number, y: number, kind: 'received' | 'healed' | 'inflicted'): void;
    playHurtSound(): void;
    playChatSound(): void;
    addStoredDamage(value: number): void;
    unlockAchievement(id: 'COWARD' | 'MEATSHIELD' | 'HUNTER' | 'ANGRY_RATS' | 'SKULL_COLLECTOR' | 'HERO'): void;
    onPlayerHurt(): void;
    updateBars(): void;
    getItemName(kind: EntityKind): string;
    isArmor(kind: EntityKind): boolean;
    isWeapon(kind: EntityKind): boolean;
    getSprite(name: string): unknown;
    teleportCharacterTo(character: Character, x: number, y: number): void;
    resolveDeadMobPosition(mobId: EntityId): GridPosition | null;
    addItem(item: unknown, x: number, y: number): void;
    updateCursor(): void;
    createBubble(entityId: EntityId, message: string): void;
    assignBubbleTo(entity: unknown | null): void;
    onPlayersChanged: ((worldPlayers: number, totalPlayers: number) => void) | null;
    onDisconnect: ((message: string) => void) | null;
    showNotification(message: string): void;
    incrementTotalKills(): void;
    incrementRatCount(): void;
    incrementSkeletonCount(): void;
    isRat(kind: EntityKind): boolean;
    isSkeleton(kind: EntityKind): boolean;
    isBoss(kind: EntityKind): boolean;
};

type MoveToItemTarget = {
    gridX: number;
    gridY: number;
};

type DestroyableEntity = {
    id: EntityId;
};

export function registerConnectSessionHandlers(host: ConnectRegistrationHost): void {
    host.client.on('despawnEntity', function (entityId: EntityId) {
        handleEntityDespawn({
            entity: host.resolveEntity(entityId) as {
                kind: EntityKind;
                id: EntityId;
                gridX: number;
                gridY: number;
                clean(): void;
            } | null,
            previousClickPosition: host.previousClickPosition,
            clearPreviousClickPosition: host.clearPreviousClickPosition,
            logDespawn(entity) {
                host.logInfo('Despawning ' + host.describeKind(entity.kind) + ' (' + entity.id + ')');
            },
            removeItem: host.removeItem,
        });
    });

    host.client.on('itemBlink', function (entityId: EntityId) {
        handleItemBlink({
            item: host.resolveEntity(entityId) as { blink(speed: number): void } | null,
            speed: 150,
        });
    });

    host.client.on('entityMove', function (entityId: EntityId, x: number, y: number) {
        handleEntityMove<Character>({
            entityId,
            playerId: host.playerId,
            x,
            y,
            resolveEntity(id) {
                return host.resolveEntity(id) as Character | null;
            },
            isPlayerAttackedBy(entity) {
                if (!host.player) {
                    return false;
                }
                return host.player.isAttackedBy(entity);
            },
            unlockCowardAchievement() {
                host.unlockAchievement('COWARD');
            },
            moveEntity: host.moveCharacterTo,
        });
    });

    host.client.on('entityDestroy', function (entityId: EntityId) {
        handleEntityDestroy<DestroyableEntity>({
            entity: host.resolveEntity(entityId) as DestroyableEntity | null,
            removeItem: host.removeItem,
            removeEntity: host.removeEntity,
            logDestroyed(entity) {
                host.logDebug('Entity was destroyed: ' + entity.id);
            },
        });
    });

    host.client.on('playerMoveToItem', function (playerId: EntityId, itemId: EntityId) {
        handlePlayerMoveToItem<Character, MoveToItemTarget>({
            playerId,
            localPlayerId: host.playerId,
            itemId,
            resolvePlayer(entityId) {
                return host.resolveEntity(entityId) as Character | null;
            },
            resolveItem(entityId) {
                return host.resolveEntity(entityId) as MoveToItemTarget | null;
            },
            movePlayerTo: host.moveCharacterTo,
        });
    });

    host.client.on('entityAttack', function (attackerId: EntityId, targetId: EntityId) {
        handleEntityAttack({
            attacker: host.resolveEntity(attackerId) as { id: EntityId } | null,
            target: host.resolveEntity(targetId) as { id: EntityId } | null,
            playerId: host.playerId,
            logAttack(attacker, target) {
                host.logDebug(attacker.id + ' attacks ' + target.id);
            },
            createAttackLink: host.createAttackLink,
            scheduleAttackLink(attacker, target, delayMs) {
                host.schedule((): void => host.createAttackLink(attacker, target), delayMs);
            },
        });
    });

    host.client.on('playerDamageMob', function (mobId: EntityId, points: number) {
        handlePlayerDamageMob({
            mob: host.resolveEntity(mobId) as { x: number; y: number } | null,
            points,
            addDamageInfo: host.addDamageInfo,
        });
    });

    host.client.on('playerKillMob', function (kind: EntityKind) {
        handlePlayerKillMob({
            kind,
            getMobName: host.describeKind,
            showNotification: host.showNotification,
            incrementTotalKills: host.incrementTotalKills,
            unlockAchievement(achievementId) {
                host.unlockAchievement(achievementId);
            },
            isRat: host.isRat,
            isSkeleton: host.isSkeleton,
            isBoss: host.isBoss,
            incrementRatCount: host.incrementRatCount,
            incrementSkeletonCount: host.incrementSkeletonCount,
        });
    });

    host.client.on('playerChangeHealth', function (points: number, isRegen: boolean) {
        handlePlayerChangeHealth({
            player: host.player,
            points,
            isRegen,
            addDamageInfo: host.addDamageInfo,
            playHurtSound: host.playHurtSound,
            addStoredDamage: host.addStoredDamage,
            unlockMeatshieldAchievement() {
                host.unlockAchievement('MEATSHIELD');
            },
            onPlayerHurt: host.onPlayerHurt,
            updateBars: host.updateBars,
        });
    });

    host.client.on('playerChangeMaxHitPoints', function (hp: number) {
        if (!host.player) {
            return;
        }

        handlePlayerMaxHitPoints({
            player: host.player,
            hp,
            updateBars: host.updateBars,
        });
    });

    host.client.on('playerEquipItem', function (playerId: EntityId, itemKind: EntityKind) {
        handlePlayerEquipItem({
            player: host.resolveEntity(playerId) as {
                setSprite(sprite: unknown): void;
                setWeaponName?(name: string): void;
            } | null,
            itemKind,
            getItemName: host.getItemName,
            isArmor: host.isArmor,
            isWeapon: host.isWeapon,
            getSprite: host.getSprite,
        });
    });

    host.client.on('playerTeleport', function (entityId: EntityId, x: number, y: number) {
        handlePlayerTeleport<Character>({
            entityId,
            localPlayerId: host.playerId,
            x,
            y,
            resolveEntity(id) {
                return host.resolveEntity(id) as Character | null;
            },
            teleportEntity: host.teleportCharacterTo,
        });
    });

    host.client.on('dropItem', function (item: unknown, mobId: EntityId) {
        handleDropItem({
            item,
            mobId,
            resolveDeadMobPosition: host.resolveDeadMobPosition,
            addItem: host.addItem,
            updateCursor: host.updateCursor,
        });
    });

    host.client.on('chatMessage', function (entityId: EntityId, message: string) {
        handleChatMessage({
            entityId,
            message,
            resolveEntity: host.resolveEntity,
            createBubble: host.createBubble,
            assignBubbleTo: host.assignBubbleTo,
            playChatSound: host.playChatSound,
        });
    });

    host.client.on('populationChange', function (worldPlayers: number, totalPlayers: number) {
        handlePopulationChange({
            worldPlayers,
            totalPlayers,
            onPlayersChanged: host.onPlayersChanged,
        });
    });

    host.client.on('disconnected', function (message: string) {
        handleDisconnected({
            player: host.player,
            message,
            onDisconnect: host.onDisconnect,
        });
    });
}
