import type { EntityKind } from '../shared/entity-kind-domain';
import type { WorldMessage } from './world/contracts';
import type Entity from './entity';
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
import {
    isMapChestAreaConfig,
    isMapChestConfig,
    isMapMobAreaConfig,
    type MapChestAreaConfig,
    type MapMobAreaConfig,
} from './world/map-config';
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
import type { SchedulerStage } from './ecs/scheduler';
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

type EmptyChestArea = {
    chestX: number;
    chestY: number;
    items: unknown[];
};

type EntityCallback<T> = (entity: T) => void;
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
        this.plugins = plugins ? [...plugins] : [];
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
                registerSystem: (
                    stage: SchedulerStage,
                    name: string,
                    run: (state: unknown, ctx: unknown) => void
                ): void => {
                    this.ecsPipeline.registerSystem(stage, name, run);
                },
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

    run(mapFilePath: string): void {
        const self = this;

        this.map = new Map(mapFilePath);
        this.installPlugins();

        this.map.ready(function () {
            bootstrapWorldMapRuntime({
                world: self,
                mobAreaConfigs: (self.map.mobAreas ?? []).filter(isMapMobAreaConfig),
                chestAreaConfigs: (self.map.chestAreas ?? []).filter(isMapChestAreaConfig),
                staticChestConfigs: (self.map.staticChests ?? []).filter(isMapChestConfig),
                createMobArea(config: MapMobAreaConfig) {
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
                createChestArea(config: MapChestAreaConfig) {
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
            pushToPlayer: (targetPlayer, message) => this.pushToPlayer(targetPlayer, message as WorldMessage),
            createListMessage(entityIds: number[]) {
                return buildListAction(entityIds);
            },
        });
    }

    pushSpawnsToPlayer(player: WorldPlayer, ids: EntityId[]) {
        const pipeline = this.ecsPipeline;
        pushWorldSpawnsToPlayer({
            player,
            ids,
            getEntityById: (id: EntityId) => this.getEntityById(id),
            isSpawnableEntity,
            pushToPlayer: (targetPlayer, message) => this.pushToPlayer(targetPlayer, message as WorldMessage),
            createSpawnMessage(entity: SpawnableEntity) {
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
            pushSerializedToPlayer: (targetPlayer, serializedMessage) =>
                this.pushSerializedToPlayer(targetPlayer, serializedMessage),
        });
    }

    pushSerializedToPlayer(player: WorldPlayer, serializedMessage: unknown): void {
        pushSerializedToWorldPlayerQueue(this.outgoingQueues, player, serializedMessage, logWorldQueueError);
    }

    pushToGroup(groupId: string, message: WorldMessage, ignoredPlayer: WorldPlayer | null = null) {
        pushWorldMessageToGroup({
            groupId,
            message,
            ignoredPlayer,
            pushSerializedToGroup: (targetGroupId, serializedMessage, targetIgnoredPlayer) =>
                this.pushSerializedToGroup(targetGroupId, serializedMessage, targetIgnoredPlayer),
        });
    }

    pushSerializedToGroup(groupId: string, serializedMessage: unknown, ignoredPlayer: EntityId | null = null): void {
        pushSerializedToWorldGroupQueue({
            groups: this.groups,
            outgoingQueues: this.outgoingQueues,
            groupId,
            serializedMessage,
            ignoredPlayer,
            getEntityById: (id: EntityId) => this.getEntityById(id),
            logError: logWorldQueueError,
        });
    }

    pushToAdjacentGroups(groupId: string, message: WorldMessage, ignoredPlayer: EntityId | null = null): void {
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
                    getEntityById: (id: EntityId) => this.getEntityById(id),
                    logError: logWorldQueueError,
                });
            },
        });
    }

    pushToPreviousGroups(player: WorldPlayer | null | undefined, message: WorldMessage): void {
        pushWorldMessageToPreviousGroups(player, message, (groupId, groupMessage) =>
            this.pushToGroup(groupId, groupMessage)
        );
    }

    pushBroadcast(message: WorldMessage, ignoredPlayer: EntityId | null = null): void {
        pushWorldBroadcastMessage({
            message,
            ignoredPlayer,
            outgoingQueues: this.outgoingQueues,
        });
    }

    processQueues() {
        this.ecsPipeline.tick();
        processWorldOutgoingQueues(this.outgoingQueues, (id: string) => this.server.getConnection(id));
    }

    addEntity(entity: WorldEntity): void {
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
            handleEntityGroupMembership: (nextEntity) => this.handleEntityGroupMembership(nextEntity),
        });
    }

    removeEntity(entity: WorldEntity): void {
        removeWorldEntity({
            entity,
            entities: this.entities,
            mobs: this.mobs,
            items: this.items,
            clearMobAggroLink: (mob: WorldEntity) => this.clearMobAggroLink(mob as Mob),
            clearMobHateLinks: (mob: WorldEntity) => this.clearMobHateLinks(mob as Mob),
            removeFromGroups: (nextEntity) => this.removeFromGroups(nextEntity),
            resolveKindAsString: (kind: EntityKind) => Types.getKindAsString(kind) as string,
            logDebug(message) {
                log.debug(message);
            },
        });

        if (entity instanceof Item && entity.isStatic) {
            this.ecsPipeline.scheduleStaticRespawn(entity);
        }

        this.ecsPipeline.removeEntity(entity.id);
    }

    addPlayer(player: WorldPlayer): void {
        addWorldPlayer({
            player,
            addEntity: (entity) => this.addEntity(entity),
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

    removePlayer(player: WorldPlayer): void {
        this.ecsPipeline.removeEntity(player.id);
        removeWorldPlayer({
            player,
            removeEntity: (entity) => this.removeEntity(entity),
            players: this.players,
            outgoingQueues: this.outgoingQueues,
        });
    }

    addMob(mob: WorldMob): void {
        addWorldMob({
            mob,
            addEntity: (entity) => this.addEntity(entity),
            mobs: this.mobs,
        });
    }

    addNpc(kind: EntityKind, x: number, y: number): WorldNpc {
        return addWorldNpc({
            kind,
            x,
            y,
            createNpc: (npcKind, npcX, npcY) =>
                new Npc(entityIdFromWire(Number('8' + npcX + '' + npcY)), npcKind, npcX, npcY),
            addEntity: (entity) => this.addEntity(entity),
            npcs: this.npcs,
        });
    }

    addItem(item: WorldItem | WorldChest): WorldItem | WorldChest {
        return addWorldItem({
            item,
            addEntity: (entity) => this.addEntity(entity),
            items: this.items,
        });
    }

    createItem(kind: EntityKind, x: number, y: number): WorldItem | WorldChest {
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

    createChest(x: number, y: number, items: unknown[]): WorldItem | WorldChest {
        return createWorldChest({
            x,
            y,
            items,
            chestKind: Types.Entities.CHEST,
            createItem: (kind, itemX, itemY) => this.createItem(kind, itemX, itemY),
            isChest(item): item is Chest {
                return item instanceof Chest;
            },
        });
    }

    addStaticItem(item: WorldItem | WorldChest): WorldItem | WorldChest {
        return addWorldStaticItem({
            item,
            buildRespawnHandler: (staticItem) => () => {
                this.addStaticItem(staticItem);
            },
            addItem: (nextItem) => this.addItem(nextItem),
        });
    }

    addItemFromChest(kind: EntityKind, x: number, y: number): WorldItem | WorldChest {
        return addWorldItemFromChest({
            kind,
            x,
            y,
            createItem: (nextKind, nextX, nextY) => this.createItem(nextKind, nextX, nextY),
            addItem: (nextItem) => this.addItem(nextItem),
        });
    }

    /**
     * The mob will no longer be registered as an attacker of its current target.
     */
    clearMobAggroLink(mob: Mob): void {
        clearWorldMobAggroLink({
            mob,
            getEntityById: (id: EntityId) => this.getEntityById(id),
            isPlayerEntity(entity): entity is Player {
                return entity instanceof Player;
            },
        });
    }

    clearMobHateLinks(mob: Mob): void {
        clearWorldMobHateLinks({
            mob,
            getEntityById: (id: EntityId) => this.getEntityById(id),
            isPlayerEntity(entity): entity is Player {
                return entity instanceof Player;
            },
        });
    }

    forEachEntity(callback: EntityCallback<WorldEntity>): void {
        forEachEntityInWorldMap(this.entities, callback);
    }

    forEachPlayer(callback: EntityCallback<WorldPlayer>): void {
        forEachEntityInWorldMap(this.players, callback);
    }

    forEachMob(callback: EntityCallback<WorldMob>): void {
        forEachEntityInWorldMap(this.mobs, callback);
    }

    forEachCharacter(callback: EntityCallback<WorldPlayer | WorldMob>): void {
        forEachWorldCharacter({
            callback,
            forEachPlayer: (cb) => this.forEachPlayer(cb as EntityCallback<WorldPlayer>),
            forEachMob: (cb) => this.forEachMob(cb as EntityCallback<WorldMob>),
        });
    }

    getEntityById(id: EntityId): WorldEntity | null {
        return getWorldEntityById({
            entities: this.entities,
            id,
            logError(message) {
                log.error(message);
            },
        });
    }

    getPlayerCount(): number {
        return countPlayersInWorld(this.players);
    }

    despawn(entity: WorldEntity): void {
        despawnWorldEntity({
            entity,
            pushToAdjacentGroups: (groupId: string, message: WorldMessage) => this.pushToAdjacentGroups(groupId, message),
            hasEntity: (entityId) => entityId in this.entities,
            removeEntity: (nextEntity) => this.removeEntity(nextEntity),
        });
    }

    spawnStaticEntities(): void {
        spawnStaticEntitiesForWorld({
            staticEntities: this.map.staticEntities,
            resolveKindFromString: (kindName: string) => Types.getKindFromString(kindName) as EntityKind,
            tileIndexToGridPosition: (tileIndex: number) => this.map.tileIndexToGridPosition(tileIndex),
            isNpcKind: (kind: EntityKind) => Types.isNpc(kind),
            isMobKind: (kind: EntityKind) => Types.isMob(kind),
            isItemKind: (kind: EntityKind) => Types.isItem(kind),
            addNpc: (kind: EntityKind, x: number, y: number) => {
                this.addNpc(kind, x, y);
            },
            createMob: (id, kind, x, y) => new Mob(id, kind, x, y),
            addMob: (mob) => this.addMob(mob as WorldMob),
            isChestArea(area): area is ChestArea {
                return area instanceof ChestArea;
            },
            addMobToContainingChestArea: (mob) => this.tryAddingMobToChestArea(mob as WorldMob),
            onMobMove: (mob) => this.onMobMoveCallback(mob as WorldMob),
            createItem: (kind: EntityKind, x: number, y: number) => this.createItem(kind, x, y),
            addStaticItem: (item) => {
                this.addStaticItem(item as WorldItem | WorldChest);
            },
        });
    }

    isValidPosition(x: number, y: number): boolean {
        return isWorldPositionValid(this.map, x, y);
    }

    setPlayerCount(count: number): void {
        setWorldPlayerCount(this, count);
    }

    incrementPlayerCount(): void {
        incrementWorldPlayerCount(this);
    }

    decrementPlayerCount(): void {
        decrementWorldPlayerCount(this);
    }

    getDroppedItem(mob: WorldMob): unknown {
        const prefab = requireMobPrefab((mob as { kind: EntityKind }).kind);
        return selectDroppedItemForMob({
            mob,
            drops: prefab.drops,
            randomInt: (max: number) => Utils.random(max),
            createAndAddDrop: (kind, x, y) => this.addItem(this.createItem(kind, x, y)),
        });
    }

    onMobMoveCallback(mob: WorldMob): void {
        handleWorldMobMoveCallback({
            mob,
            pushToAdjacentGroups: (groupId: string, message: WorldMessage, ignoredPlayer?: EntityId | null) =>
                this.pushToAdjacentGroups(groupId, message, ignoredPlayer ?? null),
            createMoveMessage(entity: { id: EntityId; x: number; y: number }) {
                return buildMoveAction(entity.id, entity.x, entity.y);
            },
            handleEntityGroupMembership: (nextEntity) => this.handleEntityGroupMembership(nextEntity as WorldEntity),
        });
    }

    initZoneGroups(): void {
        initializeWorldZoneGroups(this.map, this.groups);
        this.zoneGroupsReady = true;
    }

    removeFromGroups(entity: WorldEntity): unknown {
        return removeEntityFromWorldGroups({
            entity,
            groups: this.groups,
            forEachAdjacentGroup: (groupId, cb) => this.map.forEachAdjacentGroup(groupId, cb),
            isPlayerEntity: (groupedEntity) => groupedEntity instanceof Player,
        });
    }

    /**
     * Registers an entity as "incoming" into several groups, meaning that it just entered them.
     * All players inside these groups will receive a Spawn message when WorldServer.processGroups is called.
     */
    addAsIncomingToGroup(entity: WorldEntity, groupId: string): void {
        const isChest = entity instanceof Chest;
        const isItem = entity instanceof Item;
        const isDroppedItem = isItem && !entity.isStatic && !entity.isFromChest;

        addEntityAsIncomingToGroups({
            entity,
            groupId,
            groups: this.groups,
            forEachAdjacentGroup: (candidateGroupId, cb) => this.map.forEachAdjacentGroup(candidateGroupId, cb),
            isChestEntity: Boolean(isChest),
            isItemEntity: Boolean(isItem),
            isDroppedItemEntity: Boolean(isDroppedItem),
        });
    }

    addToGroup(entity: WorldEntity, groupId: string): unknown {
        return addEntityToWorldGroup({
            entity,
            groupId,
            groups: this.groups,
            forEachAdjacentGroup: (candidateGroupId, cb) => this.map.forEachAdjacentGroup(candidateGroupId, cb),
            isPlayerEntity: (groupedEntity) => groupedEntity instanceof Player,
        });
    }

    logGroupPlayers(groupId: string): void {
        logWorldGroupPlayers({
            groupId,
            groups: this.groups,
            logDebug(message) {
                log.debug(message);
            },
        });
    }

    handleEntityGroupMembership(entity: WorldEntity): unknown {
        return handleWorldEntityGroupMembership({
            entity,
            resolveGroupIdFromPosition: (x: number, y: number) => this.map.getGroupIdFromPosition(x, y),
            addAsIncomingToGroup: (nextEntity, groupId) => this.addAsIncomingToGroup(nextEntity as WorldEntity, groupId),
            removeFromGroups: (nextEntity) => this.removeFromGroups(nextEntity as WorldEntity),
            addToGroup: (nextEntity, groupId) => this.addToGroup(nextEntity as WorldEntity, groupId),
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

    moveEntity(entity: WorldEntity, x: number, y: number): void {
        moveWorldEntity({
            entity,
            x,
            y,
            handleEntityGroupMembership: (nextEntity) => this.handleEntityGroupMembership(nextEntity as WorldEntity),
        });
    }

    handleItemDespawn(item: WorldItem | WorldChest): void {
        this.ecsPipeline.scheduleItemDespawn(item);
    }

    handleEmptyMobArea(_area) {}

    handleEmptyChestArea(area: EmptyChestArea | null | undefined): void {
        handleEmptyChestAreaRefill(this, area);
    }

    tryAddingMobToChestArea(mob: WorldMob): void {
        addMobToContainingChestAreas(this.chestAreas, mob);
    }

    updatePopulation(totalPlayers: number | null = null): void {
        notifyWorldPopulation(this, totalPlayers);
    }
}

export default World;
