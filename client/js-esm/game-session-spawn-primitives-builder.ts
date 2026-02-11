import type { EntityKind } from '../../shared/js/entity-kind-domain';
import { installSpawnPrimitiveHandlers } from './game-session-spawn-primitives';
import type { GameClientEventSource } from './gameclient';

type SpawnPrimitiveItem = {
    kind: EntityKind;
    id: string | number;
};

type SpawnPrimitiveChestContract = {
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

type SpawnPrimitiveClient<TItem, TChest> = {
    on: GameClientEventSource['on'];
};

type SpawnPrimitiveBuilderHost<TItem extends SpawnPrimitiveItem, TChest extends SpawnPrimitiveChestContract> = {
    client: SpawnPrimitiveClient<TItem, TChest>;
    describeKind(kind: EntityKind): string;
    logInfo(message: string): void;
    getSprite(name: string): unknown;
    addItem(item: TItem, x: number, y: number): void;
    addChestEntity(chest: TChest): void;
    removeChestEntity(chest: TChest): void;
    removeChestFromRenderingGrid(chest: TChest, x: number, y: number): void;
    clearPreviousClickPosition(): void;
};

export function installSpawnPrimitiveHandlersFromHost<
    TItem extends SpawnPrimitiveItem,
    TChest extends SpawnPrimitiveChestContract,
>(host: SpawnPrimitiveBuilderHost<TItem, TChest>): void {
    installSpawnPrimitiveHandlers<TItem, TChest>({
        registerSpawnItem(callback) {
            host.client.on('spawnItem', callback);
        },
        registerSpawnChest(callback) {
            host.client.on('spawnChest', callback);
        },
        onItemSpawned(item, x, y) {
            host.logInfo('Spawned ' + host.describeKind(item.kind) + ' (' + item.id + ') at ' + x + ', ' + y);
        },
        onChestSpawned(chest, x, y) {
            host.logInfo('Spawned chest (' + chest.id + ') at ' + x + ', ' + y);
        },
        onChestRemoved(chest) {
            host.logInfo(chest.id + ' was removed');
        },
        getSprite(name) {
            return host.getSprite(name);
        },
        addItem(item, x, y) {
            host.addItem(item, x, y);
        },
        addChestEntity(chest) {
            host.addChestEntity(chest);
        },
        removeChestEntity(chest) {
            host.removeChestEntity(chest);
        },
        removeChestFromRenderingGrid(chest, x, y) {
            host.removeChestFromRenderingGrid(chest, x, y);
        },
        clearPreviousClickPosition() {
            host.clearPreviousClickPosition();
        },
    });
}
