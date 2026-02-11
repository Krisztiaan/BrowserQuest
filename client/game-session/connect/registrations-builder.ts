import Character from '../../character';
import Item from '../../item';
import log from '../../platform/log';
import Types from '../../../shared/gametypes-browser';
import { registerConnectSessionHandlers } from './registrations';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { GameClientEventSource } from '../../gameclient';

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
    const bindGame = <T extends (...args: any[]) => any>(fn: T): T => fn.bind(game) as T;
    const bindStorage = <T extends (...args: any[]) => any>(fn: T): T => fn.bind(game.storage) as T;
    const bindAudio = <T extends (...args: any[]) => any>(fn: T): T => fn.bind(game.audioManager) as T;
    const bindInfo = <T extends (...args: any[]) => any>(fn: T): T => fn.bind(game.infoManager) as T;
    const playSound = bindAudio(game.audioManager.playSound);

    registerConnectSessionHandlers({
        client: game.client,
        playerId: game.playerId,
        player: game.player,
        previousClickPosition: game.previousClickPosition,
        resolveEntity: bindGame(game.getEntityById),
        clearPreviousClickPosition() {
            game.previousClickPosition = {};
        },
        describeKind(kind) {
            return Types.getKindAsString(kind) ?? 'unknown';
        },
        logInfo(message) {
            log.info(message);
        },
        logDebug(message) {
            log.debug(message);
        },
        removeItem: bindGame(game.removeItem),
        removeEntity(entity) {
            host.removeEntity(entity);
        },
        moveCharacterTo: bindGame(game.makeCharacterGoTo),
        createAttackLink: bindGame(game.createAttackLink),
        schedule(callback, delayMs) {
            setTimeout(callback, delayMs);
        },
        addDamageInfo: bindInfo(game.infoManager.addDamageInfo),
        playHurtSound() {
            playSound('hurt');
        },
        playChatSound() {
            playSound('chat');
        },
        addStoredDamage: bindStorage(game.storage.addDamage),
        unlockAchievement(achievementId) {
            game.tryUnlockingAchievement(achievementId);
        },
        onPlayerHurt() {
            game.emit('playerHurt');
        },
        updateBars: bindGame(game.updateBars),
        getItemName(kind) {
            return Types.getKindAsString(kind) ?? 'unknown';
        },
        isArmor: Types.isArmor,
        isWeapon: Types.isWeapon,
        getSprite(itemName) {
            return game.sprites[itemName];
        },
        teleportCharacterTo: bindGame(game.makeCharacterTeleportTo),
        resolveDeadMobPosition: bindGame(game.getDeadMobPosition),
        addItem(item, x, y) {
            game.addItem(item as Item, x, y);
        },
        updateCursor: bindGame(game.updateCursor),
        createBubble: bindGame(game.createBubble),
        assignBubbleTo(entity) {
            host.assignBubbleTo(entity);
        },
        onPlayersChanged(worldPlayers, totalPlayers) {
            game.emit('nbPlayersChange', worldPlayers, totalPlayers);
        },
        onDisconnect(message) {
            game.emit('disconnect', message);
        },
        showNotification: bindGame(game.showNotification),
        incrementTotalKills: bindStorage(game.storage.incrementTotalKills),
        incrementRatCount: bindStorage(game.storage.incrementRatCount),
        incrementSkeletonCount: bindStorage(game.storage.incrementSkeletonCount),
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
