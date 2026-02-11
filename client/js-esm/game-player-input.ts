import Chest from './chest';
import Item from './item';
import Mob from './mob';
import Npc from './npc';
import type Game from './game';

type MaybeHighlightableEntity = {
    isHighlighted?: boolean;
    setHighlight(isHighlighted: boolean): void;
};

const isHighlightableEntity = (entity: unknown): entity is MaybeHighlightableEntity => {
    if (!entity || typeof entity !== 'object') {
        return false;
    }

    return typeof (entity as MaybeHighlightableEntity).setHighlight === 'function';
};

export function updatePlayerHoverState(game: Game): void {
    const mouse = game.getMouseGridPosition();
    const x = mouse.x;
    const y = mouse.y;

    if (!game.player || game.renderer.mobile || game.renderer.tablet) {
        return;
    }

    game.hoveringCollidingTile = game.map.isColliding(x, y);
    game.hoveringPlateauTile = game.player.isOnPlateau ? !game.map.isPlateau(x, y) : game.map.isPlateau(x, y);
    game.hoveringMob = game.isMobAt(x, y);
    game.hoveringItem = game.isItemAt(x, y);
    game.hoveringNpc = game.isNpcAt(x, y);
    game.hoveringChest = game.isChestAt(x, y);

    if (game.hoveringMob || game.hoveringNpc || game.hoveringChest) {
        const entity = game.getEntityAt(x, y);
        const highlightableEntity: MaybeHighlightableEntity | null =
            entity && isHighlightableEntity(entity) ? entity : null;

        if (highlightableEntity && !highlightableEntity.isHighlighted && game.renderer.supportsSilhouettes) {
            if (game.lastHovered) {
                game.lastHovered.setHighlight(false);
            }
            game.lastHovered = entity!;
            highlightableEntity.setHighlight(true);
        }
    } else if (game.lastHovered) {
        game.lastHovered.setHighlight(false);
        game.lastHovered = null;
    }
}

export function processPlayerClick(game: Game): void {
    const pos = game.getMouseGridPosition();

    if (pos.x === game.previousClickPosition.x && pos.y === game.previousClickPosition.y) {
        return;
    }

    game.previousClickPosition = pos;

    if (
        !game.started ||
        !game.player ||
        game.isZoning() ||
        game.isZoningTile(game.player.nextGridX, game.player.nextGridY) ||
        game.player.isDead ||
        game.hoveringCollidingTile ||
        game.hoveringPlateauTile
    ) {
        return;
    }

    const entity = game.getEntityAt(pos.x, pos.y);

    if (entity instanceof Mob) {
        game.makePlayerAttack(entity);
        return;
    }

    if (entity instanceof Item) {
        game.makePlayerGoToItem(entity);
        return;
    }

    if (entity instanceof Npc) {
        if (!game.player.isAdjacentNonDiagonal(entity)) {
            game.makePlayerTalkTo(entity);
        } else {
            game.makeNpcTalk(entity);
        }
        return;
    }

    if (entity instanceof Chest) {
        game.makePlayerOpenChest(entity);
        return;
    }

    game.makePlayerGoTo(pos.x, pos.y);
}
