import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import Chest from '../../chest';
import Character from '../../character';
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

type SpatialRecord = Readonly<{
    gridX: number;
    gridY: number;
    nextGridX: number;
    nextGridY: number;
    isMoving: boolean;
    kind: EntityKind;
    isPlayer: boolean;
}>;

export type ClientCommandApplySystemHost = {
    kernel: ClientWorldKernel;
    started: boolean;
    client:
        | {
              sendHello(player: unknown): void;
              sendLoot(item: { id: EntityId }): void;
              sendMove(x: number, y: number): void;
              sendZone(): void;
              sendChat(text: string): void;
              sendAttack(mob: { id: EntityId }): void;
              sendLootMove(item: { id: EntityId }, x: number, y: number): void;
              sendCheck(id: string | number): void;
              sendOpen(chest: { id: EntityId }): void;
              sendHit(mob: { id: EntityId }): void;
              sendHurt(mob: { id: EntityId }): void;
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
    enqueueZoningFrom(x: number, y: number): void;

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
    audioManager: { playSound(key: string): void; updateMusic?(): void } | null;
    createBubble(entityId: EntityId, text: string): void;
    sprites: Record<string, unknown>;
    entities: Record<string, GridIndexedEntity>;
    map: { grid: number[][]; isOutOfBounds(x: number, y: number): boolean } | null;
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

function setPathingCell(host: ClientCommandApplySystemHost, x: number, y: number, value: number): void {
    if (!host.map) {
        return;
    }
    if (host.map.isOutOfBounds(x, y)) {
        return;
    }
    host.kernel.ensureClientPathingGrid(host.map.grid);
    const grid = host.kernel.clientPathingGrid;
    if (!grid) {
        return;
    }
    grid[y][x] = value;
}

function basePathingValue(host: ClientCommandApplySystemHost, x: number, y: number): number {
    if (!host.map) {
        return 0;
    }
    if (host.map.isOutOfBounds(x, y)) {
        return 0;
    }
    return host.map.grid[y]?.[x] ?? 0;
}

function removeDynamicPathing(host: ClientCommandApplySystemHost, x: number, y: number): void {
    setPathingCell(host, x, y, basePathingValue(host, x, y));
}

function addDynamicPathing(host: ClientCommandApplySystemHost, x: number, y: number): void {
    setPathingCell(host, x, y, 1);
}

function applySpatialRemoveRecord(host: ClientCommandApplySystemHost, entityId: EntityId, record: SpatialRecord): void {
    host.kernel.applySpatialRemoveRecord(entityId, record);

    if (Types.isChest(record.kind)) {
        removeDynamicPathing(host, record.gridX, record.gridY);
        return;
    }

    if (Types.isItem(record.kind)) {
        return;
    }

    if (record.isPlayer) {
        return;
    }

    if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
        removeDynamicPathing(host, record.nextGridX, record.nextGridY);
    } else {
        removeDynamicPathing(host, record.gridX, record.gridY);
    }
}

function applySpatialAddRecord(host: ClientCommandApplySystemHost, entityId: EntityId, record: SpatialRecord): void {
    const map = host.map;
    if (!map) {
        return;
    }
    if (!map.isOutOfBounds(record.gridX, record.gridY)) {
        host.kernel.applySpatialAddRecord(entityId, record);
    }

    if (Types.isChest(record.kind)) {
        addDynamicPathing(host, record.gridX, record.gridY);
        return;
    }

    if (Types.isItem(record.kind)) {
        return;
    }

    if (record.isPlayer) {
        return;
    }

    if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
        addDynamicPathing(host, record.nextGridX, record.nextGridY);
    } else {
        addDynamicPathing(host, record.gridX, record.gridY);
    }
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
    const getKnownEntity = (id: EntityId): GridIndexedEntity | undefined => host.entities[String(id)];
    const MAX_PASSES = 10;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
        const commands: ClientCommand[] = host.kernel.drainClientCommands();
        if (commands.length === 0) {
            return;
        }

        for (const command of commands) {
            switch (command.type) {
            case 'stopPlayerCombat': {
                host.stopPlayerCombat();
                break;
            }
            case 'characterClearTarget': {
                const entity = getKnownEntity(command.entityId);
                if (entity instanceof Character) {
                    entity.disengage();
                    entity.previousTarget = null;
                    entity.unconfirmedTarget = null;
                    entity.idle();
                }
                break;
            }
            case 'clientSendHello': {
                if (!host.started || !host.client) {
                    break;
                }
                host.client.sendHello(host.player as unknown);
                break;
            }
            case 'clientSendMove': {
                if (!host.started || !host.client) {
                    break;
                }
                host.client.sendMove(command.x, command.y);
                host.kernel.clientLastSentMovePos = gridPos(command.x, command.y);
                break;
            }
            case 'clientSendZone': {
                if (!host.started || !host.client) {
                    break;
                }
                host.client.sendZone();
                break;
            }
            case 'clientSendChat': {
                if (!host.started || !host.client) {
                    break;
                }
                host.client.sendChat(command.message);
                break;
            }
            case 'clientSendAttack': {
                if (!host.started || !host.client) {
                    break;
                }
                const mob = getKnownEntity(command.mobId);
                if (mob instanceof Mob) {
                    host.client.sendAttack(mob);
                }
                break;
            }
            case 'clientSendLootMove': {
                if (!host.started || !host.client) {
                    break;
                }
                const item = getKnownEntity(command.itemId);
                if (item instanceof Item) {
                    host.client.sendLootMove(item, command.x, command.y);
                }
                break;
            }
            case 'enqueueZoningFrom': {
                host.enqueueZoningFrom(command.x, command.y);
                break;
            }
            case 'setPlayerIsOnPlateau': {
                host.player.isOnPlateau = command.isOnPlateau;
                break;
            }
            case 'setPlayerLastCheckpoint': {
                if (command.checkpoint?.id === undefined) {
                    host.player.lastCheckpoint = null;
                    break;
                }
                host.player.lastCheckpoint = { id: command.checkpoint.id };
                break;
            }
            case 'clientSendCheck': {
                if (!host.started || !host.client) {
                    break;
                }
                host.client.sendCheck(command.checkpointId);
                break;
            }
            case 'audioUpdateMusic': {
                host.audioManager?.updateMusic?.();
                break;
            }
            case 'audioPlaySound': {
                host.audioManager?.playSound(command.key);
                break;
            }
            case 'setEntityNextGrid': {
                const entity = host.entities[String(command.entityId)] as unknown as
                    | undefined
                    | { nextGridX?: number; nextGridY?: number };
                if (!entity) {
                    break;
                }
                entity.nextGridX = command.nextGridX;
                entity.nextGridY = command.nextGridY;
                break;
            }
            case 'spatialRemoveRecord': {
                applySpatialRemoveRecord(host, command.entityId, command.record);
                break;
            }
            case 'spatialAddRecord': {
                applySpatialAddRecord(host, command.entityId, command.record);
                break;
            }
            case 'combatRelinkPreviousTarget': {
                const attacker = getKnownEntity(command.attackerId);
                if (!(attacker instanceof Mob) || attacker.isMoving() || !attacker.previousTarget) {
                    break;
                }
                const prev = attacker.previousTarget as unknown as { id?: unknown };
                if (typeof prev.id !== 'number') {
                    attacker.previousTarget = null;
                    break;
                }
                const target = getKnownEntity(prev.id as EntityId);
                if (!(target instanceof Character)) {
                    attacker.previousTarget = null;
                    break;
                }
                attacker.previousTarget = null;
                host.createAttackLink(attacker as unknown, target as unknown);
                break;
            }
            case 'combatRepositionAttacker': {
                const attacker = getKnownEntity(command.attackerId);
                const target = getKnownEntity(command.targetId) as unknown as
                    | undefined
                    | { adjacentTiles?: Record<string, unknown> };
                if (!(attacker instanceof Character) || !target || !(target instanceof Character)) {
                    break;
                }

                attacker.previousTarget = target;
                attacker.disengage();
                attacker.idle();
                host.makeCharacterGoTo(attacker as unknown, command.x, command.y);

                target.adjacentTiles[String(command.orientation)] = true;
                break;
            }
            case 'characterLookAtTarget': {
                const entity = getKnownEntity(command.entityId);
                if (entity instanceof Character && entity.hasTarget()) {
                    entity.lookAtTarget();
                }
                break;
            }
            case 'characterHit': {
                const entity = getKnownEntity(command.entityId);
                if (entity instanceof Character) {
                    entity.hit();
                }
                break;
            }
            case 'characterFollow': {
                const entity = getKnownEntity(command.entityId);
                const target = getKnownEntity(command.targetId);
                if (entity instanceof Character && target instanceof Character) {
                    entity.follow(target);
                }
                break;
            }
            case 'clientSendHit': {
                if (!host.started || !host.client) {
                    break;
                }
                const entity = getKnownEntity(command.targetId);
                if (entity instanceof Mob) {
                    host.client.sendHit(entity);
                }
                break;
            }
            case 'clientSendHurt': {
                if (!host.started || !host.client) {
                    break;
                }
                const mob = getKnownEntity(command.mobId);
                if (mob instanceof Mob) {
                    host.client.sendHurt(mob);
                }
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
                    host.createAttackLink(host.player as unknown, entity as unknown);
                    if (host.started && host.client) {
                        host.client.sendAttack(entity);
                    }
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
                if (intent?.kind !== 'loot' || intent.targetId !== command.itemId) {
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
                    const entity = adapted.entity as GridIndexedEntity;
                    entity.setSprite(host.sprites[entity.getSpriteName()] ?? null);
                    entity.setGridPosition(view.position.x, view.position.y);
                    host.addEntity(entity as unknown);
                    break;
                }

                const character = adapted.entity as GridIndexedEntity;
                character.setSprite(host.sprites[character.getSpriteName()] ?? null);
                character.setGridPosition(view.position.x, view.position.y);
                const maybeOrientable = character as unknown as { setOrientation?: (orientation: number) => void };
                if (typeof maybeOrientable.setOrientation === 'function') {
                    maybeOrientable.setOrientation(safeOrientation(adapted.orientation));
                }
                (character as unknown as { idle?: () => void }).idle?.();
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

    log.error('Client command apply exceeded max passes; possible command feedback loop');
}
