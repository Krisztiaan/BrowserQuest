import Character from './character';
import Item from './item';
import log from './compat/log';
import Types from './compat/gametypes';
import { registerConnectSessionHandlers } from './game-session-connect-registrations';
import type { EntityKind } from './compat/gametypes';
import type { GameClientEventSource } from './gameclient';

type EntityId = string | number;
type GridPosition = { x: number; y: number };
type AchievementId = 'COWARD' | 'MEATSHIELD' | 'HUNTER' | 'ANGRY_RATS' | 'SKULL_COLLECTOR' | 'HERO';

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

type ConnectSessionBuilderGame = {
    client: {
        on: GameClientEventSource['on'];
    } | null;
    playerId: EntityId | null;
    player: SessionPlayer | null;
    previousClickPosition: Partial<GridPosition>;
    emit(eventName: 'nbPlayersChange', worldPlayers: number, totalPlayers: number): void;
    emit(eventName: 'disconnect', message: string): void;
    emit(eventName: 'playerHurt'): void;
    infoManager: {
        addDamageInfo(value: number | string, x: number, y: number, kind: 'received' | 'healed' | 'inflicted'): void;
    };
    audioManager: {
        playSound(sound: 'hurt' | 'chat'): void;
    };
    storage: {
        addDamage(value: number): void;
        incrementTotalKills(): void;
        incrementRatCount(): void;
        incrementSkeletonCount(): void;
    };
    sprites: Record<string, unknown>;
    getEntityById(entityId: EntityId): unknown | null;
    removeItem(item: Item): void;
    addItem(item: Item, x: number, y: number): void;
    makeCharacterGoTo(character: Character, x: number, y: number): void;
    createAttackLink(attacker: Character, target: Character): void;
    tryUnlockingAchievement(id: AchievementId): void;
    updateBars(): void;
    makeCharacterTeleportTo(character: Character, x: number, y: number): void;
    getDeadMobPosition(mobId: EntityId): GridPosition | null;
    updateCursor(): void;
    createBubble(entityId: EntityId, message: string): void;
    showNotification(message: string): void;
};

type ConnectSessionBuilderHost = {
    game: ConnectSessionBuilderGame;
    removeEntity(entity: { id: EntityId }): void;
    assignBubbleTo(entity: unknown | null): void;
};

export function installConnectSessionHandlersFromGame(host: ConnectSessionBuilderHost): void {
    const game = host.game;
    if (!game.client) {
        return;
    }

    registerConnectSessionHandlers({
        client: game.client,
        playerId: game.playerId,
        player: game.player,
        previousClickPosition: game.previousClickPosition,
        resolveEntity(entityId) {
            return game.getEntityById(entityId);
        },
        clearPreviousClickPosition() {
            game.previousClickPosition = {};
        },
        describeKind(kind) {
            return Types.getKindAsString(kind);
        },
        logInfo(message) {
            log.info(message);
        },
        logDebug(message) {
            log.debug(message);
        },
        removeItem(item) {
            game.removeItem(item);
        },
        removeEntity(entity) {
            host.removeEntity(entity);
        },
        moveCharacterTo(character, x, y) {
            game.makeCharacterGoTo(character, x, y);
        },
        createAttackLink(attacker, target) {
            game.createAttackLink(attacker, target);
        },
        schedule(callback, delayMs) {
            setTimeout(function () {
                callback();
            }, delayMs);
        },
        addDamageInfo(value, x, y, kind) {
            game.infoManager.addDamageInfo(value, x, y, kind);
        },
        playHurtSound() {
            game.audioManager.playSound('hurt');
        },
        playChatSound() {
            game.audioManager.playSound('chat');
        },
        addStoredDamage(value) {
            game.storage.addDamage(value);
        },
        unlockAchievement(achievementId) {
            game.tryUnlockingAchievement(achievementId);
        },
        onPlayerHurt() {
            game.emit('playerHurt');
        },
        updateBars() {
            game.updateBars();
        },
        getItemName(kind) {
            return Types.getKindAsString(kind);
        },
        isArmor(kind) {
            return Types.isArmor(kind);
        },
        isWeapon(kind) {
            return Types.isWeapon(kind);
        },
        getSprite(itemName) {
            return game.sprites[itemName];
        },
        teleportCharacterTo(character, x, y) {
            game.makeCharacterTeleportTo(character, x, y);
        },
        resolveDeadMobPosition(mobId) {
            return game.getDeadMobPosition(mobId);
        },
        addItem(item, x, y) {
            game.addItem(item as Item, x, y);
        },
        updateCursor() {
            game.updateCursor();
        },
        createBubble(entityId, message) {
            game.createBubble(entityId, message);
        },
        assignBubbleTo(entity) {
            host.assignBubbleTo(entity);
        },
        onPlayersChanged(worldPlayers, totalPlayers) {
            game.emit('nbPlayersChange', worldPlayers, totalPlayers);
        },
        onDisconnect(message) {
            game.emit('disconnect', message);
        },
        showNotification(message) {
            game.showNotification(message);
        },
        incrementTotalKills() {
            game.storage.incrementTotalKills();
        },
        incrementRatCount() {
            game.storage.incrementRatCount();
        },
        incrementSkeletonCount() {
            game.storage.incrementSkeletonCount();
        },
        isRat(kind) {
            return kind === Types.Entities.RAT;
        },
        isSkeleton(kind) {
            return kind === Types.Entities.SKELETON || kind === Types.Entities.SKELETON2;
        },
        isBoss(kind) {
            return kind === Types.Entities.BOSS;
        },
    });
}
