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
    getWorldEntityById,
    isWorldPositionValid,
    moveWorldEntity,
    selectDroppedItemForMob,
} from './world/entity';
import { requireMobPrefab } from '../shared/content/prefabs';
import { SERVER_PLUGIN_API_VERSION, type ServerPlugin } from './plugins/contracts';
import { forEachEntityInWorldMap, forEachWorldCharacter } from './world/iterators';
import { clearWorldMobAggroLink, clearWorldMobHateLinks } from './world/mob-orchestration';
import {
    countPlayersInWorld,
    decrementWorldPlayerCount,
    incrementWorldPlayerCount,
    notifyWorldPopulation,
    setWorldPlayerCount,
} from './world/population-state';
import { flushOutgoingQueues, pushSerializedToPlayerQueue } from './world/transport';
import Types from '../shared/gametypes-browser';
import { Evented } from '../shared/evented';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWire } from '../shared/domain/ids';
import type { Command } from './ecs/commands';
import type { SchedulerStage } from './ecs/scheduler';
import { WorldEcsCommandPipeline } from './world/ecs-command-pipeline';
import type {
    PersistedAchievementProgress,
    PersistedPlayerProfile,
    SqlitePlayerPersistence,
} from './player-persistence';
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

type PlayerPersistence = Pick<
    SqlitePlayerPersistence,
    | 'claimPlayerSession'
    | 'releasePlayerSession'
    | 'persistEquipment'
    | 'persistCheckpoint'
    | 'persistAchievementUnlock'
    | 'incrementAchievementCounters'
    | 'getAchievementProgressByName'
>;

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

    outgoingQueues: Record<string, unknown[]>;

    itemCount: number;
    playerCount: number;

    ecsPipeline: WorldEcsCommandPipeline;
    pendingPlayers: Record<string, WorldPlayer>;
    plugins: ServerPlugin[];
    pluginsInstalled: boolean;
    playerPersistence: PlayerPersistence | null;

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

        this.outgoingQueues = {};

        this.itemCount = 0;
        this.playerCount = 0;

        this.pendingPlayers = {};
        installWorldPlayerLifecycle(this);
        this.ecsPipeline = new WorldEcsCommandPipeline(this);
        this.plugins = plugins ? [...plugins] : [];
        this.pluginsInstalled = false;
        this.playerPersistence = null;

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

    setPlayerPersistence(playerPersistence: PlayerPersistence | null): void {
        this.playerPersistence = playerPersistence;
    }

    getConnectionPlayerById(playerId: EntityId): Player | null {
        const key = String(playerId);
        const active = this.players[key];
        if (active) {
            return active;
        }
        return this.pendingPlayers[key] ?? null;
    }

    resolveHelloProfile({
        connectionId,
        requestedName,
    }: {
        connectionId: string;
        requestedName: string;
    }): Readonly<{
        accepted: boolean;
        reason?: string;
        profile?: PersistedPlayerProfile;
    }> {
        if (!this.playerPersistence) {
            return { accepted: true };
        }
        const result = this.playerPersistence.claimPlayerSession({
            connectionId,
            requestedName,
        });
        if (!result.accepted) {
            return {
                accepted: false,
                reason: result.reason,
            };
        }
        return {
            accepted: true,
            profile: result.profile,
        };
    }

    releaseSessionClaim(connectionId: string): void {
        if (!this.playerPersistence) {
            return;
        }
        this.playerPersistence.releasePlayerSession(connectionId);
    }

    persistPlayerEquipment(player: Player): void {
        if (!this.playerPersistence) {
            return;
        }
        this.playerPersistence.persistEquipment({
            playerName: player.name,
            armorKind: player.armor,
            weaponKind: player.weapon,
        });
    }

    persistPlayerCheckpoint(playerName: string, checkpointId: number): void {
        if (!this.playerPersistence) {
            return;
        }
        this.playerPersistence.persistCheckpoint({
            playerName,
            checkpointId,
        });
    }

    persistPlayerAchievementUnlock(playerName: string, achievementId: number): void {
        if (!this.playerPersistence) {
            return;
        }
        this.playerPersistence.persistAchievementUnlock({
            playerName,
            achievementId,
        });
    }

    recordPlayerMobKill(playerName: string, mobKind: EntityKind): void {
        if (!this.playerPersistence) {
            return;
        }

        this.playerPersistence.incrementAchievementCounters({
            playerName,
            killsDelta: 1,
            ratDelta: mobKind === Types.Entities.RAT ? 1 : 0,
            skeletonDelta:
                mobKind === Types.Entities.SKELETON || mobKind === Types.Entities.SKELETON2 ? 1 : 0,
        });
    }

    recordPlayerDamageTaken(playerName: string, damage: number): void {
        if (!this.playerPersistence) {
            return;
        }
        const safeDamage = Math.max(0, Math.trunc(damage));
        if (safeDamage <= 0) {
            return;
        }
        this.playerPersistence.incrementAchievementCounters({
            playerName,
            damageDelta: safeDamage,
        });
    }

    recordPlayerRevive(playerName: string): void {
        if (!this.playerPersistence) {
            return;
        }
        this.playerPersistence.incrementAchievementCounters({
            playerName,
            revivesDelta: 1,
        });
    }

    getPlayerAchievementProgress(playerName: string): PersistedAchievementProgress | null {
        if (!this.playerPersistence) {
            return null;
        }
        return this.playerPersistence.getAchievementProgressByName(playerName);
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

            startWorldUpdateLoop(self, self.ups);

            log.info('' + self.id + ' created (capacity: ' + self.maxPlayers + ' players).');
            self.emit('ready');
        });
    }

    setUpdatesPerSecond(ups: number) {
        this.ups = ups;
    }

    pushSpawnsToPlayer(player: WorldPlayer, ids: EntityId[]) {
        const pipeline = this.ecsPipeline;
        for (let i = 0; i < ids.length; i += 1) {
            const id = ids[i];
            if (id === undefined) {
                continue;
            }
            const entity = this.getEntityById(id);
            if (!isSpawnableEntity(entity)) {
                continue;
            }
            try {
                this.pushToPlayer(player, pipeline.buildSpawnActionForLegacyEntity(entity));
            } catch (_) {
                // Entity may have been destroyed or missing replication components.
            }
        }
        log.debug('Pushed ' + ids.length + ' new spawns to ' + player.id);
    }

    isPlayerActive(playerId: EntityId): boolean {
        const key = String(playerId);
        return key in this.outgoingQueues;
    }

    pushSpawnsToPlayerId(playerId: EntityId, ids: EntityId[]): void {
        if (!this.isPlayerActive(playerId)) {
            return;
        }

        const pipeline = this.ecsPipeline;
        for (let i = 0; i < ids.length; i += 1) {
            const id = ids[i];
            if (id === undefined) {
                continue;
            }
            const entity = this.getEntityById(id);
            if (!isSpawnableEntity(entity)) {
                continue;
            }
            try {
                this.pushToPlayerId(playerId, pipeline.buildSpawnActionForLegacyEntity(entity));
            } catch (_) {
                // Entity may have been destroyed or missing replication components.
            }
        }
        log.debug('Pushed ' + ids.length + ' new spawns to ' + playerId);
    }

    pushToPlayer(player: WorldPlayer, message: WorldMessage) {
        const serializedMessage = Array.isArray(message) ? message : message.serialize();
        pushSerializedToPlayerQueue(this.outgoingQueues, player, serializedMessage, logWorldQueueError);
    }

    pushToPlayerId(playerId: EntityId, message: WorldMessage): void {
        const key = String(playerId);
        const queue = this.outgoingQueues[key];
        if (!queue) {
            return;
        }
        const serializedMessage = Array.isArray(message) ? message : message.serialize();
        queue.push(serializedMessage);
    }

    pushBroadcast(message: WorldMessage, ignoredPlayerId: EntityId | null = null): void {
        const serializedMessage = Array.isArray(message) ? message : message.serialize();
        const ignoredKey = ignoredPlayerId === null ? null : String(ignoredPlayerId);

        for (const id in this.outgoingQueues) {
            if (ignoredKey !== null && id === ignoredKey) {
                continue;
            }
            const queue = this.outgoingQueues[id];
            if (queue) {
                queue.push(serializedMessage);
            }
        }
    }

    processQueues() {
        this.ecsPipeline.tick();
        flushOutgoingQueues(this.outgoingQueues, (id: string) => this.server.getConnection(id));
    }

    addEntity(entity: WorldEntity): void {
        if (isSpawnableEntity(entity)) {
            try {
                this.ecsPipeline.syncSpawnReplicationEntity(entity);
            } catch (err) {
                log.error('ecsPipeline.syncSpawnReplicationEntity failed: ' + String(err));
            }
        }

        try {
            this.ecsPipeline.syncCombatEntity(entity as unknown as {
                id: EntityId;
                hitPoints?: number;
                maxHitPoints?: number;
                armorLevel?: number;
                weaponLevel?: number;
            });
        } catch (err) {
            log.error('ecsPipeline.syncCombatEntity failed: ' + String(err));
        }
        addWorldEntity({
            entity,
            entities: this.entities,
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
            resolveKindAsString: (kind: EntityKind) => Types.getKindAsString(kind) as string,
            logDebug(message) {
                log.debug(message);
            },
        });

        if (entity instanceof Mob) {
            const area = (entity as unknown as { area?: unknown }).area;
            if (area && typeof (area as { removeFromArea?: (mob: unknown) => void }).removeFromArea === 'function') {
                (area as { removeFromArea: (mob: unknown) => void }).removeFromArea(entity);
            }
            this.ecsPipeline.scheduleStaticRespawn(entity, 30);
        }

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
                // ECS-native flows may race legacy entity-map lookups during despawn/zone churn.
                // Treat missing legacy entities as a debug signal (call sites already guard null).
                log.debug(message);
            },
        });
    }

    getPlayerCount(): number {
        return countPlayersInWorld(this.players);
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

    moveEntity(entity: WorldEntity, x: number, y: number): void {
        moveWorldEntity({
            entity,
            x,
            y,
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
