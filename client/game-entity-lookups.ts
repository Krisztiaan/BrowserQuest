import Chest from './chest';
import Mob from './mob';
import Npc from './npc';
import Types from '../shared/gametypes-browser';
import type Game from './game';

type GridEntity = Game['entities'][string];

export function getItemAtPosition(game: Game, x: number, y: number): GridEntity | null {
    if (game.map.isOutOfBounds(x, y) || !game.itemGrid) {
        return null;
    }

    const row = game.itemGrid[y];
    if (!row) {
        return null;
    }
    const items = row[x];
    let item: GridEntity | null = null;

    if (items) {
        const keys = Object.keys(items);
        if (keys.length === 0) {
            return null;
        }

        // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
        for (const id of keys) {
            const candidate = items[id];
            if (candidate && Types.isExpendableItem(candidate.kind)) {
                item = candidate;
            }
        }

        // Else, get the first item of the stack.
        if (item === null) {
            const firstKey = keys[0];
            if (firstKey) {
                item = items[firstKey] ?? null;
            }
        }
    }

    return item;
}

export function getEntityAtPosition(game: Game, x: number, y: number): GridEntity | null {
    if (game.map.isOutOfBounds(x, y) || !game.entityGrid) {
        return null;
    }

    const row = game.entityGrid[y];
    if (!row) {
        return null;
    }
    const entities = row[x];
    if (!entities) {
        return getItemAtPosition(game, x, y);
    }

    const keys = Object.keys(entities);
    if (keys.length === 0) {
        return getItemAtPosition(game, x, y);
    }

    const firstKey = keys[0];
    const entity = firstKey ? (entities[firstKey] ?? null) : null;
    if (entity) {
        return entity;
    }

    return getItemAtPosition(game, x, y);
}

function getEntityOfType<T extends GridEntity>(
    game: Game,
    x: number,
    y: number,
    ctor: new (...args: unknown[]) => T
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
