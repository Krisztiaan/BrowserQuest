import Chest from './chest';
import Mob from './mob';
import Npc from './npc';
import type Game from './game';
import type Item from './item';
import Types from '../../shared/js/gametypes-browser';

export function movePlayerToItem(game: Game, item: Item | null): void {
    if (!item) {
        return;
    }

    game.player.isLootMoving = true;
    game.makePlayerGoTo(item.gridX, item.gridY);
    game.client.sendLootMove(item, item.gridX, item.gridY);
}

export function makePlayerTalkToNpc(game: Game, npc: Npc | null): void {
    if (!npc) {
        return;
    }
    game.player.setTarget(npc);
    game.player.follow(npc);
}

export function makePlayerOpenChest(game: Game, chest: Chest | null): void {
    if (!chest) {
        return;
    }
    game.player.setTarget(chest);
    game.player.follow(chest);
}

export function makePlayerAttackMob(game: Game, mob: Mob): void {
    game.createAttackLink(game.player, mob);
    game.client.sendAttack(mob);
}

export function makeNpcDialogue(game: Game, npc: Npc | null): void {
    if (!npc) {
        return;
    }

    const message = npc.talk();
    game.previousClickPosition = {};
    if (message) {
        game.createBubble(npc.id, message);
        game.assignBubbleTo(npc);
        game.audioManager.playSound('npc');
    } else {
        game.destroyBubble(npc.id);
        game.audioManager.playSound('npc-end');
    }
    game.tryUnlockingAchievement('SMALL_TALK');

    if (npc.kind === Types.Entities.RICK) {
        game.tryUnlockingAchievement('RICKROLLD');
    }
}
