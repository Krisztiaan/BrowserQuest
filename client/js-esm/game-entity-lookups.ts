import Chest from './chest';
import Mob from './mob';
import Npc from './npc';
import Types from './compat/gametypes';
import type Game from './game';

type GridEntity = Game['entities'][string];

export function getItemAtPosition(game: Game, x: number, y: number): GridEntity | null {
    if (game.map.isOutOfBounds(x, y) || !game.itemGrid) {
        return null;
    }

    const items = game.itemGrid[y][x];
    let item: GridEntity | null = null;

    if (items && Object.keys(items).length > 0) {
        // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
        Object.keys(items).forEach(function (id: string) {
            const candidate = items[id];
            if (Types.isExpendableItem(candidate.kind)) {
                item = candidate;
            }
        });

        // Else, get the first item of the stack.
        if (!item) {
            item = items[Object.keys(items)[0]];
        }
    }

    return item;
}

export function getEntityAtPosition(game: Game, x: number, y: number): GridEntity | null {
    if (game.map.isOutOfBounds(x, y) || !game.entityGrid) {
        return null;
    }

    const entities = game.entityGrid[y][x];
    let entity: GridEntity | null = null;
    if (entities && Object.keys(entities).length > 0) {
        entity = entities[Object.keys(entities)[0]];
    } else {
        entity = getItemAtPosition(game, x, y);
    }

    return entity;
}

function getEntityOfType<T extends GridEntity>(
    game: Game,
    x: number,
    y: number,
    ctor: new (...args: any[]) => T
): T | null {
    const entity = getEntityAtPosition(game, x, y);
    if (entity && entity instanceof ctor) {
        return entity;
    }
    return null;
}

export function getMobAtPosition(game: Game, x: number, y: number): Mob | null {
    return getEntityOfType(game, x, y, Mob);
}

export function getNpcAtPosition(game: Game, x: number, y: number): Npc | null {
    return getEntityOfType(game, x, y, Npc);
}

export function getChestAtPosition(game: Game, x: number, y: number): Chest | null {
    return getEntityOfType(game, x, y, Chest);
}
