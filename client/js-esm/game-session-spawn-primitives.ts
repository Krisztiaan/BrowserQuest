type SpawnChestContract = {
    id: string | number;
    gridX: number;
    gridY: number;
    getSpriteName(): string;
    setSprite(sprite: unknown): void;
    setGridPosition(x: number, y: number): void;
    setAnimation(name: string, speed: number, count?: number, callback?: () => void): void;
    on(eventName: 'open', callback: () => void): void;
    stopBlinking(): void;
};

type SpawnPrimitiveHost<TItem, TChest extends SpawnChestContract> = {
    registerSpawnItem(callback: (item: TItem, x: number, y: number) => void): void;
    registerSpawnChest(callback: (chest: TChest, x: number, y: number) => void): void;
    onItemSpawned(item: TItem, x: number, y: number): void;
    onChestSpawned(chest: TChest, x: number, y: number): void;
    onChestRemoved(chest: TChest): void;
    getSprite(name: string): unknown;
    addItem(item: TItem, x: number, y: number): void;
    addChestEntity(chest: TChest): void;
    removeChestEntity(chest: TChest): void;
    removeChestFromRenderingGrid(chest: TChest, x: number, y: number): void;
    clearPreviousClickPosition(): void;
};

export function installSpawnPrimitiveHandlers<TItem, TChest extends SpawnChestContract>(
    host: SpawnPrimitiveHost<TItem, TChest>
): void {
    host.registerSpawnItem(function (item, x, y) {
        host.onItemSpawned(item, x, y);
        host.addItem(item, x, y);
    });

    host.registerSpawnChest(function (chest, x, y) {
        host.onChestSpawned(chest, x, y);
        chest.setSprite(host.getSprite(chest.getSpriteName()));
        chest.setGridPosition(x, y);
        chest.setAnimation('idle_down', 150);
        host.addChestEntity(chest);

        chest.on('open', function () {
            chest.stopBlinking();
            chest.setSprite(host.getSprite('death'));
            chest.setAnimation('death', 120, 1, function () {
                host.onChestRemoved(chest);
                host.removeChestEntity(chest);
                host.removeChestFromRenderingGrid(chest, chest.gridX, chest.gridY);
                host.clearPreviousClickPosition();
            });
        });
    });
}
