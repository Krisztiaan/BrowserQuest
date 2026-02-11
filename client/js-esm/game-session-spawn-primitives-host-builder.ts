import Chest from './chest';
import Item from './item';
import log from './compat/log';
import Types from './compat/gametypes';
import type { GameClientEventSource } from './gameclient';
import { installSpawnPrimitiveHandlersFromHost } from './game-session-spawn-primitives-builder';

type SpawnPrimitiveBuilderGame = {
    client: {
        on: GameClientEventSource['on'];
    } | null;
    sprites: Record<string, unknown>;
    previousClickPosition: Partial<{ x: number; y: number }>;
    addItem(item: Item, x: number, y: number): void;
    addEntity(chest: Chest): void;
    removeEntity(chest: Chest): void;
    removeFromRenderingGrid(chest: Chest, x: number, y: number): void;
};

export function installSpawnPrimitiveHandlersFromGame(game: SpawnPrimitiveBuilderGame): void {
    if (!game.client) {
        return;
    }

    installSpawnPrimitiveHandlersFromHost<Item, Chest>({
        client: game.client,
        describeKind(kind) {
            return Types.getKindAsString(kind) ?? 'unknown';
        },
        logInfo(message) {
            log.info(message);
        },
        getSprite(name) {
            return game.sprites[name];
        },
        addItem(item, x, y) {
            game.addItem(item, x, y);
        },
        addChestEntity(chest) {
            game.addEntity(chest);
        },
        removeChestEntity(chest) {
            game.removeEntity(chest);
        },
        removeChestFromRenderingGrid(chest, x, y) {
            game.removeFromRenderingGrid(chest, x, y);
        },
        clearPreviousClickPosition() {
            game.previousClickPosition = {};
        },
    });
}
