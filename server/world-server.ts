import type { RuntimeEventName } from './server-event-names';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { WorldMessage } from './world/contracts';
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
import Utils from './utils';
import {
    buildListAction,
    buildMoveAction,
} from './protocol/outbound-actions';
import { installWorldPlayerLifecycle } from './world/player-lifecycle';
import { startWorldUpdateLoop } from './world/update-loop';
import { bootstrapWorldMapRuntime } from './world/map-bootstrap';
import { isMapChestAreaConfig, isMapChestConfig, isMapMobAreaConfig } from './world/map-config';
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
} from './world/entity-mutations';
import {
    addMobToContainingChestAreas,
    createWorldChest,
    createWorldItem,
    handleEmptyChestAreaRefill,
    spawnStaticEntitiesForWorld,
} from './world/chest-item-lifecycle';
import {
    despawnWorldEntity,
    getWorldEntityById,
    isWorldPositionValid,
    moveWorldEntity,
    selectDroppedItemForMob,
} from './world/entity';
import { requireMobPrefab } from '../shared/content/prefabs';
import { SERVER_PLUGIN_API_VERSION, type ServerPlugin } from './plugins/contracts';
import {
    forEachEntityInWorldMap,
    forEachWorldCharacter,
    initializeWorldZoneGroups,
    processWorldOutgoingQueues,
    pushRelevantEntityListToPlayer,
    pushWorldSpawnsToPlayer,
} from './world/group-flow';
import {
    addEntityAsIncomingToGroups,
    addEntityToWorldGroup,
    handleWorldEntityGroupMembership,
    logWorldGroupPlayers,
    removeEntityFromWorldGroups,
} from './world/group-membership';
import {
    clearWorldMobAggroLink,
    clearWorldMobHateLinks,
    handleWorldMobMoveCallback,
} from './world/mob-orchestration';
import {
    countPlayersInWorld,
    decrementWorldPlayerCount,
    incrementWorldPlayerCount,
    notifyWorldPopulation,
    setWorldPlayerCount,
} from './world/population-state';
import {
    pushSerializedToWorldAdjacentGroupsQueue,
    pushSerializedToWorldGroupQueue,
    pushSerializedToWorldPlayerQueue,
    pushWorldBroadcastMessage,
    pushWorldMessageToAdjacentGroups,
    pushWorldMessageToGroup,
    pushWorldMessageToPlayer,
    pushWorldMessageToPreviousGroups,
} from './world/push';
import Types from '../shared/gametypes-browser';
import { Evented } from '../shared/evented';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWire } from '../shared/domain/ids';
import type { Command } from './ecs/commands';
import { WorldEcsCommandPipeline } from './world/ecs-command-pipeline';
const log = Log.getLogger();
const logWorldQueueError = (errorMessage: string): void => {
    log.error(errorMessage);
};

// ======= GAME SERVER ========

type WorldEntity = Entity;
type WorldPlayer = Player;
type WorldMob = Mob;
type WorldNpc = Npc;
type WorldItem = Item;
type WorldChest = Chest;
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
    id: EntityId;
    x: number;
    y: number;
    kind: EntityKind;
};
const isSpawnableEntity = (entity: unknown): entity is SpawnableEntity =>
    typeof entity === 'object' &&
    entity !== null &&
    typeof (entity as { id?: unknown }).id === 'number' &&
    typeof (entity as { x?: unknown }).x === 'number' &&
    typeof (entity as { y?: unknown }).y === 'number' &&
    (typeof (entity as { kind?: unknown }).kind === 'number' || typeof (entity as { kind?: unknown }).kind === 'string');

type WorldConnection = {
    send(payload: unknown): void;
};

type WorldServerLike = {
    getConnection(id: string): WorldConnection | undefined;
};

type WorldGroup = {
    entities: Record<string, WorldEntity>;
    players: EntityId[];
    incoming: WorldEntity[];
};

type WorldEvents = {
    ready: [];
    init: [];
    playerConnect: [player: WorldPlayer];
    playerEnter: [player: WorldPlayer];
    playerAdded: [];
    playerRemoved: [];
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
    ecsPipeline: WorldEcsCommandPipeline;
    pendingPlayers: Record<string, WorldPlayer>;
    plugins: ServerPlugin[];
    pluginsInstalled: boolean;

    constructor(id: string, maxPlayers: number, websocketServer: WorldServerLike, plugins?: readonly ServerPlugin[]) {
        super();

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
        this.pendingPlayers = {};
        installWorldPlayerLifecycle(this);
        this.ecsPipeline = new WorldEcsCommandPipeline(this);
        this.plugins = Array.isArray(plugins) ? [...plugins] : [];
        this.pluginsInstalled = false;

        this.on('playerConnect', (player) => {
            const key = String(player.id);
            this.pendingPlayers[key] = player;
            player.on('exit', () => {
                delete this.pendingPlayers[key];
            });
        });
        this.on('playerEnter', (player) => {
            delete this.pendingPlayers[String(player.id)];
        });
    }

    enqueueCommand(command: Command): void {
        this.ecsPipeline.enqueue(command);
    }

    getConnectionPlayerById(playerId: EntityId): Player | null {
        const key = String(playerId);
        const active = this.players[key];
        if (active) {
            return active;
        }
        return this.pendingPlayers[key] ?? null;
    }

    installPlugins(): void {
        if (this.pluginsInstalled) {
            return;
        }
        this.pluginsInstalled = true;

        const ctx = Object.freeze({
            apiVersion: SERVER_PLUGIN_API_VERSION,
            world: this as unknown,
            ecs: Object.freeze({
                registerSystem: this.ecsPipeline.registerSystem.bind(this.ecsPipeline),
            }),
        });

        for (let i = 0; i < this.plugins.length; i += 1) {
            const plugin = this.plugins[i];
            if (!plugin) {
                continue;
            }
            try {
                plugin.install(ctx);
            } catch (err) {
                log.error(`Plugin "${plugin.id}" failed to install: ${String(err)}`);
                throw err;
            }
        }
    }

    run(mapFilePath: string) {
        const self = this;

        this.map = new Map(mapFilePath);
        this.installPlugins();

        this.map.ready(function () {
            bootstrapWorldMapRuntime({
                world: self,
                mobAreaConfigs: (self.map.mobAreas || []).filter(isMapMobAreaConfig),
                chestAreaConfigs: (self.map.chestAreas || []).filter(isMapChestAreaConfig),
                staticChestConfigs: (self.map.staticChests || []).filter(isMapChestConfig),
                createMobArea(config) {
                    return new MobArea(
                        config.id,
                        config.nb,
                        config.type,
                        config.x,
                        config.y,
                        config.width,
                        config.height,
                        self
                    );
                },
                createChestArea(config) {
                    return new ChestArea(
                        config.id,
                        config.x,
                        config.y,
                        config.w,
                        config.h,
                        config.tx,
                        config.ty,
                        config.i,
                        self
                    );
                },
            });
        });

        startWorldUpdateLoop(this, this.ups);

        log.info('' + this.id + ' created (capacity: ' + this.maxPlayers + ' players).');
        this.emit('ready');
    }

    setUpdatesPerSecond(ups: number) {
        this.ups = ups;
    }

    pushRelevantEntityListTo(player: WorldPlayer) {
        pushRelevantEntityListToPlayer({
            player,
            groups: this.groups,
            pushToPlayer: this.pushToPlayer.bind(this),
            createListMessage(entityIds) {
                return buildListAction(entityIds);
            },
        });
    }

    pushSpawnsToPlayer(player: WorldPlayer, ids: EntityId[]) {
        const pipeline = this.ecsPipeline;
        pushWorldSpawnsToPlayer({
            player,
            ids,
            getEntityById: this.getEntityById.bind(this),
            isSpawnableEntity,
            pushToPlayer: this.pushToPlayer.bind(this),
            createSpawnMessage(entity) {
                return pipeline.buildSpawnActionForLegacyEntity(entity);
            },
            logDebug(message) {
                log.debug(message);
            },
        });
    }

    pushToPlayer(player: WorldPlayer, message: WorldMessage) {
        pushWorldMessageToPlayer({
            player,
            message,
            pushSerializedToPlayer: this.pushSerializedToPlayer.bind(this),
        });
    }

    pushSerializedToPlayer(player: WorldPlayer, serializedMessage: string) {
        pushSerializedToWorldPlayerQueue(this.outgoingQueues, player, serializedMessage, logWorldQueueError);
    }

    pushToGroup(groupId: string, message: WorldMessage, ignoredPlayer: WorldPlayer | null = null) {
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
            pushSerializedToAdjacentGroups: (queueGroupId, serializedMessage, queueIgnoredPlayer) => {
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
        this.ecsPipeline.tick();
        processWorldOutgoingQueues(this.outgoingQueues, this.server.getConnection.bind(this.server));
    }

    addEntity(entity) {
        if (isSpawnableEntity(entity)) {
            try {
                this.ecsPipeline.syncSpawnReplicationEntity(entity);
            } catch (err) {
                log.error('ecsPipeline.syncSpawnReplicationEntity failed: ' + String(err));
            }
        }
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

        if (entity instanceof Item && entity.isStatic) {
            this.ecsPipeline.scheduleStaticRespawn(entity);
        }

        if (entity && typeof entity === 'object' && typeof (entity as { id?: unknown }).id === 'number') {
            const id = (entity as { id: EntityId }).id;
            this.ecsPipeline.removeEntity(id);
        }
    }

    addPlayer(player) {
        addWorldPlayer({
            player,
            addEntity: this.addEntity.bind(this),
            players: this.players,
            outgoingQueues: this.outgoingQueues,
        });

        try {
            this.ecsPipeline.syncSpawnReplicationEntity(player);
        } catch (err) {
            log.error('ecsPipeline.syncSpawnReplicationEntity failed: ' + String(err));
        }

        //log.info("Added player : " + player.id);
    }

    removePlayer(player) {
        this.ecsPipeline.removeEntity(player.id);
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
            createNpc: (npcKind, npcX, npcY) =>
                new Npc(entityIdFromWire(Number('8' + npcX + '' + npcY)), npcKind, npcX, npcY),
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
            nextItemId: () => entityIdFromWire(Number('9' + this.itemCount++)),
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
        const prefab = requireMobPrefab((mob as { kind: EntityKind }).kind);
        return selectDroppedItemForMob({
            mob,
            drops: prefab.drops,
            randomInt: Utils.random.bind(Utils),
            createAndAddDrop: (kind, x, y) => this.addItem(this.createItem(kind, x, y)),
        });
    }

    onMobMoveCallback(mob) {
        handleWorldMobMoveCallback({
            mob,
            pushToAdjacentGroups: this.pushToAdjacentGroups.bind(this),
            createMoveMessage(entity) {
                return buildMoveAction(entity.id as EntityId, entity.x as number, entity.y as number);
            },
            handleEntityGroupMembership: this.handleEntityGroupMembership.bind(this),
        });
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
        const isChest = entity && entity instanceof Chest,
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
        // ECS interest replication owns SPAWN/DESPAWN now; legacy group "incoming" queues are drained
        // only to keep memory bounded while migration completes.
        if (!this.zoneGroupsReady) {
            return;
        }
        this.map.forEachGroup((groupId) => {
            const group = this.groups[groupId];
            if (group && Array.isArray(group.incoming)) {
                group.incoming.length = 0;
            }
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
        if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'number') {
            this.ecsPipeline.scheduleItemDespawn(item as { id: EntityId });
        }
    }

    handleEmptyMobArea(area) {}

    handleEmptyChestArea(area) {
        handleEmptyChestAreaRefill(this, area);
    }

    tryAddingMobToChestArea(mob) {
        addMobToContainingChestAreas(this.chestAreas, mob);
    }

    updatePopulation(totalPlayers = null) {
        notifyWorldPopulation(this, totalPlayers);
    }
}

export default World;
