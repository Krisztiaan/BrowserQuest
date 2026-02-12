import Chest from '../../chest';
import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import type { ClientWorldKernel } from '../world-kernel';

export type ClientClickIntentSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    player: { isDead: boolean; isOnPlateau: boolean; nextGridX?: number; nextGridY?: number } | null;
    map: { isColliding(x: number, y: number): boolean; isPlateau(x: number, y: number): boolean } | null;

    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
    getEntityAt(x: number, y: number): unknown;

    beginAttack(mob: Mob): void;
    beginLoot(item: Item): void;
    beginTalk(npc: Npc): void;
    beginOpenChest(chest: Chest): void;

    clearClientInteractionIntent(): void;
    makePlayerGoTo(x: number, y: number): void;
}>;

export function runClientClickIntentSystem(host: ClientClickIntentSystemHost): void {
    const intent = host.kernel.clientClickIntent;
    if (!intent) {
        return;
    }

    // Consume intent exactly once.
    host.kernel.clearClientClickIntent();

    if (!host.started || !host.player || !host.map) {
        return;
    }

    const x = intent.x;
    const y = intent.y;

    const last = host.kernel.clientClickState?.lastClickPos ?? null;
    if (last && last.x === x && last.y === y) {
        return;
    }
    host.kernel.setClientLastClickPos(x, y);

    const nextX = host.player.nextGridX ?? -1;
    const nextY = host.player.nextGridY ?? -1;

    const hoveringCollidingTile = host.map.isColliding(x, y);
    const hoveringPlateauTile = host.player.isOnPlateau ? !host.map.isPlateau(x, y) : host.map.isPlateau(x, y);

    if (
        host.isZoning() ||
        host.isZoningTile(nextX, nextY) ||
        host.player.isDead ||
        hoveringCollidingTile ||
        hoveringPlateauTile
    ) {
        return;
    }

    const entity = host.getEntityAt(x, y);
    if (entity instanceof Mob) {
        host.beginAttack(entity);
        return;
    }
    if (entity instanceof Item) {
        host.beginLoot(entity);
        return;
    }
    if (entity instanceof Npc) {
        host.beginTalk(entity);
        return;
    }
    if (entity instanceof Chest) {
        host.beginOpenChest(entity);
        return;
    }

    host.clearClientInteractionIntent();
    host.makePlayerGoTo(x, y);
}
