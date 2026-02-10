import type { RuntimeEventName } from './server-event-names';
import type { EntityKind, EntityKindName } from '../../shared/js/entity-kind-domain';
import type { WorldMessage } from './worldserver-contracts';
import Entity from './entity';
import Character from './character';
import Log from './log';
import Mob from './mob';
import Map from './map';
import Npc from './npc';
import Player from './player';
import Item from './item';
import MobArea from './mobarea';
import ChestArea from './chestarea';
import Chest from './chest';
import Messages from './message';
import Properties from './properties';
import Utils from './utils';
import { installWorldPlayerLifecycle } from './worldserver-player-lifecycle';
import {
    addWorldEntity,
    addWorldItem,
    addWorldItemFromChest,
    addWorldMob,
    addWorldNpc,
    addWorldPlayer,
    addWorldStaticItem,
    removeWorldEntity,
    removeWorldPlayer,
} from './worldserver-entity-mutations';
import {
    addMobToContainingChestAreas,
    createWorldChest,
    createWorldItem,
    handleEmptyChestAreaRefill,
    handleOpenedChestOrchestration,
    spawnStaticEntitiesForWorld,
    scheduleWorldItemDespawn,
} from './worldserver-chest-item-lifecycle';
import { handleWorldHurtEntity } from './worldserver-hurt-entity';
import {
    broadcastWorldAttacker,
    despawnWorldEntity,
    findWorldPositionNextTo,
    getWorldEntityById,
    handleWorldPlayerVanish,
    isWorldPositionValid,
    moveWorldEntity,
    selectDroppedItemForMob,
} from './worldserver-entity-utilities';
import {
    forEachEntityInWorldMap,
    forEachWorldCharacter,
    initializeWorldZoneGroups,
    processWorldGroups,
    processWorldOutgoingQueues,
    pushRelevantEntityListToPlayer,
    pushWorldSpawnsToPlayer,
} from './worldserver-group-flow';
import {
    addEntityAsIncomingToGroups,
    addEntityToWorldGroup,
    handleWorldEntityGroupMembership,
    logWorldGroupPlayers,
    removeEntityFromWorldGroups,
} from './worldserver-group-membership-orchestration';
import {
    chooseWorldMobTarget,
    clearWorldMobAggroLink,
    clearWorldMobHateLinks,
    handleWorldMobHate,
    handleWorldMobMoveCallback,
} from './worldserver-mob-orchestration';
import {
    countPlayersInWorld,
    decrementWorldPlayerCount,
    incrementWorldPlayerCount,
    notifyWorldPopulation,
    setWorldPlayerCount,
} from './worldserver-population';
import {
    pushSerializedToWorldAdjacentGroupsQueue,
    pushSerializedToWorldGroupQueue,
    pushSerializedToWorldPlayerQueue,
    pushWorldBroadcastMessage,
    pushWorldMessageToAdjacentGroups,
    pushWorldMessageToGroup,
    pushWorldMessageToPlayer,
    pushWorldMessageToPreviousGroups,
} from './worldserver-push';
import Types from '../../shared/js/gametypes';
import { Evented } from '../../shared/js/evented';
const log = Log.getLogger();
const logWorldQueueError = (errorMessage: string): void => {
    log.error(errorMessage);
};

// ======= GAME SERVER ========

type EntityId = string | number;

type WorldEntity = Entity;
type WorldPlayer = Player;
type WorldMob = Mob;
type WorldNpc = Npc;
type WorldItem = Item;
type WorldChest = Chest;
type MapMobAreaConfig = {
    id: string | number;
    nb: number;
    type: EntityKindName;
    x: number;
    y: number;
    width: number;
    height: number;
};

type MapChestAreaConfig = {
    id: string | number;
    x: number;
    y: number;
    w: number;
    h: number;
    tx: number;
    ty: number;
    i: unknown[];
};

type MapChestConfig = {
    x: number;
    y: number;
    i: unknown[];
};
const isMapMobAreaConfig = (value: unknown): value is MapMobAreaConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapMobAreaConfig>;
    return (
        (typeof entry.id === 'string' || typeof entry.id === 'number')
        && typeof entry.nb === 'number'
        && typeof entry.type === 'string'
        && typeof entry.x === 'number'
        && typeof entry.y === 'number'
        && typeof entry.width === 'number'
        && typeof entry.height === 'number'
    );
};
const isMapChestAreaConfig = (value: unknown): value is MapChestAreaConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapChestAreaConfig>;
    return (
        (typeof entry.id === 'string' || typeof entry.id === 'number')
        && typeof entry.x === 'number'
        && typeof entry.y === 'number'
        && typeof entry.w === 'number'
        && typeof entry.h === 'number'
        && typeof entry.tx === 'number'
        && typeof entry.ty === 'number'
        && Array.isArray(entry.i)
    );
};
const isMapChestConfig = (value: unknown): value is MapChestConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapChestConfig>;
    return typeof entry.x === 'number' && typeof entry.y === 'number' && Array.isArray(entry.i);
};

type WorldMapLike = {
    ready(callback: () => void): void;
    generateCollisionGrid(): void;
    getRandomStartingPosition(): { x: number; y: number };
    tileIndexToGridPosition(tileIndex: number): { x: number; y: number };
    isOutOfBounds(x: number, y: number): boolean;
    isColliding(x: number, y: number): boolean;
    getGroupIdFromPosition(x: number, y: number): string;
    forEachGroup(callback: (id: string) => void): void;
    forEachAdjacentGroup(groupId: string, callback: (id: string) => void): void;
    staticEntities?: Record<string, string>;
    mobAreas?: unknown[];
    chestAreas?: unknown[];
    staticChests?: unknown[];
};
type SpawnableEntity = {
    id: number;
    x: number;
    y: number;
    kind: EntityKind;
    getState(): Array<number | string>;
};
const isSpawnableEntity = (entity: unknown): entity is SpawnableEntity =>
    typeof entity === 'object'
    && entity !== null
    && typeof (entity as { id?: unknown }).id === 'number'
    && typeof (entity as { x?: unknown }).x === 'number'
    && typeof (entity as { y?: unknown }).y === 'number'
    && typeof (entity as { kind?: unknown }).kind === 'number'
    && typeof (entity as { getState?: unknown }).getState === 'function';

type WorldConnection = {
    send(payload: unknown): void;
};

type WorldServerLike = {
    getConnection(id: string | number): WorldConnection | undefined;
};

type WorldGroup = {
    entities: Record<string, WorldEntity>;
    players: EntityId[];
    incoming: WorldEntity[];
};
type WorldAttackEvent = {
    id: string | number;
    group: string;
    attack(): WorldMessage;
    target?: EntityId | null;
    type?: string;
};

type WorldEvents = {
    init: [];
    playerConnect: [player: WorldPlayer];
    playerEnter: [player: WorldPlayer];
    playerAdded: [];
    playerRemoved: [];
    regenTick: [];
    entityAttack: [attacker: WorldAttackEvent];
};

class World extends Evented<WorldEvents> {
    id: string;
    maxPlayers: number;
    server: WorldServerLike;
    ups: number;

    map: WorldMapLike;

    entities: Record<string, WorldEntity>;
    players: Record<string, WorldPlayer>;
    mobs: Record<string, WorldMob>;
    attackers: Record<string, WorldEntity>;
    items: Record<string, WorldItem | WorldChest>;
    equipping: Record<string, WorldEntity>;
    hurt: Record<string, WorldEntity>;
    npcs: Record<string, WorldNpc>;
    mobAreas: InstanceType<typeof MobArea>[];
    chestAreas: InstanceType<typeof ChestArea>[];
    groups: Record<string, WorldGroup>;

    outgoingQueues: Record<string, unknown[]>;

    itemCount: number;
    playerCount: number;

    zoneGroupsReady: boolean;

    constructor(id, maxPlayers, websocketServer) {
        super();
        var self = this;

        this.id = id;
        this.maxPlayers = maxPlayers;
        this.server = websocketServer;
        this.ups = 50;

        this.map = null as unknown as WorldMapLike;

        this.entities = {};
        this.players = {};
        this.mobs = {};
        this.attackers = {};
        this.items = {};
        this.equipping = {};
        this.hurt = {};
        this.npcs = {};
        this.mobAreas = [];
        this.chestAreas = [];
        this.groups = {};

        this.outgoingQueues = {};

        this.itemCount = 0;
        this.playerCount = 0;

        this.zoneGroupsReady = false;
        installWorldPlayerLifecycle(this);

        // Called when an entity is attacked by another entity
        this.on('entityAttack', function (attacker) {
            if (attacker.type === 'mob') {
                const mobAttacker = attacker as unknown as Mob;
                var target = self.getEntityById(mobAttacker.target);
                if (target) {
                    var pos = self.findPositionNextTo(mobAttacker, target);
                    self.moveEntity(mobAttacker, pos.x, pos.y);
                }
            }
        });

        this.on('regenTick', function () {
            self.forEachCharacter(function (character) {
                if (!character.hasFullHealth()) {
                    character.regenHealthBy(Math.floor(character.maxHitPoints / 25));

                    if (character.type === 'player') {
                        self.pushToPlayer(character, character.regen());
                    }
                }
            });
        });
    }

    run(mapFilePath) {
        var self = this;

        this.map = new Map(mapFilePath);

        this.map.ready(function () {
            self.initZoneGroups();

            self.map.generateCollisionGrid();

            // Populate all mob "roaming" areas
            (self.map.mobAreas || []).filter(isMapMobAreaConfig).forEach(function (a) {
                var area = new MobArea(a.id, a.nb, a.type, a.x, a.y, a.width, a.height, self);
                area.spawnMobs();
                area.on('empty', self.handleEmptyMobArea.bind(self, area));

                self.mobAreas.push(area);
            });

            // Create all chest areas
            (self.map.chestAreas || []).filter(isMapChestAreaConfig).forEach(function (a) {
                var area = new ChestArea(a.id, a.x, a.y, a.w, a.h, a.tx, a.ty, a.i, self);
                self.chestAreas.push(area);
                area.on('empty', self.handleEmptyChestArea.bind(self, area));
            });

            // Spawn static chests
            (self.map.staticChests || []).filter(isMapChestConfig).forEach(function (chest) {
                var c = self.createChest(chest.x, chest.y, chest.i);
                self.addStaticItem(c);
            });

            // Spawn static entities
            self.spawnStaticEntities();

            // Set maximum number of entities contained in each chest area
            self.chestAreas.forEach(function (area) {
                area.setNumberOfEntities(area.entities.length);
            });
        });

        var regenCount = this.ups * 2;
        var updateCount = 0;
        setInterval(function () {
            self.processGroups();
            self.processQueues();

            if (updateCount < regenCount) {
                updateCount += 1;
            } else {
                self.emit('regenTick');
                updateCount = 0;
            }
        }, 1000 / this.ups);

        log.info('' + this.id + ' created (capacity: ' + this.maxPlayers + ' players).');
    }

    setUpdatesPerSecond(ups) {
        this.ups = ups;
    }

    pushRelevantEntityListTo(player) {
        pushRelevantEntityListToPlayer({
            player,
            groups: this.groups,
            pushToPlayer: this.pushToPlayer.bind(this),
            createListMessage(entityIds) {
                return new Messages.List(entityIds);
            },
        });
    }

    pushSpawnsToPlayer(player, ids) {
        pushWorldSpawnsToPlayer({
            player,
            ids,
            getEntityById: this.getEntityById.bind(this),
            isSpawnableEntity,
            pushToPlayer: this.pushToPlayer.bind(this),
            createSpawnMessage(entity) {
                return new Messages.Spawn(entity);
            },
            logDebug(message) {
                log.debug(message);
            },
        });
    }

    pushToPlayer(player, message) {
        pushWorldMessageToPlayer({
            player,
            message,
            pushSerializedToPlayer: this.pushSerializedToPlayer.bind(this),
        });
    }

    pushSerializedToPlayer(player, serializedMessage) {
        pushSerializedToWorldPlayerQueue(
            this.outgoingQueues,
            player,
            serializedMessage,
            logWorldQueueError
        );
    }

    pushToGroup(groupId, message, ignoredPlayer = null) {
        pushWorldMessageToGroup({
            groupId,
            message,
            ignoredPlayer,
            pushSerializedToGroup: this.pushSerializedToGroup.bind(this),
        });
    }

    pushSerializedToGroup(groupId, serializedMessage, ignoredPlayer = null) {
        pushSerializedToWorldGroupQueue({
            groups: this.groups,
            outgoingQueues: this.outgoingQueues,
            groupId,
            serializedMessage,
            ignoredPlayer,
            getEntityById: this.getEntityById.bind(this),
            logError: logWorldQueueError,
        });
    }

    pushToAdjacentGroups(groupId, message, ignoredPlayer = null) {
        pushWorldMessageToAdjacentGroups({
            groupId,
            message,
            ignoredPlayer,
            pushSerializedToAdjacentGroups: (
                queueGroupId,
                serializedMessage,
                queueIgnoredPlayer
            ) => {
                pushSerializedToWorldAdjacentGroupsQueue({
                    map: this.map,
                    groups: this.groups,
                    outgoingQueues: this.outgoingQueues,
                    groupId: queueGroupId,
                    serializedMessage,
                    ignoredPlayer: queueIgnoredPlayer ?? null,
                    getEntityById: this.getEntityById.bind(this),
                    logError: logWorldQueueError,
                });
            },
        });
    }

    pushToPreviousGroups(player, message) {
        pushWorldMessageToPreviousGroups(player, message, this.pushToGroup.bind(this));
    }

    pushBroadcast(message, ignoredPlayer = null) {
        pushWorldBroadcastMessage({
            message,
            ignoredPlayer,
            outgoingQueues: this.outgoingQueues,
        });
    }

    processQueues() {
        processWorldOutgoingQueues(this.outgoingQueues, this.server.getConnection.bind(this.server));
    }

    addEntity(entity) {
        addWorldEntity({
            entity,
            entities: this.entities,
            handleEntityGroupMembership: this.handleEntityGroupMembership.bind(this),
        });
    }

    removeEntity(entity) {
        removeWorldEntity({
            entity,
            entities: this.entities,
            mobs: this.mobs,
            items: this.items,
            clearMobAggroLink: (mob) => this.clearMobAggroLink(mob as Mob),
            clearMobHateLinks: (mob) => this.clearMobHateLinks(mob as Mob),
            removeFromGroups: this.removeFromGroups.bind(this),
            resolveKindAsString: Types.getKindAsString.bind(Types),
            logDebug(message) {
                log.debug(message);
            },
        });
    }

    addPlayer(player) {
        addWorldPlayer({
            player,
            addEntity: this.addEntity.bind(this),
            players: this.players,
            outgoingQueues: this.outgoingQueues,
        });

        //log.info("Added player : " + player.id);
    }

    removePlayer(player) {
        removeWorldPlayer({
            player,
            removeEntity: this.removeEntity.bind(this),
            players: this.players,
            outgoingQueues: this.outgoingQueues,
        });
    }

    addMob(mob) {
        addWorldMob({
            mob,
            addEntity: this.addEntity.bind(this),
            mobs: this.mobs,
        });
    }

    addNpc(kind, x, y) {
        return addWorldNpc({
            kind,
            x,
            y,
            createNpc: (npcKind, npcX, npcY) => new Npc('8' + npcX + '' + npcY, npcKind, npcX, npcY),
            addEntity: this.addEntity.bind(this),
            npcs: this.npcs,
        });
    }

    addItem(item) {
        return addWorldItem({
            item,
            addEntity: this.addEntity.bind(this),
            items: this.items,
        });
    }

    createItem(kind, x, y) {
        return createWorldItem({
            kind,
            x,
            y,
            chestKind: Types.Entities.CHEST,
            nextItemId: () => '9' + this.itemCount++,
            createChest: (id, chestX, chestY) => new Chest(id, chestX, chestY),
            createItem: (id, itemKind, itemX, itemY) => new Item(id, itemKind, itemX, itemY),
        });
    }

    createChest(x, y, items) {
        return createWorldChest({
            x,
            y,
            items,
            chestKind: Types.Entities.CHEST,
            createItem: this.createItem.bind(this),
            isChest(item): item is Chest {
                return item instanceof Chest;
            },
        });
    }

    addStaticItem(item) {
        return addWorldStaticItem({
            item,
            buildRespawnHandler: (staticItem) => this.addStaticItem.bind(this, staticItem),
            addItem: this.addItem.bind(this),
        });
    }

    addItemFromChest(kind, x, y) {
        return addWorldItemFromChest({
            kind,
            x,
            y,
            createItem: this.createItem.bind(this),
            addItem: this.addItem.bind(this),
        });
    }

    /**
     * The mob will no longer be registered as an attacker of its current target.
     */
    clearMobAggroLink(mob: Mob) {
        clearWorldMobAggroLink({
            mob,
            getEntityById: this.getEntityById.bind(this),
            isPlayerEntity(entity): entity is Player {
                return entity instanceof Player;
            },
        });
    }

    clearMobHateLinks(mob: Mob) {
        clearWorldMobHateLinks({
            mob,
            getEntityById: this.getEntityById.bind(this),
            isPlayerEntity(entity): entity is Player {
                return entity instanceof Player;
            },
        });
    }

    forEachEntity(callback) {
        forEachEntityInWorldMap(this.entities, callback);
    }

    forEachPlayer(callback) {
        forEachEntityInWorldMap(this.players, callback);
    }

    forEachMob(callback) {
        forEachEntityInWorldMap(this.mobs, callback);
    }

    forEachCharacter(callback) {
        forEachWorldCharacter({
            callback,
            forEachPlayer: this.forEachPlayer.bind(this),
            forEachMob: this.forEachMob.bind(this),
        });
    }

    handleMobHate(mobId: EntityId, playerId: EntityId, hatePoints: number) {
        handleWorldMobHate({
            mobId,
            playerId,
            hatePoints,
            getEntityById: this.getEntityById.bind(this),
            isPlayerForHate(entity): entity is Player {
                return entity instanceof Player;
            },
            isMobForHate(entity): entity is Mob {
                return entity instanceof Mob;
            },
            chooseMobTarget: this.chooseMobTarget.bind(this),
        });
    }

    chooseMobTarget(mob: Mob, hateRank: number | null = null) {
        chooseWorldMobTarget({
            mob,
            hateRank,
            getEntityById: this.getEntityById.bind(this),
            isPlayerAggroTarget(entity): entity is Player {
                return entity instanceof Player;
            },
            clearMobAggroLink: this.clearMobAggroLink.bind(this),
            broadcastAttacker: this.broadcastAttacker.bind(this),
            logDebug(message) {
                log.debug(message);
            },
        });
    }

    getEntityById(id) {
        return getWorldEntityById({
            entities: this.entities,
            id,
            logError(message) {
                log.error(message);
            },
        });
    }

    getPlayerCount() {
        return countPlayersInWorld(this.players);
    }

    broadcastAttacker(character) {
        broadcastWorldAttacker(
            character,
            this.pushToAdjacentGroups.bind(this),
            (attacker) => {
                if (attacker) {
                    this.emit('entityAttack', attacker);
                }
            }
        );
    }

    handleHurtEntity(entity, attacker, damage) {
        handleWorldHurtEntity({
            entity,
            attacker,
            damage,
            pushToPlayer: this.pushToPlayer.bind(this),
            pushToAdjacentGroups: this.pushToAdjacentGroups.bind(this),
            getDroppedItem: this.getDroppedItem.bind(this),
            handleItemDespawn: this.handleItemDespawn.bind(this),
            handlePlayerVanish: this.handlePlayerVanish.bind(this),
            removeEntity: this.removeEntity.bind(this),
            createDamageMessage(mob, hurtDamage) {
                return new Messages.Damage(mob, hurtDamage);
            },
            createKillMessage(mob) {
                return new Messages.Kill(mob);
            },
        });
    }

    despawn(entity) {
        despawnWorldEntity({
            entity,
            pushToAdjacentGroups: this.pushToAdjacentGroups.bind(this),
            hasEntity: (entityId) => entityId in this.entities,
            removeEntity: this.removeEntity.bind(this),
        });
    }

    spawnStaticEntities() {
        spawnStaticEntitiesForWorld({
            staticEntities: this.map.staticEntities,
            resolveKindFromString: Types.getKindFromString.bind(Types),
            tileIndexToGridPosition: this.map.tileIndexToGridPosition.bind(this.map),
            isNpcKind: Types.isNpc.bind(Types),
            isMobKind: Types.isMob.bind(Types),
            isItemKind: Types.isItem.bind(Types),
            addNpc: this.addNpc.bind(this),
            createMob: (id, kind, x, y) => new Mob(id, kind, x, y),
            addMob: this.addMob.bind(this),
            isChestArea(area): area is ChestArea {
                return area instanceof ChestArea;
            },
            addMobToContainingChestArea: this.tryAddingMobToChestArea.bind(this),
            onMobMove: this.onMobMoveCallback.bind(this),
            createItem: this.createItem.bind(this),
            addStaticItem: this.addStaticItem.bind(this),
        });
    }

    isValidPosition(x, y) {
        return isWorldPositionValid(this.map, x, y);
    }

    handlePlayerVanish(player) {
        handleWorldPlayerVanish({
            player,
            chooseMobTarget: this.chooseMobTarget.bind(this),
            handleEntityGroupMembership: this.handleEntityGroupMembership.bind(this),
        });
    }

    setPlayerCount(count) {
        setWorldPlayerCount(this, count);
    }

    incrementPlayerCount() {
        incrementWorldPlayerCount(this);
    }

    decrementPlayerCount() {
        decrementWorldPlayerCount(this);
    }

    getDroppedItem(mob) {
        return selectDroppedItemForMob({
            mob,
            propertiesByKind: Properties as Record<string, { drops?: Record<string, number> }>,
            resolveKindAsString: Types.getKindAsString.bind(Types),
            resolveKindFromString: Types.getKindFromString.bind(Types),
            randomInt: Utils.random.bind(Utils),
            createAndAddDrop: (kind, x, y) => this.addItem(this.createItem(kind, x, y)),
        });
    }

    onMobMoveCallback(mob) {
        handleWorldMobMoveCallback({
            mob,
            pushToAdjacentGroups: this.pushToAdjacentGroups.bind(this),
            createMoveMessage(entity) {
                return new Messages.Move(entity);
            },
            handleEntityGroupMembership: this.handleEntityGroupMembership.bind(this),
        });
    }

    findPositionNextTo(entity, target) {
        return findWorldPositionNextTo(entity, target, this.isValidPosition.bind(this));
    }

    initZoneGroups() {
        initializeWorldZoneGroups(this.map, this.groups);
        this.zoneGroupsReady = true;
    }

    removeFromGroups(entity) {
        return removeEntityFromWorldGroups({
            entity,
            groups: this.groups,
            forEachAdjacentGroup: this.map.forEachAdjacentGroup.bind(this.map),
            isPlayerEntity: (groupedEntity) => groupedEntity instanceof Player,
        });
    }

    /**
     * Registers an entity as "incoming" into several groups, meaning that it just entered them.
     * All players inside these groups will receive a Spawn message when WorldServer.processGroups is called.
     */
    addAsIncomingToGroup(entity, groupId) {
        var isChest = entity && entity instanceof Chest,
            isItem = entity && entity instanceof Item,
            isDroppedItem = entity && isItem && !entity.isStatic && !entity.isFromChest;

        addEntityAsIncomingToGroups({
            entity,
            groupId,
            groups: this.groups,
            forEachAdjacentGroup: this.map.forEachAdjacentGroup.bind(this.map),
            isChestEntity: Boolean(isChest),
            isItemEntity: Boolean(isItem),
            isDroppedItemEntity: Boolean(isDroppedItem),
        });
    }

    addToGroup(entity, groupId) {
        return addEntityToWorldGroup({
            entity,
            groupId,
            groups: this.groups,
            forEachAdjacentGroup: this.map.forEachAdjacentGroup.bind(this.map),
            isPlayerEntity: (groupedEntity) => groupedEntity instanceof Player,
        });
    }

    logGroupPlayers(groupId) {
        logWorldGroupPlayers({
            groupId,
            groups: this.groups,
            logDebug(message) {
                log.debug(message);
            },
        });
    }

    handleEntityGroupMembership(entity) {
        return handleWorldEntityGroupMembership({
            entity,
            resolveGroupIdFromPosition: this.map.getGroupIdFromPosition.bind(this.map),
            addAsIncomingToGroup: this.addAsIncomingToGroup.bind(this),
            removeFromGroups: this.removeFromGroups.bind(this),
            addToGroup: this.addToGroup.bind(this),
            logDebug(message) {
                log.debug(message);
            },
        });
    }

    processGroups() {
        var self = this;
        processWorldGroups({
            zoneGroupsReady: self.zoneGroupsReady,
            forEachGroup(callback) {
                self.map.forEachGroup(callback);
            },
            getIncoming(groupId) {
                return self.groups[groupId].incoming;
            },
            pushSpawnToGroup(groupId, entity, ignoredPlayerId) {
                self.pushToGroup(
                    groupId,
                    new Messages.Spawn(entity as unknown as ConstructorParameters<typeof Messages.Spawn>[0]),
                    ignoredPlayerId ?? null
                );
            },
            isSpawnableEntity(entity) {
                return isSpawnableEntity(entity);
            },
        });
    }

    moveEntity(entity, x, y) {
        moveWorldEntity({
            entity,
            x,
            y,
            handleEntityGroupMembership: this.handleEntityGroupMembership.bind(this),
        });
    }

    handleItemDespawn(item) {
        scheduleWorldItemDespawn(this, item);
    }

    handleEmptyMobArea(area) {}

    handleEmptyChestArea(area) {
        handleEmptyChestAreaRefill(this, area);
    }

    handleOpenedChest(chest, player) {
        handleOpenedChestOrchestration(this, chest);
    }

    tryAddingMobToChestArea(mob) {
        addMobToContainingChestAreas(this.chestAreas, mob);
    }

    updatePopulation(totalPlayers = null) {
        notifyWorldPopulation(this, totalPlayers);
    }
}

export default World;
