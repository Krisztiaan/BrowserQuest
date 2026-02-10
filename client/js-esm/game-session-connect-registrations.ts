import Character from './character';
import Item from './item';
import { handleChatMessage } from './game-session-chat-message';
import { handleEntityDespawn } from './game-session-despawn';
import { handleEntityAttack } from './game-session-entity-attack';
import { handleEntityDestroy } from './game-session-entity-destroy';
import { handleEntityMove } from './game-session-entity-move';
import { handleDisconnected } from './game-session-disconnected';
import { handleDropItem } from './game-session-drop-item';
import { handleItemBlink } from './game-session-item-blink';
import { handlePlayerChangeHealth } from './game-session-player-change-health';
import { handlePlayerDamageMob } from './game-session-player-damage-mob';
import { handlePlayerEquipItem } from './game-session-player-equip-item';
import { handlePlayerKillMob } from './game-session-player-kill-mob';
import { handlePlayerMaxHitPoints } from './game-session-player-max-hit-points';
import { handlePlayerMoveToItem } from './game-session-player-move-to-item';
import { handlePlayerTeleport } from './game-session-player-teleport';
import { handlePopulationChange } from './game-session-population-change';
import type { EntityKind } from './compat/gametypes';
import type { GameClientEventSource } from './gameclient';

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
    host.client.on('despawnEntity', function (entityId) {
        handleEntityDespawn({
            entity: host.resolveEntity(entityId) as {
                kind: EntityKind;
                id: EntityId;
                gridX: number;
                gridY: number;
                clean(): void;
            } | null,
            previousClickPosition: host.previousClickPosition,
            clearPreviousClickPosition() {
                host.clearPreviousClickPosition();
            },
            logDespawn(entity) {
                host.logInfo('Despawning ' + host.describeKind(entity.kind) + ' (' + entity.id + ')');
            },
            removeItem(item) {
                host.removeItem(item);
            },
        });
    });

    host.client.on('itemBlink', function (entityId) {
        handleItemBlink({
            item: host.resolveEntity(entityId) as { blink(speed: number): void } | null,
            speed: 150,
        });
    });

    host.client.on('entityMove', function (entityId, x, y) {
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
            moveEntity(entity, moveX, moveY) {
                host.moveCharacterTo(entity, moveX, moveY);
            },
        });
    });

    host.client.on('entityDestroy', function (entityId) {
        handleEntityDestroy<DestroyableEntity>({
            entity: host.resolveEntity(entityId) as DestroyableEntity | null,
            removeItem(item) {
                host.removeItem(item);
            },
            removeEntity(entity) {
                host.removeEntity(entity);
            },
            logDestroyed(entity) {
                host.logDebug('Entity was destroyed: ' + entity.id);
            },
        });
    });

    host.client.on('playerMoveToItem', function (playerId, itemId) {
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
            movePlayerTo(player, x, y) {
                host.moveCharacterTo(player, x, y);
            },
        });
    });

    host.client.on('entityAttack', function (attackerId, targetId) {
        handleEntityAttack({
            attacker: host.resolveEntity(attackerId) as { id: EntityId } | null,
            target: host.resolveEntity(targetId) as { id: EntityId } | null,
            playerId: host.playerId,
            logAttack(attacker, target) {
                host.logDebug(attacker.id + ' attacks ' + target.id);
            },
            createAttackLink(attacker, target) {
                host.createAttackLink(attacker, target);
            },
            scheduleAttackLink(attacker, target, delayMs) {
                host.schedule(function () {
                    host.createAttackLink(attacker, target);
                }, delayMs);
            },
        });
    });

    host.client.on('playerDamageMob', function (mobId, points) {
        handlePlayerDamageMob({
            mob: host.resolveEntity(mobId) as { x: number; y: number } | null,
            points,
            addDamageInfo(damagePoints, x, y, kind) {
                host.addDamageInfo(damagePoints, x, y, kind);
            },
        });
    });

    host.client.on('playerKillMob', function (kind) {
        handlePlayerKillMob({
            kind,
            getMobName(entityKind) {
                return host.describeKind(entityKind);
            },
            showNotification(message) {
                host.showNotification(message);
            },
            incrementTotalKills() {
                host.incrementTotalKills();
            },
            unlockAchievement(achievementId) {
                host.unlockAchievement(achievementId);
            },
            isRat(entityKind) {
                return host.isRat(entityKind);
            },
            isSkeleton(entityKind) {
                return host.isSkeleton(entityKind);
            },
            isBoss(entityKind) {
                return host.isBoss(entityKind);
            },
            incrementRatCount() {
                host.incrementRatCount();
            },
            incrementSkeletonCount() {
                host.incrementSkeletonCount();
            },
        });
    });

    host.client.on('playerChangeHealth', function (points, isRegen) {
        handlePlayerChangeHealth({
            player: host.player,
            points,
            isRegen,
            addDamageInfo(value, x, y, type) {
                host.addDamageInfo(value, x, y, type);
            },
            playHurtSound() {
                host.playHurtSound();
            },
            addStoredDamage(value) {
                host.addStoredDamage(value);
            },
            unlockMeatshieldAchievement() {
                host.unlockAchievement('MEATSHIELD');
            },
            onPlayerHurt() {
                host.onPlayerHurt();
            },
            updateBars() {
                host.updateBars();
            },
        });
    });

    host.client.on('playerChangeMaxHitPoints', function (hp) {
        if (!host.player) {
            return;
        }

        handlePlayerMaxHitPoints({
            player: host.player,
            hp,
            updateBars() {
                host.updateBars();
            },
        });
    });

    host.client.on('playerEquipItem', function (playerId, itemKind) {
        handlePlayerEquipItem({
            player: host.resolveEntity(playerId) as {
                setSprite(sprite: unknown): void;
                setWeaponName?(name: string): void;
            } | null,
            itemKind,
            getItemName(kind) {
                return host.getItemName(kind);
            },
            isArmor(kind) {
                return host.isArmor(kind);
            },
            isWeapon(kind) {
                return host.isWeapon(kind);
            },
            getSprite(itemName) {
                return host.getSprite(itemName);
            },
        });
    });

    host.client.on('playerTeleport', function (entityId, x, y) {
        handlePlayerTeleport<Character>({
            entityId,
            localPlayerId: host.playerId,
            x,
            y,
            resolveEntity(id) {
                return host.resolveEntity(id) as Character | null;
            },
            teleportEntity(entity, teleportX, teleportY) {
                host.teleportCharacterTo(entity, teleportX, teleportY);
            },
        });
    });

    host.client.on('dropItem', function (item, mobId) {
        handleDropItem({
            item,
            mobId,
            resolveDeadMobPosition(candidateMobId) {
                return host.resolveDeadMobPosition(candidateMobId);
            },
            addItem(droppedItem, x, y) {
                host.addItem(droppedItem, x, y);
            },
            updateCursor() {
                host.updateCursor();
            },
        });
    });

    host.client.on('chatMessage', function (entityId, message) {
        handleChatMessage({
            entityId,
            message,
            resolveEntity(id) {
                return host.resolveEntity(id);
            },
            createBubble(id, text) {
                host.createBubble(id, text);
            },
            assignBubbleTo(entity) {
                host.assignBubbleTo(entity);
            },
            playChatSound() {
                host.playChatSound();
            },
        });
    });

    host.client.on('populationChange', function (worldPlayers, totalPlayers) {
        handlePopulationChange({
            worldPlayers,
            totalPlayers,
            onPlayersChanged: host.onPlayersChanged,
        });
    });

    host.client.on('disconnected', function (message) {
        handleDisconnected({
            player: host.player,
            message,
            onDisconnect: host.onDisconnect,
        });
    });
}
