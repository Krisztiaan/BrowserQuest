import type { MapChestAreaConfig, MapChestConfig, MapMobAreaConfig } from './worldserver-map-config';

type RuntimeMobArea = {
    spawnMobs(): void;
    on(eventName: 'empty', callback: () => void): void;
};

type RuntimeChestArea = {
    entities: unknown[];
    on(eventName: 'empty', callback: () => void): void;
    setNumberOfEntities(count: number): void;
};

type MapBootstrapWorld = {
    map: {
        generateCollisionGrid(): void;
    };
    mobAreas: RuntimeMobArea[];
    chestAreas: RuntimeChestArea[];
    initZoneGroups(): void;
    handleEmptyMobArea(area: RuntimeMobArea): void;
    handleEmptyChestArea(area: RuntimeChestArea): void;
    createChest(x: number, y: number, items: unknown[]): unknown;
    addStaticItem(item: unknown): void;
    spawnStaticEntities(): void;
};

type MapBootstrapInput = {
    world: MapBootstrapWorld;
    mobAreaConfigs: MapMobAreaConfig[];
    chestAreaConfigs: MapChestAreaConfig[];
    staticChestConfigs: MapChestConfig[];
    createMobArea(config: MapMobAreaConfig): RuntimeMobArea;
    createChestArea(config: MapChestAreaConfig): RuntimeChestArea;
};

export function bootstrapWorldMapRuntime({
    world,
    mobAreaConfigs,
    chestAreaConfigs,
    staticChestConfigs,
    createMobArea,
    createChestArea,
}: MapBootstrapInput): void {
    world.initZoneGroups();
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

    world.spawnStaticEntities();

    world.chestAreas.forEach(function (area) {
        area.setNumberOfEntities(area.entities.length);
    });
}
