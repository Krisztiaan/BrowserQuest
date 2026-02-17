import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };

type NextItemId = () => EntityId;
type CreateChest<TItem> = (id: EntityId, x: number, y: number) => TItem;
type CreateItem<TItem> = (id: EntityId, kind: EntityKind, x: number, y: number) => TItem;

type CreateWorldItemParams<TItem> = {
    kind: EntityKind;
    x: number;
    y: number;
    chestKind: EntityKind;
    nextItemId: NextItemId;
    createChest: CreateChest<TItem>;
    createItem: CreateItem<TItem>;
};

type ChestWithItems = {
    setItems(items: JsonLike[]): void;
};

type CreateItemFn<TItem> = (kind: EntityKind, x: number, y: number) => TItem;
type IsChestFn<TItem, TChest extends TItem & ChestWithItems> = (item: TItem) => item is TChest;

type CreateWorldChestParams<TItem, TChest extends TItem & ChestWithItems> = {
    x: number;
    y: number;
    items: JsonLike[];
    chestKind: EntityKind;
    createItem: CreateItemFn<TItem>;
    isChest: IsChestFn<TItem, TChest>;
};

type EmptyChestArea = {
    chestX: number;
    chestY: number;
    items: JsonLike[];
};

type WorldChestAreaHost = {
    createChest(x: number, y: number, items: JsonLike[]): ChestEntity;
    addItem(chest: ChestEntity): ChestEntity;
    handleItemDespawn(item: ChestEntity): void;
};

type ChestEntity = object;

type PositionLike = {
    x: number;
    y: number;
};

type MobAreaEntity = PositionLike & { id: EntityId };

type ChestAreaLike<TMob extends MobAreaEntity> = {
    contains(mob: PositionLike | null | undefined): boolean;
    addToArea(mob: TMob | null | undefined): void;
};

type GridPosition = {
    x: number;
    y: number;
};

type StaticEntityMap = Record<string, string> | undefined;

type SpawnMobLike = {
    id: EntityId;
    isDead: boolean;
    x?: number;
    y?: number;
    spawningX?: number;
    spawningY?: number;
    area?: object | null;
    setPosition?(x: number, y: number): void;
    updateHitPoints?(): void;
    on(eventName: 'respawn', callback: () => void): void;
};

type SpawnChestAreaLike<TMob> = {
    addToArea(entity: TMob | null | undefined): void;
};

type SpawnStaticEntitiesForWorldParams<TMob extends SpawnMobLike, TItem> = {
    staticEntities: StaticEntityMap;
    nextMobId: () => EntityId;
    resolveKindFromString(kindName: string): EntityKind;
    tileIndexToGridPosition(tileIndex: number): GridPosition;
    isNpcKind(kind: EntityKind): boolean;
    isMobKind(kind: EntityKind): boolean;
    isItemKind(kind: EntityKind): boolean;
    addNpc(kind: EntityKind, x: number, y: number): void;
    createMob(id: EntityId, kind: EntityKind, x: number, y: number): TMob;
    addMob(mob: TMob): void;
    isChestArea(area: object): area is SpawnChestAreaLike<TMob>;
    addMobToContainingChestArea(mob: TMob): void;
    createItem(kind: EntityKind, x: number, y: number): TItem;
    addStaticItem(item: TItem): void;
};

export function createWorldItem<TItem>({
    kind,
    x,
    y,
    chestKind,
    nextItemId,
    createChest,
    createItem,
}: CreateWorldItemParams<TItem>): TItem {
    const id = nextItemId();

    if (kind === chestKind) {
        return createChest(id, x, y);
    }

    return createItem(id, kind, x, y);
}

export function createWorldChest<TItem, TChest extends TItem & ChestWithItems>({
    x,
    y,
    items,
    chestKind,
    createItem,
    isChest,
}: CreateWorldChestParams<TItem, TChest>): TItem {
    const chest = createItem(chestKind, x, y);
    if (!isChest(chest)) {
        return chest;
    }
    chest.setItems(items);
    return chest;
}

export function handleEmptyChestAreaRefill(host: WorldChestAreaHost, area: EmptyChestArea | null | undefined): void {
    if (!area) {
        return;
    }

    const chest = host.addItem(host.createChest(area.chestX, area.chestY, area.items));
    host.handleItemDespawn(chest);
}

export function addMobToContainingChestAreas<TMob extends MobAreaEntity>(
    chestAreas: Array<ChestAreaLike<TMob>>,
    mob: TMob
): void {
    chestAreas.forEach(function (area) {
        if (area.contains(mob)) {
            area.addToArea(mob);
        }
    });
}

export function spawnStaticEntitiesForWorld<TMob extends SpawnMobLike, TItem>({
    staticEntities,
    nextMobId,
    resolveKindFromString,
    tileIndexToGridPosition,
    isNpcKind,
    isMobKind,
    isItemKind,
    addNpc,
    createMob,
    addMob,
    isChestArea,
    addMobToContainingChestArea,
    createItem,
    addStaticItem,
}: SpawnStaticEntitiesForWorldParams<TMob, TItem>): void {
    Object.entries(staticEntities ?? {}).forEach(([tileId, kindName]) => {
        if (!kindName) {
            return;
        }
        const kind = resolveKindFromString(kindName);
        const position = tileIndexToGridPosition(Number.parseInt(tileId, 10));
        const x = position.x + 1;
        const y = position.y;

        if (isNpcKind(kind)) {
            addNpc(kind, x, y);
        }

        if (isMobKind(kind)) {
            const mob = createMob(nextMobId(), kind, x, y);
            mob.on('respawn', () => {
                const spawnX = typeof mob.spawningX === 'number' ? mob.spawningX : x;
                const spawnY = typeof mob.spawningY === 'number' ? mob.spawningY : y;
                if (typeof mob.setPosition === 'function') {
                    mob.setPosition(spawnX, spawnY);
                } else {
                    mob.x = spawnX;
                    mob.y = spawnY;
                }
                mob.isDead = false;
                if (typeof mob.updateHitPoints === 'function') {
                    mob.updateHitPoints();
                }
                addMob(mob);
                if (mob.area && isChestArea(mob.area)) {
                    mob.area.addToArea(mob);
                }
            });
            addMob(mob);
            addMobToContainingChestArea(mob);
        }

        if (isItemKind(kind)) {
            addStaticItem(createItem(kind, x, y));
        }
    });
}
