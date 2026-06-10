import type { EntityKind, EntityKindName } from '../shared/entity-kind-domain';
import type { OutgoingQueues, WorldConnection as RuntimeWorldConnection, WorldMessage } from './world/contracts';
import Entity from './entity';
import Log from './log';
import MobEntity from './world/mob-entity';
import Npc from './npc';
import MobArea from './mobarea';
import ChestArea from './chestarea';
import Utils from './utils';
import { installWorldPlayerLifecycle } from './world/player-lifecycle';
import {
    DEFAULT_WORLD_UPDATES_PER_SECOND,
    resolveWorldUpdatesPerSecond,
    startWorldUpdateLoop,
} from './world/update-loop';
import { bootstrapWorldMapRuntime } from './world/map-bootstrap';
import {
    isMapChestAreaConfig,
    isMapChestConfig,
    isMapMobAreaConfig,
    type MapChestAreaConfig,
    type MapMobAreaConfig,
} from './world/map-config';
import {
    addWorldItemFromChest,
    addWorldPlayer,
    addWorldStaticItem,
    removeWorldPlayer,
} from './world/entity-mutations';
import {
    addMobToContainingChestAreas,
    handleEmptyChestAreaRefill,
    spawnStaticEntitiesForWorld,
} from './world/chest-item-lifecycle';
import {
    isWorldPositionValid,
    moveWorldEntity,
    selectDroppedItemForMob,
} from './world/entity';
import { requireMobPrefab } from '../shared/content/prefabs';
import { SERVER_PLUGIN_API_VERSION, type ServerPlugin, type ServerPluginEcsApi } from './plugins/contracts';
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
import { gridPos, type GridPos } from '../shared/domain/positions';
import type { Command } from './ecs/commands';
import type { SchedulerStage } from './ecs/scheduler';
import { WorldEcsCommandPipeline } from './world/ecs-command-pipeline';
import type { PlayerLike } from './world/player-like';
import type { ServerConfig } from './runtime-types';
import type { ChunkFlushScheduler } from './world/chunks/chunk-flush-scheduler';
import type { SqliteChunkOverlayPersistence } from './world/chunks/chunk-overlay-persistence';
import type { SqliteClaimsPersistence } from './world/claims/claims-persistence';
import { CLAIMS_STORE_RESOURCE } from './world/claims/claims-resource';
import {
    closeWorldPersistence,
    flushChunkPersistenceOnShutdown,
    openWorldPersistence,
} from './world/world-persistence-lifecycle';
import {
    pushSerializedBroadcastQueue,
    pushSerializedToPlayerIdQueue,
    serializeWorldMessage,
} from './world/outgoing-queue-service';
import type { RectClaim } from './world/claims/claims-store';
import type {
    PersistedAchievementProgress,
    PersistedPlayerProfile,
    SqlitePlayerPersistence,
} from './player-persistence';
import { resolveIdentityKey } from './identity';
import { isMapPack } from '../shared/maps/map-pack';
import {
    createWorldMapRegistryFromMapPack,
    type WorldMapRegistry,
} from './world/map-registry';
import { compileRuntimeMapPackFromPayload, loadRuntimeMapPackFromSource } from './runtime-map-pack-source';
import { WORLD_EVENT_NAMES } from './server-event-names';
import type {
    MapTransitionEvent,
    MapTransitionRejectReason,
} from './world/map-transition-observability';

type LooseValue = string | number | boolean | null | undefined | object;
const log = Log.getLogger();
const logWorldQueueError = (errorMessage: string): void => {
    log.error(errorMessage);
};

// ======= GAME SERVER ========

type WorldEntity = Entity;
type WorldPlayer = PlayerLike;
type WorldMob = MobEntity & { orientation?: number };
type WorldNpc = Npc;
type WorldItemEvents = {
    respawn: [];
};

type WorldItem = Entity<WorldItemEvents> & {
    isStatic: boolean;
    isFromChest: boolean;
};
type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type WorldMapLike = {
    ready(callback: () => void): void;
    generateCollisionGrid(): void;
    getCheckpoint(id: string | number): { id?: string | number } | null | undefined;
    isDoor(x: number, y: number): boolean;
    getDoorDestination(x: number, y: number): { x: number; y: number } | null;
    getRandomStartingPosition(): { x: number; y: number };
    tileIndexToGridPosition(tileIndex: number): { x: number; y: number };
    isOutOfBounds(x: number, y: number): boolean;
    isColliding(x: number, y: number): boolean;
    getGroupIdFromPosition(x: number, y: number): string;
    forEachGroup(callback: (id: string) => void): void;
    forEachAdjacentGroup(groupId: string, callback: (id: string) => void): void;
    staticEntities?: Record<string, EntityKindName>;
    mobAreas?: object[];
    chestAreas?: object[];
    staticChests?: object[];
};

type EmptyChestArea = {
    chestX: number;
    chestY: number;
    items: JsonLike[];
};

type MapTransitionCounters = {
    attempts: number;
    commits: number;
    rejects: number;
    rejectByReason: Partial<Record<MapTransitionRejectReason, number>>;
};

type SpawnableEntity = {
    id: EntityId;
    x: number;
    y: number;
    kind: EntityKind;
};
type CombatSyncEntity = {
    id: EntityId;
    hitPoints?: number;
    maxHitPoints?: number;
    armorLevel?: number;
    weaponLevel?: number;
};

type ChestLootSyncEntity = {
    id: EntityId;
    kind?: EntityKind;
    items?: JsonLike[];
};

type WorldEntitySyncInput = SpawnableEntity & Partial<CombatSyncEntity & ChestLootSyncEntity>;

type AreaLink = {
    removeFromArea(entity: { id: EntityId }): void;
};

type RemovableWorldEntity = {
    id: EntityId;
    type?: string;
    destroy?: () => void;
    area?: AreaLink | null;
};

type WorldServerLike = {
    getConnection(id: string): RuntimeWorldConnection | undefined;
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
    playerEnter: [player: PlayerLike];
    playerAdded: [];
    playerRemoved: [];
};

class World extends Evented<WorldEvents> {
    id: string;
    maxPlayers: number;
    server: WorldServerLike;
    ups: number;

    map!: WorldMapLike;
    mapRegistry: WorldMapRegistry | null;

    players: Record<string, WorldPlayer>;
    mobAreas: InstanceType<typeof MobArea>[];
    chestAreas: InstanceType<typeof ChestArea>[];

    outgoingQueues: OutgoingQueues;

    playerCount: number;

    ecsPipeline: WorldEcsCommandPipeline;
    pendingPlayers: Record<string, WorldPlayer>;
    plugins: ServerPlugin[];
    pluginsInstalled: boolean;
    playerPersistence: PlayerPersistence | null;
    serverConfig: ServerConfig | null;
    chunkOverlayPersistence: SqliteChunkOverlayPersistence | null;
    chunkFlushScheduler: ChunkFlushScheduler | null;
    chunkFlushTickErrorLatched: boolean;
    claimsPersistence: SqliteClaimsPersistence | null;
    updateLoopHandle: ReturnType<typeof startWorldUpdateLoop> | null;
    mapTransitionCounters: MapTransitionCounters;

    constructor(id: string, maxPlayers: number, websocketServer: WorldServerLike, plugins?: readonly ServerPlugin[]) {
        super();

        this.id = id;
        this.maxPlayers = maxPlayers;
        this.server = websocketServer;
        this.ups = DEFAULT_WORLD_UPDATES_PER_SECOND;

        this.players = {};
        this.mobAreas = [];
        this.chestAreas = [];

        this.outgoingQueues = {};

        this.playerCount = 0;

        this.pendingPlayers = {};
        installWorldPlayerLifecycle(this);
        this.ecsPipeline = new WorldEcsCommandPipeline(this);
        this.mapRegistry = null;
        this.plugins = plugins ? [...plugins] : [];
        this.pluginsInstalled = false;
        this.playerPersistence = null;
        this.serverConfig = null;
        this.chunkOverlayPersistence = null;
        this.chunkFlushScheduler = null;
        this.chunkFlushTickErrorLatched = false;
        this.claimsPersistence = null;
        this.updateLoopHandle = null;
        this.mapTransitionCounters = {
            attempts: 0,
            commits: 0,
            rejects: 0,
            rejectByReason: {},
        };

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

    enqueueCommand(command: Command): boolean {
        const accepted = this.ecsPipeline.enqueue(command);
        if (!accepted) {
            log.event('warn', 'world.inbound.backpressure_reject', {
                worldId: this.id,
                connectionId: command.source.connectionId,
                playerId: command.source.playerId,
                commandType: command.type,
            });
        }
        return accepted;
    }

    setPlayerPersistence(playerPersistence: PlayerPersistence | null): void {
        this.playerPersistence = playerPersistence;
    }

    setServerConfig(config: ServerConfig | null): void {
        this.serverConfig = config;
        this.setUpdatesPerSecond(resolveWorldUpdatesPerSecond(config?.updates_per_second));
        const desiredChunkSize =
            typeof config?.chunk_size === 'number' && Number.isInteger(config.chunk_size) && config.chunk_size > 0 && config.chunk_size <= 256
                ? config.chunk_size
                : 32;

        if (this.ecsPipeline.chunkOverlays.chunkSize !== desiredChunkSize) {
            const hasPlayers = this.playerCount > 0 || Object.keys(this.players).length > 0 || Object.keys(this.pendingPlayers).length > 0;
            if (!hasPlayers) {
                this.ecsPipeline = new WorldEcsCommandPipeline(this, { chunkSize: desiredChunkSize });
            } else {
                log.error(
                    `Refusing to change chunk_size for ${this.id} after players joined (current=${this.ecsPipeline.chunkOverlays.chunkSize}, desired=${desiredChunkSize})`
                );
            }
        }

        try {
            this.ecsPipeline.setServerConfig(config);
        } catch (_) {
            // ignore
        }
    }

    flushPersistenceOnShutdown(): void {
        flushChunkPersistenceOnShutdown(this.chunkFlushScheduler, (error) => {
            log.event('error', 'world.persistence.flush_failed', {
                worldId: this.id,
                phase: 'shutdown_flush',
                error: String(error),
            });
        });
    }

    closePersistence(): void {
        this.updateLoopHandle?.stop();
        this.updateLoopHandle = null;

        closeWorldPersistence(this.chunkOverlayPersistence, this.claimsPersistence, (target, error) => {
            log.event('error', 'world.persistence.close_failed', {
                worldId: this.id,
                target,
                error: String(error),
            });
        });
        this.chunkOverlayPersistence = null;
        this.chunkFlushScheduler = null;
        this.chunkFlushTickErrorLatched = false;
        this.claimsPersistence = null;
    }

    ensureChunkOverlayLoaded(mapId: string, chunkX: number, chunkY: number): boolean {
        if (!Number.isSafeInteger(chunkX) || !Number.isSafeInteger(chunkY)) {
            return false;
        }
        if (!this.chunkOverlayPersistence) {
            return false;
        }
        try {
            return this.chunkOverlayPersistence.loadChunkIntoStore(this.ecsPipeline.chunkOverlays, chunkX, chunkY, mapId).loaded;
        } catch (err) {
            log.error(`ensureChunkOverlayLoaded failed for ${mapId} (${chunkX}, ${chunkY}): ${String(err)}`);
            return false;
        }
    }

    ensureChunkOverlayLoadedForTile(x: number, y: number, mapId = this.getDefaultMapId()): boolean {
        if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
            return false;
        }
        const chunkSize = this.ecsPipeline.chunkOverlays.chunkSize;
        return this.ensureChunkOverlayLoaded(mapId, Math.floor(x / chunkSize), Math.floor(y / chunkSize));
    }

    scheduleMobRespawn({
        mobId: _mobId,
        kind,
        spawn,
        tickNow,
        delaySeconds,
    }: {
        mobId: EntityId;
        kind: EntityKind;
        spawn: GridPos;
        tickNow?: number;
        delaySeconds?: number;
    }): void {
        const resolvedDelay = typeof delaySeconds === 'number' ? delaySeconds : 30;
        this.ecsPipeline.scheduleStaticRespawn(
            {
                emit: () => {
                    // The original mob id may already be reused by another entity generation by the time
                    // respawn fires; allocate a fresh ECS id for the respawned mob to avoid stale-id crashes.
                    const respawnId = this.allocateEntityId_();
                    this.ecsPipeline.seedMobFromPrefabSpawn({
                        id: respawnId,
                        kind,
                        x: spawn.x,
                        y: spawn.y,
                        spawnX: spawn.x,
                        spawnY: spawn.y,
                    });
                },
            },
            resolvedDelay,
            tickNow
        );
    }

    scheduleStaticItemRespawn({
        itemId: _itemId,
        kind,
        spawn,
        tickNow,
        delaySeconds,
    }: {
        itemId: EntityId;
        kind: EntityKind;
        spawn: GridPos;
        tickNow?: number;
        delaySeconds?: number;
    }): void {
        const resolvedDelay = typeof delaySeconds === 'number' ? delaySeconds : 30;
        this.ecsPipeline.scheduleStaticRespawn(
            {
                emit: () => {
                    // Static loot respawn must also use a fresh id because the old one may now refer to a different
                    // generation/index occupant.
                    const respawnId = this.allocateEntityId_();
                    this.ecsPipeline.seedItemFromSpawn({ id: respawnId, kind, x: spawn.x, y: spawn.y });
                    this.ecsPipeline.state.world.addComponent(respawnId, this.ecsPipeline.items.StaticSpawnPos, spawn);
                },
            },
            resolvedDelay,
            tickNow
        );
    }

    getConnectionPlayerById(playerId: EntityId): PlayerLike | null {
        const key = String(playerId);
        const active = this.players[key];
        if (active) {
            return active;
        }
        return this.pendingPlayers[key] ?? null;
    }

    removeEntityFromAreas(entityId: EntityId): void {
        const stub = { id: entityId };

        for (const area of this.mobAreas) {
            area.removeFromArea(stub);
        }

        for (const area of this.chestAreas) {
            area.removeFromArea(stub);
        }
    }

    resolveHelloProfile({
        connectionId,
        requestedName,
        authenticatedAccountNameKey,
    }: {
        connectionId: string;
        requestedName: string;
        authenticatedAccountNameKey?: string;
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
            authenticatedAccountNameKey,
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

    persistPlayerEquipment(player: PlayerLike): void {
        if (!this.playerPersistence) {
            return;
        }
        const identityKey = resolveIdentityKey(player);
        if (!identityKey) {
            return;
        }
        this.playerPersistence.persistEquipment({
            playerName: identityKey,
            armorKind: player.armor,
            weaponKind: player.weapon,
        });
    }

    persistPlayerCheckpoint(playerIdentity: string, checkpointId: number): void {
        if (!this.playerPersistence) {
            return;
        }
        const identityKey = resolveIdentityKey(playerIdentity);
        if (!identityKey) {
            return;
        }
        this.playerPersistence.persistCheckpoint({
            playerName: identityKey,
            checkpointId,
        });
    }

    persistPlayerAchievementUnlock(playerIdentity: string, achievementId: number): void {
        if (!this.playerPersistence) {
            return;
        }
        const identityKey = resolveIdentityKey(playerIdentity);
        if (!identityKey) {
            return;
        }
        this.playerPersistence.persistAchievementUnlock({
            playerName: identityKey,
            achievementId,
        });
    }

    recordPlayerMobKill(playerIdentity: string, mobKind: EntityKind): void {
        if (!this.playerPersistence) {
            return;
        }
        const identityKey = resolveIdentityKey(playerIdentity);
        if (!identityKey) {
            return;
        }

        this.playerPersistence.incrementAchievementCounters({
            playerName: identityKey,
            killsDelta: 1,
            ratDelta: mobKind === Types.Entities.RAT ? 1 : 0,
            skeletonDelta:
                mobKind === Types.Entities.SKELETON || mobKind === Types.Entities.SKELETON2 ? 1 : 0,
        });
    }

    recordPlayerDamageTaken(playerIdentity: string, damage: number): void {
        if (!this.playerPersistence) {
            return;
        }
        const identityKey = resolveIdentityKey(playerIdentity);
        if (!identityKey) {
            return;
        }
        const safeDamage = Math.max(0, Math.trunc(damage));
        if (safeDamage <= 0) {
            return;
        }
        this.playerPersistence.incrementAchievementCounters({
            playerName: identityKey,
            damageDelta: safeDamage,
        });
    }

    recordPlayerRevive(playerIdentity: string): void {
        if (!this.playerPersistence) {
            return;
        }
        const identityKey = resolveIdentityKey(playerIdentity);
        if (!identityKey) {
            return;
        }
        this.playerPersistence.incrementAchievementCounters({
            playerName: identityKey,
            revivesDelta: 1,
        });
    }

    getPlayerAchievementProgress(playerIdentity: string): PersistedAchievementProgress | null {
        if (!this.playerPersistence) {
            return null;
        }
        const identityKey = resolveIdentityKey(playerIdentity);
        if (!identityKey) {
            return null;
        }
        return this.playerPersistence.getAchievementProgressByName(identityKey);
    }

    persistClaimUpsert(claim: RectClaim): void {
        if (!this.claimsPersistence) {
            return;
        }
        this.claimsPersistence.upsertClaim(claim);
    }

    persistClaimDelete(claimId: number): void {
        if (!this.claimsPersistence) {
            return;
        }
        if (!Number.isSafeInteger(claimId) || claimId <= 0) {
            return;
        }
        this.claimsPersistence.deleteClaim(claimId);
    }

    installPlugins(): void {
        if (this.pluginsInstalled) {
            return;
        }
        this.pluginsInstalled = true;

        const ctx = Object.freeze({
            apiVersion: SERVER_PLUGIN_API_VERSION,
            world: this,
            ecs: Object.freeze({
                registerSystem: ((stage: SchedulerStage, name: string, run) => {
                    this.ecsPipeline.registerSystem(stage, name, run);
                }) as ServerPluginEcsApi['registerSystem'],
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

    private applyMapRegistry(mapRegistry: WorldMapRegistry): void {
        this.mapRegistry = mapRegistry;
        this.map = mapRegistry.getDefaultMap();
    }

    private initializeWorldRuntimeFromActiveMap(): void {
        const self = this;
        self.closePersistence();
        const claimsStore = self.ecsPipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
        const persistence = openWorldPersistence({
            worldId: self.id,
            serverConfig: self.serverConfig,
            chunkOverlays: self.ecsPipeline.chunkOverlays,
            claimsStore,
        });
        self.chunkOverlayPersistence = persistence.chunkOverlayPersistence;
        self.chunkFlushScheduler = persistence.chunkFlushScheduler;
        self.claimsPersistence = persistence.claimsPersistence;

        bootstrapWorldMapRuntime({
            world: self,
            mobAreaConfigs: (self.map.mobAreas ?? []).filter(isMapMobAreaConfig),
            chestAreaConfigs: (self.map.chestAreas ?? []).filter(isMapChestAreaConfig),
            staticChestConfigs: (self.map.staticChests ?? []).filter(isMapChestConfig),
            createMobArea(config: MapMobAreaConfig) {
                return new MobArea(
                    config.id,
                    config.count,
                    config.mobKind,
                    config.x,
                    config.y,
                    config.width,
                    config.height,
                    self,
                    () => self.allocateEntityId_()
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

        self.updateLoopHandle?.stop();
        self.updateLoopHandle = startWorldUpdateLoop(self, self.ups);

        log.info('' + self.id + ' created (capacity: ' + self.maxPlayers + ' players).');
        self.emit('ready');
    }

    private async loadMapRuntime(mapSource: string | LooseValue): Promise<void> {
        const pack = typeof mapSource === 'string'
            ? await loadRuntimeMapPackFromSource(mapSource)
            : await compileRuntimeMapPackFromPayload(mapSource);
        if (!isMapPack(pack)) {
            throw new Error('Invalid runtime map payload after compilation.');
        }

        const registry = createWorldMapRegistryFromMapPack(pack);
        this.applyMapRegistry(registry);
        this.initializeWorldRuntimeFromActiveMap();
    }

    run(mapSource: string | LooseValue): void {
        this.installPlugins();
        void this.loadMapRuntime(mapSource).catch((error) => {
            const message = `World ${this.id} failed to load map runtime: ${String(error)}`;
            log.error(message);
            setTimeout(() => {
                throw error;
            }, 0);
        });
    }

    setUpdatesPerSecond(ups: number) {
        const normalizedUps = resolveWorldUpdatesPerSecond(ups);
        const changed = this.ups !== normalizedUps;
        this.ups = normalizedUps;

        if (!changed) {
            return;
        }

        if (this.updateLoopHandle) {
            this.updateLoopHandle.stop();
            this.updateLoopHandle = startWorldUpdateLoop(this, this.ups);
        }
    }

    pushSpawnsToPlayer(player: WorldPlayer, ids: EntityId[]) {
        const pipeline = this.ecsPipeline;
        for (let i = 0; i < ids.length; i += 1) {
            const id = ids[i];
            if (id === undefined) {
                continue;
            }
            if (!pipeline.state.world.entities.isAlive(id)) {
                continue;
            }
            try {
                this.pushToPlayer(player, pipeline.buildSpawnActionForEntityId(id));
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
            if (!pipeline.state.world.entities.isAlive(id)) {
                continue;
            }
            try {
                this.pushToPlayerId(playerId, pipeline.buildSpawnActionForEntityId(id));
            } catch (_) {
                // Entity may have been destroyed or missing replication components.
            }
        }
        log.debug('Pushed ' + ids.length + ' new spawns to ' + playerId);
    }

    pushToPlayer(player: PlayerLike, message: WorldMessage): void {
        const serializedMessage = serializeWorldMessage(message);
        pushSerializedToPlayerQueue(this.outgoingQueues, player, serializedMessage, logWorldQueueError);
    }

    pushToPlayerId(playerId: EntityId, message: WorldMessage): void {
        const serializedMessage = serializeWorldMessage(message);
        pushSerializedToPlayerIdQueue(this.outgoingQueues, playerId, serializedMessage);
    }

    pushBroadcast(message: WorldMessage, ignoredPlayerId: EntityId | null = null): void {
        const serializedMessage = serializeWorldMessage(message);
        pushSerializedBroadcastQueue(this.outgoingQueues, serializedMessage, ignoredPlayerId);
    }

    processQueues() {
        this.ecsPipeline.tick();
        try {
            this.chunkFlushScheduler?.tick(Date.now());
            this.chunkFlushTickErrorLatched = false;
        } catch (err) {
            if (!this.chunkFlushTickErrorLatched) {
                log.event('error', 'world.persistence.flush_failed', {
                    worldId: this.id,
                    phase: 'tick_flush',
                    error: String(err),
                });
                this.chunkFlushTickErrorLatched = true;
            }
        }
        flushOutgoingQueues(this.outgoingQueues, (id: string) => this.server.getConnection(id));
    }

    addEntity(entity: WorldEntitySyncInput): void {
        try {
            this.ecsPipeline.syncSpawnReplicationEntity(entity);
        } catch (err) {
            log.error('ecsPipeline.syncSpawnReplicationEntity failed: ' + String(err));
        }

        try {
            this.ecsPipeline.syncChestLootEntity(entity);
        } catch (err) {
            log.error('ecsPipeline.syncChestLootEntity failed: ' + String(err));
        }

        try {
            this.ecsPipeline.syncCombatEntity(entity);
        } catch (err) {
            log.error('ecsPipeline.syncCombatEntity failed: ' + String(err));
        }
    }

    removeEntity(entity: RemovableWorldEntity): void {
        if (entity.type === 'mob' && entity.area) {
            entity.area.removeFromArea(entity);
        }
        try {
            entity.destroy?.();
        } catch (_) {
            // ignore legacy destroy failures; ECS is authoritative
        }
        this.ecsPipeline.removeEntity(entity.id);
    }

    addPlayer(player: PlayerLike): void {
        addWorldPlayer({
            player,
            addEntity: (entity) => this.addEntity(entity),
            players: this.players,
            outgoingQueues: this.outgoingQueues,
        });

        //log.info("Added player : " + player.id);
    }

    emitPlayerEnter(player: PlayerLike): void {
        this.emit('playerEnter', player);
    }

    removePlayer(player: PlayerLike): void {
        removeWorldPlayer({
            player,
            removeEntity: (entity) => this.removeEntity(entity),
            players: this.players,
            outgoingQueues: this.outgoingQueues,
        });
    }

    addMob(mob: WorldMob): void {
        const spawnX = mob.spawningX;
        const spawnY = mob.spawningY;
        this.ecsPipeline.seedMobFromPrefabSpawn({
            id: mob.id,
            kind: mob.kind,
            x: mob.x,
            y: mob.y,
            spawnX,
            spawnY,
            orientation: mob.orientation,
        });
    }

    addNpc(kind: EntityKind, x: number, y: number): WorldNpc {
        const npc = new Npc(this.allocateEntityId_(), kind, x, y);
        this.ecsPipeline.seedItemFromSpawn({ id: npc.id, kind: npc.kind, x: npc.x, y: npc.y });
        return npc;
    }

    addItem(item: WorldItem): WorldItem {
        this.ecsPipeline.seedItemFromSpawn({ id: item.id, kind: item.kind, x: item.x, y: item.y });
        return item;
    }

    createItem(kind: EntityKind, x: number, y: number): WorldItem {
        const id = this.allocateEntityId_();
        const item = Object.assign(new Entity<WorldItemEvents>(id, 'item', kind, x, y), {
            isStatic: false,
            isFromChest: false,
        });
        this.ecsPipeline.seedItemFromSpawn({ id: item.id, kind: item.kind, x: item.x, y: item.y });
        return item;
    }

    allocateEntityId_(): EntityId {
        return this.ecsPipeline.state.world.createEntity();
    }

    createChest(x: number, y: number, items: JsonLike[]): WorldItem {
        const chest = this.createItem(Types.Entities.CHEST, x, y);
        this.ecsPipeline.setChestLootTable(chest.id, items);
        return chest;
    }

    addStaticItem(item: WorldItem): WorldItem {
        this.ecsPipeline.state.world.addComponent(item.id, this.ecsPipeline.items.StaticSpawnPos, gridPos(item.x, item.y));
        return addWorldStaticItem({
            item,
            buildRespawnHandler: (staticItem) => () => {
                this.addStaticItem(staticItem);
            },
            addItem: (nextItem) => this.addItem(nextItem),
        });
    }

    addItemFromChest(kind: EntityKind, x: number, y: number): WorldItem {
        return addWorldItemFromChest({
            kind,
            x,
            y,
            createItem: (nextKind, nextX, nextY) => this.createItem(nextKind, nextX, nextY),
            addItem: (nextItem) => this.addItem(nextItem),
        });
    }

    getPlayerCount(): number {
        return countPlayersInWorld(this.players);
    }

    spawnStaticEntities(): void {
        spawnStaticEntitiesForWorld({
            staticEntities: this.map.staticEntities,
            nextMobId: () => this.allocateEntityId_(),
            resolveKindFromString: (kindName: string) => {
                const kind = Types.getKindFromString(kindName);
                if (typeof kind !== 'number') {
                    throw new Error(`Unknown entity kind: ${kindName}`);
                }
                return kind;
            },
            tileIndexToGridPosition: (tileIndex: number) => this.map.tileIndexToGridPosition(tileIndex),
            isNpcKind: (kind: EntityKind) => Types.isNpc(kind),
            isMobKind: (kind: EntityKind) => Types.isMob(kind),
            isItemKind: (kind: EntityKind) => Types.isItem(kind),
            addNpc: (kind: EntityKind, x: number, y: number) => {
                this.addNpc(kind, x, y);
            },
            createMob: (id, kind, x, y): WorldMob => new MobEntity(id, kind, x, y),
            addMob: (mob: WorldMob) => this.addMob(mob),
            isChestArea(area): area is ChestArea {
                return area instanceof ChestArea;
            },
            addMobToContainingChestArea: (mob: WorldMob) => this.tryAddingMobToChestArea(mob),
            createItem: (kind: EntityKind, x: number, y: number) => this.createItem(kind, x, y),
            addStaticItem: (item) => {
                this.addStaticItem(item);
            },
        });
    }

    isValidPosition(x: number, y: number): boolean {
        return isWorldPositionValid(this.map, x, y);
    }

    getDefaultMapId(): string {
        return this.mapRegistry?.defaultMapId ?? 'world_01';
    }

    getMapById(mapId: string): WorldMapLike | null {
        return this.mapRegistry?.getMapById(mapId) ?? null;
    }

    isValidPositionForMap(mapId: string, x: number, y: number): boolean {
        if (this.mapRegistry) {
            return this.mapRegistry.isValidPosition(mapId, x, y);
        }
        return this.isValidPosition(x, y);
    }

    resolveDoorTeleport(mapId: string, x: number, y: number): Readonly<{ toMapId: string; to: GridPos }> | null {
        const resolved = this.mapRegistry?.resolveDoorTeleport(mapId, x, y);
        if (!resolved) {
            return null;
        }
        return {
            toMapId: resolved.toMapId,
            to: gridPos(resolved.to.x, resolved.to.y),
        };
    }

    recordMapTransitionEvent(event: MapTransitionEvent): void {
        const counters = this.mapTransitionCounters;
        if (event.kind === 'begin') {
            counters.attempts += 1;
            log.event('info', WORLD_EVENT_NAMES.MAP_TRANSITION_BEGIN, {
                worldId: this.id,
                playerId: event.playerId,
                fromMapId: event.fromMapId,
                toMapId: event.toMapId,
                toX: event.toX,
                toY: event.toY,
                attempts: counters.attempts,
                commits: counters.commits,
                rejects: counters.rejects,
            });
            return;
        }
        if (event.kind === 'commit') {
            counters.commits += 1;
            log.event('info', WORLD_EVENT_NAMES.MAP_TRANSITION_COMMIT, {
                worldId: this.id,
                playerId: event.playerId,
                fromMapId: event.fromMapId,
                toMapId: event.toMapId,
                toX: event.toX,
                toY: event.toY,
                attempts: counters.attempts,
                commits: counters.commits,
                rejects: counters.rejects,
            });
            return;
        }

        counters.rejects += 1;
        counters.rejectByReason[event.reason] = (counters.rejectByReason[event.reason] ?? 0) + 1;
        log.event('info', WORLD_EVENT_NAMES.MAP_TRANSITION_REJECT, {
            worldId: this.id,
            playerId: event.playerId,
            fromMapId: event.fromMapId,
            toMapId: event.toMapId,
            toX: event.toX,
            toY: event.toY,
            reason: event.reason,
            destinationOccupantId: event.destinationOccupantId ?? null,
            attempts: counters.attempts,
            commits: counters.commits,
            rejects: counters.rejects,
            rejectReasonCount: counters.rejectByReason[event.reason] ?? 0,
        });
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

    getDroppedItem(mob: WorldMob): WorldItem | null {
        const prefab = requireMobPrefab(mob.kind);
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

    handleItemDespawn(item: WorldItem): void {
        this.ecsPipeline.scheduleItemDespawn(item);
    }

    handleEmptyMobArea(_area: MobArea): void {}

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
