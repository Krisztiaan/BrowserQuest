import Character from './character';
import Mob from './mob';
import Player from './player';
import type Game from './game';
import Types from '../shared/gametypes-browser';

type AdjacentPosition = { x: number; y: number; o: number };

function getPositionAheadOfTarget(target: Player): AdjacentPosition | null {
    switch (target.orientation) {
        case Types.Orientations.UP:
            return { x: target.gridX, y: target.gridY - 1, o: target.orientation };
        case Types.Orientations.DOWN:
            return { x: target.gridX, y: target.gridY + 1, o: target.orientation };
        case Types.Orientations.LEFT:
            return { x: target.gridX - 1, y: target.gridY, o: target.orientation };
        case Types.Orientations.RIGHT:
            return { x: target.gridX + 1, y: target.gridY, o: target.orientation };
        default:
            return null;
    }
}

function moveAttackerToAdjacentTile(game: Game, attacker: Character, target: Player, position: AdjacentPosition): void {
    attacker.previousTarget = target;
    attacker.disengage();
    attacker.idle();
    game.makeCharacterGoTo(attacker, position.x, position.y);
    target.adjacentTiles[position.o] = true;
}

export function hasMobOnTile(game: Game, mob: Character, x?: number, y?: number): boolean {
    const tileX = x || mob.gridX;
    const tileY = y || mob.gridY;
    const list = game.entityGrid?.[tileY]?.[tileX];

    if (!list) {
        return false;
    }

    let result = false;
    Object.keys(list).forEach(function (id: string) {
        const entity = list[id];
        if (entity instanceof Mob && entity.id !== mob.id) {
            result = true;
        }
    });

    return result;
}

export function findFreeAdjacentNonDiagonalPosition(game: Game, entity: Character): AdjacentPosition | null {
    let result: AdjacentPosition | null = null;

    entity.forEachAdjacentNonDiagonalPosition(function (x: number, y: number, orientation: number) {
        if (!result && !game.map.isColliding(x, y) && !game.isMobAt(x, y)) {
            result = { x, y, o: orientation };
        }
    });

    return result;
}

export function tryMovingCharacterToDifferentTile(game: Game, character: Character): boolean {
    const attacker = character;
    const target = character.target;

    if (!(attacker && target && target instanceof Player)) {
        return false;
    }

    if (!target.isMoving() && attacker.getDistanceToEntity(target) === 0) {
        const positionAhead = getPositionAheadOfTarget(target);

        if (positionAhead) {
            moveAttackerToAdjacentTile(game, attacker, target, positionAhead);
            return true;
        }
    }

    if (!target.isMoving() && attacker.isAdjacentNonDiagonal(target) && hasMobOnTile(game, attacker)) {
        const adjacentPosition = findFreeAdjacentNonDiagonalPosition(game, target);

        // Avoid stacking mobs on the same tile next to a player by moving to available adjacent tiles.
        if (adjacentPosition && !target.adjacentTiles[adjacentPosition.o]) {
            if (game.player.target && attacker.id === game.player.target.id) {
                return false;
            }

            moveAttackerToAdjacentTile(game, attacker, target, adjacentPosition);
            return true;
        }
    }

    return false;
}
