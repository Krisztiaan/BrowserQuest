import type { EntityKind } from '../../shared/js/entity-kind-domain';
import Messages from './message';

type NextItemId = () => string;
type CreateChest<TItem> = (id: string, x: number, y: number) => TItem;
type CreateItem<TItem> = (id: string, kind: EntityKind, x: number, y: number) => TItem;

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
    setItems(items: unknown[]): void;
};

type CreateItemFn<TItem> = (kind: EntityKind, x: number, y: number) => TItem;
type IsChestFn<TItem, TChest extends TItem & ChestWithItems> = (item: TItem) => item is TChest;

type CreateWorldChestParams<TItem, TChest extends TItem & ChestWithItems> = {
    x: number;
    y: number;
    items: unknown[];
    chestKind: EntityKind;
    createItem: CreateItemFn<TItem>;
    isChest: IsChestFn<TItem, TChest>;
};

type ItemDespawnConfig = {
    beforeBlinkDelay: number;
    blinkCallback: () => void;
    blinkingDuration: number;
    despawnCallback: () => void;
};

type DespawnableItem = {
    group: string;
    handleDespawn(config: ItemDespawnConfig): void;
};

type ItemDespawnHost = {
    pushToAdjacentGroups(groupId: string, message: unknown): void;
    removeEntity(item: DespawnableItem): void;
};

type EmptyChestArea = {
    chestX: number;
    chestY: number;
    items: unknown[];
};

type WorldChestAreaHost = {
    createChest(x: number, y: number, items: unknown[]): ChestEntity;
    addItem(chest: ChestEntity): ChestEntity;
    handleItemDespawn(item: ChestEntity): void;
};

type ChestLike = {
    group: string;
    x: number;
    y: number;
    despawn(): unknown;
    getRandomItem(): unknown;
};

type OpenedChestHost = {
    pushToAdjacentGroups(groupId: string, message: unknown): void;
    removeEntity(entity: ChestLike): void;
    addItemFromChest(kind: unknown, x: number, y: number): unknown;
    handleItemDespawn(item: unknown): void;
};

type ChestEntity = unknown;

type ChestAreaLike<TMob> = {
    contains(mob: TMob): boolean;
    addToArea(mob: TMob): void;
};

type GridPosition = {
    x: number;
    y: number;
};

type StaticEntityMap = Record<string, string> | undefined;

type SpawnMob = {
    id: string | number;
    isDead: boolean;
    area?: unknown;
    on(eventName: 'respawn', callback: () => void): void;
    on(eventName: 'move', callback: (mob: SpawnMob) => void): void;
};

type SpawnChestAreaLike = {
    addToArea(entity: unknown): void;
};

type SpawnStaticEntitiesForWorldParams = {
    staticEntities: StaticEntityMap;
    resolveKindFromString(kindName: string): EntityKind;
    tileIndexToGridPosition(tileIndex: number): GridPosition;
    isNpcKind(kind: EntityKind): boolean;
    isMobKind(kind: EntityKind): boolean;
    isItemKind(kind: EntityKind): boolean;
    addNpc(kind: EntityKind, x: number, y: number): void;
    createMob(id: string, kind: EntityKind, x: number, y: number): SpawnMob;
    addMob(mob: SpawnMob): void;
    isChestArea(area: unknown): area is SpawnChestAreaLike;
    addMobToContainingChestArea(mob: SpawnMob): void;
    onMobMove(mob: SpawnMob): void;
    createItem(kind: EntityKind, x: number, y: number): unknown;
    addStaticItem(item: unknown): void;
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

export function scheduleWorldItemDespawn(host: ItemDespawnHost, item: DespawnableItem | null | undefined): void {
    if (!item) {
        return;
    }

    item.handleDespawn({
        beforeBlinkDelay: 10000,
        blinkCallback: function () {
            host.pushToAdjacentGroups(
                item.group,
                new Messages.Blink(item as unknown as ConstructorParameters<typeof Messages.Blink>[0])
            );
        },
        blinkingDuration: 4000,
        despawnCallback: function () {
            host.pushToAdjacentGroups(
                item.group,
                new Messages.Destroy(item as unknown as ConstructorParameters<typeof Messages.Destroy>[0])
            );
            host.removeEntity(item);
        },
    });
}

export function handleEmptyChestAreaRefill(host: WorldChestAreaHost, area: EmptyChestArea | null | undefined): void {
    if (!area) {
        return;
    }

    const chest = host.addItem(host.createChest(area.chestX, area.chestY, area.items));
    host.handleItemDespawn(chest);
}

export function handleOpenedChestOrchestration(host: OpenedChestHost, chest: ChestLike): void {
    host.pushToAdjacentGroups(chest.group, chest.despawn());
    host.removeEntity(chest);

    const kind = chest.getRandomItem();
    if (kind) {
        const item = host.addItemFromChest(kind, chest.x, chest.y);
        host.handleItemDespawn(item);
    }
}

export function addMobToContainingChestAreas<TMob>(
    chestAreas: Array<ChestAreaLike<TMob>>,
    mob: TMob
): void {
    chestAreas.forEach(function (area) {
        if (area.contains(mob)) {
            area.addToArea(mob);
        }
    });
}

export function spawnStaticEntitiesForWorld({
    staticEntities,
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
    onMobMove,
    createItem,
    addStaticItem,
}: SpawnStaticEntitiesForWorldParams): void {
    let count = 0;

    Object.keys(staticEntities || {}).forEach((tileId) => {
        const kindName = (staticEntities as Record<string, string>)[tileId];
        const kind = resolveKindFromString(kindName);
        const position = tileIndexToGridPosition(Number.parseInt(tileId, 10));
        const x = position.x + 1;
        const y = position.y;

        if (isNpcKind(kind)) {
            addNpc(kind, x, y);
        }

        if (isMobKind(kind)) {
            const mob = createMob('7' + kind + count++, kind, x, y);
            mob.on('respawn', () => {
                mob.isDead = false;
                addMob(mob);
                if (mob.area && isChestArea(mob.area)) {
                    mob.area.addToArea(mob);
                }
            });
            mob.on('move', onMobMove);
            addMob(mob);
            addMobToContainingChestArea(mob);
        }

        if (isItemKind(kind)) {
            addStaticItem(createItem(kind, x, y));
        }
    });
}
