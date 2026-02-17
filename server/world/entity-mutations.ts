import type { EntityKind } from '../../shared/entity-kind-domain';
import type { OutgoingQueues } from './contracts';
import type { EntityId } from '../../shared/domain/ids';

type IdentifiedEntity = {
    id: EntityId;
};

type EntityCollection<T> = Record<string, T>;

type AddEntity<T extends IdentifiedEntity> = (entity: T) => void;
type RemoveEntity<T extends IdentifiedEntity> = (entity: T) => void;

type RespawnableStaticItem = {
    isStatic: boolean;
    on(eventName: 'respawn', callback: () => void): void;
};

type ChestOriginItem = {
    isFromChest: boolean;
};

type RemovableEntity = IdentifiedEntity & {
    type: string;
    kind: EntityKind;
    destroy(): void;
};

type CreateItemFromKind<TItem extends ChestOriginItem> = (kind: EntityKind, x: number, y: number) => TItem;
type CreateNpc<TNpc extends IdentifiedEntity> = (kind: EntityKind, x: number, y: number) => TNpc;

type ClearMobLinks = (mob: RemovableEntity) => void;
type ResolveKindAsString = (kind: EntityKind) => string;
type LogDebug = (message: string) => void;

export function addWorldEntity({
    entity,
    entities,
}: {
    entity: IdentifiedEntity;
    entities: EntityCollection<IdentifiedEntity>;
}): void {
    entities[entity.id] = entity;
}

export function addWorldPlayer<T extends IdentifiedEntity>({
    player,
    addEntity,
    players,
    outgoingQueues,
}: {
    player: T;
    addEntity: AddEntity<T>;
    players: EntityCollection<T>;
    outgoingQueues: OutgoingQueues;
}): void {
    addEntity(player);
    players[player.id] = player;
    outgoingQueues[player.id] = [];
}

export function removeWorldPlayer<T extends IdentifiedEntity>({
    player,
    removeEntity,
    players,
    outgoingQueues,
}: {
    player: T;
    removeEntity: RemoveEntity<T>;
    players: EntityCollection<T>;
    outgoingQueues: OutgoingQueues;
}): void {
    removeEntity(player);
    delete players[player.id];
    delete outgoingQueues[player.id];
}

export function addWorldMob<T extends IdentifiedEntity>({
    mob,
    addEntity,
    mobs,
}: {
    mob: T;
    addEntity: AddEntity<T>;
    mobs: EntityCollection<T>;
}): void {
    addEntity(mob);
    mobs[mob.id] = mob;
}

export function addWorldItem<T extends IdentifiedEntity>({
    item,
    addEntity,
    items,
}: {
    item: T;
    addEntity: AddEntity<T>;
    items: EntityCollection<T>;
}): T {
    addEntity(item);
    items[item.id] = item;
    return item;
}

export function addWorldItemFromChest<TItem extends ChestOriginItem>({
    kind,
    x,
    y,
    createItem,
    addItem,
}: {
    kind: EntityKind;
    x: number;
    y: number;
    createItem: CreateItemFromKind<TItem>;
    addItem: (item: TItem) => TItem;
}): TItem {
    const item = createItem(kind, x, y);
    item.isFromChest = true;
    return addItem(item);
}

export function addWorldStaticItem<TItem extends RespawnableStaticItem>({
    item,
    buildRespawnHandler,
    addItem,
}: {
    item: TItem;
    buildRespawnHandler: (item: TItem) => () => void;
    addItem: (item: TItem) => TItem;
}): TItem {
    item.isStatic = true;
    const flagged = item as RespawnableStaticItem & { __bqStaticRespawnBound?: boolean };
    if (!flagged.__bqStaticRespawnBound) {
        flagged.__bqStaticRespawnBound = true;
        item.on('respawn', buildRespawnHandler(item));
    }
    return addItem(item);
}

export function addWorldNpc<TNpc extends IdentifiedEntity>({
    kind,
    x,
    y,
    createNpc,
    addEntity,
    npcs,
}: {
    kind: EntityKind;
    x: number;
    y: number;
    createNpc: CreateNpc<TNpc>;
    addEntity: AddEntity<TNpc>;
    npcs: EntityCollection<TNpc>;
}): TNpc {
    const npc = createNpc(kind, x, y);
    addEntity(npc);
    npcs[npc.id] = npc;
    return npc;
}

export function removeWorldEntity({
    entity,
    entities,
    mobs,
    items,
    clearMobAggroLink,
    clearMobHateLinks,
    resolveKindAsString,
    logDebug,
}: {
    entity: RemovableEntity;
    entities: EntityCollection<RemovableEntity>;
    mobs: EntityCollection<RemovableEntity>;
    items: EntityCollection<RemovableEntity>;
    clearMobAggroLink: ClearMobLinks;
    clearMobHateLinks: ClearMobLinks;
    resolveKindAsString: ResolveKindAsString;
    logDebug: LogDebug;
}): void {
    if (entity.id in entities) {
        delete entities[entity.id];
    }
    if (entity.id in mobs) {
        delete mobs[entity.id];
    }
    if (entity.id in items) {
        delete items[entity.id];
    }

    if (entity.type === 'mob') {
        clearMobAggroLink(entity);
        clearMobHateLinks(entity);
    }

    entity.destroy();
    logDebug('Removed ' + resolveKindAsString(entity.kind) + ' : ' + entity.id);
}
