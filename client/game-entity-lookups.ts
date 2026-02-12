import Chest from './chest';
import Mob from './mob';
import Npc from './npc';
import Types from '../shared/gametypes-browser';
import type Game from './game';

type GridEntity = Game['entities'][string];

export function getItemAtPosition(game: Game, x: number, y: number): GridEntity | null {
    if (!game.map || game.map.isOutOfBounds(x, y)) {
        return null;
    }

    const itemIds = game.kernel.getClientItemIdsAt(x, y);
    let item: GridEntity | null = null;

    if (itemIds.length === 0) {
        return null;
    }

    // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
    for (const id of itemIds) {
        const candidate = game.entities[String(id)];
        if (candidate && Types.isExpendableItem(candidate.kind)) {
            item = candidate;
        }
    }

    // Else, get the first item of the stack.
    if (item === null) {
        const firstId = itemIds[0];
        if (firstId !== undefined) {
            item = game.entities[String(firstId)] ?? null;
        }
    }

    return item;
}

export function getEntityAtPosition(game: Game, x: number, y: number): GridEntity | null {
    if (!game.map || game.map.isOutOfBounds(x, y)) {
        return null;
    }

    const entityIds = game.kernel.getClientEntityIdsAt(x, y);
    if (entityIds.length === 0) {
        return getItemAtPosition(game, x, y);
    }

    const firstId = entityIds[0];
    const entity = firstId !== undefined ? (game.entities[String(firstId)] ?? null) : null;
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
