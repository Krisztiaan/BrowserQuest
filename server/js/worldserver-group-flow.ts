import Player from './player';
import { flushOutgoingQueues } from './worldserver-transport';
import type { OutgoingQueues, WorldConnection } from './worldserver-contracts';

type GroupEntities = Record<string, unknown>;

type WorldGroupLike = {
    entities: GroupEntities;
};

type WorldGroups = Record<string, WorldGroupLike>;
type EntityMap<T> = Record<string, T>;
type EntityCallback<T> = (entity: T) => void;

type IterateWorldCharactersParams<TCharacter> = {
    callback: EntityCallback<TCharacter>;
    forEachPlayer(callback: EntityCallback<TCharacter>): void;
    forEachMob(callback: EntityCallback<TCharacter>): void;
};

type RelevantListPlayer = {
    id: string | number;
    group: string;
};

type PushToPlayer = (player: RelevantListPlayer, message: unknown) => void;
type CreateListMessage = (entityIds: number[]) => unknown;

type PushRelevantEntityListToPlayerParams = {
    player: RelevantListPlayer | null | undefined;
    groups: WorldGroups;
    pushToPlayer: PushToPlayer;
    createListMessage: CreateListMessage;
};

type SpawnId = string | number;

type SpawnListPlayer = {
    id: string | number;
};

type PushSpawnEntitiesParams<TSpawnableEntity> = {
    spawnIds: SpawnId[];
    getEntityById(id: SpawnId): unknown;
    isSpawnableEntity(entity: unknown): entity is TSpawnableEntity;
    pushSpawn(entity: TSpawnableEntity): void;
};

type PushWorldSpawnsToPlayerParams<TSpawnableEntity> = {
    player: SpawnListPlayer;
    ids?: SpawnId[] | null;
    getEntityById(id: SpawnId): unknown;
    isSpawnableEntity(entity: unknown): entity is TSpawnableEntity;
    pushToPlayer(player: SpawnListPlayer, message: unknown): void;
    createSpawnMessage(entity: TSpawnableEntity): unknown;
    logDebug(message: string): void;
};

type PreviousGroupsPlayer = {
    recentlyLeftGroups?: string[];
};

type PushToGroupFn = (groupId: string) => void;

type WorldGroupsProcessHost = {
    zoneGroupsReady: boolean;
    forEachGroup(callback: (groupId: string) => void): void;
    getIncoming(groupId: string): unknown[];
    pushSpawnToGroup(groupId: string, entity: unknown, ignoredPlayerId?: string | number): void;
    isSpawnableEntity(entity: unknown): boolean;
};

type ZoneGroupMap = {
    forEachGroup(callback: (id: string) => void): void;
};

type ZoneGroupState = {
    entities: Record<string, unknown>;
    players: Array<string | number>;
    incoming: unknown[];
};

type ZoneGroups = Record<string, ZoneGroupState>;

type GetConnection = (id: string | number) => WorldConnection | undefined;

export function collectRelevantEntityIds(groupEntities: GroupEntities, playerId: string | number): number[] {
    const entityIds: number[] = [];
    const localPlayerId = String(playerId);

    for (const entityId in groupEntities) {
        if (entityId !== localPlayerId) {
            entityIds.push(Number.parseInt(entityId, 10));
        }
    }

    return entityIds;
}

export function forEachEntityInWorldMap<T>(entityMap: EntityMap<T>, callback: EntityCallback<T>): void {
    for (const entityId in entityMap) {
        callback(entityMap[entityId]);
    }
}

export function forEachWorldCharacter<TCharacter>({
    callback,
    forEachPlayer,
    forEachMob,
}: IterateWorldCharactersParams<TCharacter>): void {
    forEachPlayer(callback);
    forEachMob(callback);
}

export function pushRelevantEntityListToPlayer({
    player,
    groups,
    pushToPlayer,
    createListMessage,
}: PushRelevantEntityListToPlayerParams): void {
    if (player && player.group in groups) {
        const groupEntities = groups[player.group].entities;
        const entities = collectRelevantEntityIds(groupEntities, player.id);
        if (entities.length > 0) {
            pushToPlayer(player, createListMessage(entities));
        }
    }
}

export function pushSpawnEntitiesToPlayer<TSpawnableEntity>({
    spawnIds,
    getEntityById,
    isSpawnableEntity,
    pushSpawn,
}: PushSpawnEntitiesParams<TSpawnableEntity>): void {
    for (let index = 0; index < spawnIds.length; index += 1) {
        const spawnId = spawnIds[index];
        const entity = getEntityById(spawnId);
        if (isSpawnableEntity(entity)) {
            pushSpawn(entity);
        }
    }
}

export function pushWorldSpawnsToPlayer<TSpawnableEntity>({
    player,
    ids,
    getEntityById,
    isSpawnableEntity,
    pushToPlayer,
    createSpawnMessage,
    logDebug,
}: PushWorldSpawnsToPlayerParams<TSpawnableEntity>): void {
    const spawnIds = ids || [];
    pushSpawnEntitiesToPlayer({
        spawnIds,
        getEntityById,
        isSpawnableEntity,
        pushSpawn(entity) {
            pushToPlayer(player, createSpawnMessage(entity));
        },
    });

    logDebug('Pushed ' + (ids ? ids.length : 0) + ' new spawns to ' + player.id);
}

export function pushMessageToPreviouslyLeftGroups(player: PreviousGroupsPlayer, pushToGroup: PushToGroupFn): void {
    const previouslyLeftGroups = player.recentlyLeftGroups || [];
    for (let index = 0; index < previouslyLeftGroups.length; index += 1) {
        pushToGroup(previouslyLeftGroups[index]);
    }
    player.recentlyLeftGroups = [];
}

export function processWorldGroups(host: WorldGroupsProcessHost): void {
    if (!host.zoneGroupsReady) {
        return;
    }

    host.forEachGroup(function (groupId) {
        const incoming = host.getIncoming(groupId);
        if (incoming.length === 0) {
            return;
        }

        for (let index = 0; index < incoming.length; index += 1) {
            const entity = incoming[index];
            if (entity instanceof Player) {
                host.pushSpawnToGroup(groupId, entity, entity.id);
            } else if (host.isSpawnableEntity(entity)) {
                host.pushSpawnToGroup(groupId, entity);
            }
        }

        incoming.length = 0;
    });
}

export function processWorldOutgoingQueues(
    outgoingQueues: OutgoingQueues,
    getConnection: GetConnection
): void {
    flushOutgoingQueues(outgoingQueues, getConnection);
}

export function initializeWorldZoneGroups(map: ZoneGroupMap, groups: ZoneGroups): void {
    map.forEachGroup((groupId) => {
        groups[groupId] = { entities: {}, players: [], incoming: [] };
    });
}
