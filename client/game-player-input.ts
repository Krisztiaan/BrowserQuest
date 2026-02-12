import Chest from './chest';
import Item from './item';
import Mob from './mob';
import Npc from './npc';
import type Game from './game';

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
        game.beginAttack(entity);
        return;
    }

    if (entity instanceof Item) {
        game.beginLoot(entity);
        return;
    }

    if (entity instanceof Npc) {
        game.beginTalk(entity);
        return;
    }

    if (entity instanceof Chest) {
        game.beginOpenChest(entity);
        return;
    }

    game.clearClientInteractionIntent();
    game.makePlayerGoTo(pos.x, pos.y);
}
