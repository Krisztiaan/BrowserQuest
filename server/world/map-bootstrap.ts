import type { MapChestAreaConfig, MapChestConfig, MapMobAreaConfig, MapResourceNodeConfig } from './map-config';

type ChestItemSeed = string | number;
type StaticItemLike = { id?: number | string } & object;
type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };

type RuntimeMobArea = {
    spawnMobs(): void;
    on(eventName: 'empty', callback: () => void): void;
};

type RuntimeChestArea = {
    chestX: number;
    chestY: number;
    items: JsonLike[];
    entities: object[];
    on(eventName: 'empty', callback: () => void): void;
    setNumberOfEntities(count: number): void;
};

type MapBootstrapWorld = {
    map: {
        generateCollisionGrid(): void;
    };
    mobAreas: RuntimeMobArea[];
    chestAreas: RuntimeChestArea[];
    handleEmptyMobArea(area: RuntimeMobArea): void;
    handleEmptyChestArea(area: RuntimeChestArea | null | undefined): void;
    createChest(x: number, y: number, items: ChestItemSeed[]): StaticItemLike;
    addStaticItem(item: StaticItemLike): void;
    spawnStaticEntities(): void;
};

type MapBootstrapInput = {
    world: MapBootstrapWorld;
    mobAreaConfigs: MapMobAreaConfig[];
    chestAreaConfigs: MapChestAreaConfig[];
    staticChestConfigs: MapChestConfig[];
    resourceNodeConfigs: MapResourceNodeConfig[];
    createMobArea: (this: void, config: MapMobAreaConfig) => RuntimeMobArea;
    createChestArea: (this: void, config: MapChestAreaConfig) => RuntimeChestArea;
    upsertResourceNode: (this: void, config: MapResourceNodeConfig) => void;
};

export function bootstrapWorldMapRuntime({
    world,
    mobAreaConfigs,
    chestAreaConfigs,
    staticChestConfigs,
    resourceNodeConfigs,
    createMobArea,
    createChestArea,
    upsertResourceNode,
}: MapBootstrapInput): void {
    world.map.generateCollisionGrid();

    mobAreaConfigs.forEach(function (config) {
        const area = createMobArea(config);
        area.spawnMobs();
        area.on('empty', function () {
            world.handleEmptyMobArea(area);
        });
        world.mobAreas.push(area);
    });

    chestAreaConfigs.forEach(function (config) {
        const area = createChestArea(config);
        world.chestAreas.push(area);
        area.on('empty', function () {
            world.handleEmptyChestArea(area);
        });
    });

    staticChestConfigs.forEach(function (chest) {
        const staticChest = world.createChest(chest.x, chest.y, chest.i);
        world.addStaticItem(staticChest);
    });

    resourceNodeConfigs.forEach(function (config) {
        upsertResourceNode(config);
    });

    world.spawnStaticEntities();

    world.chestAreas.forEach(function (area) {
        area.setNumberOfEntities(area.entities.length);
    });
}
