import Chest from '../../chest';
import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import type { EntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import type { ClientWorldKernel } from '../world-kernel';
import { clearClientInteractionIntentWithSideEffects } from './client-interaction-intent-system';

export type ClientClickIntentSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    player: { isDead: boolean; isOnPlateau: boolean; nextGridX?: number; nextGridY?: number } | null;
    map: { isColliding(x: number, y: number): boolean; isPlateau(x: number, y: number): boolean } | null;

    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
    getEntityAt(x: number, y: number): unknown;

    makePlayerGoToItem(item: Item | null): void;
    stopPlayerCombat(): void;

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
        host.stopPlayerCombat();
        host.kernel.setClientInteractionIntent({
            kind: 'attack',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.gridX, entity.gridY),
        });
        return;
    }
    if (entity instanceof Item) {
        host.stopPlayerCombat();
        host.kernel.clearClientLootAttempt();
        host.kernel.setClientInteractionIntent({
            kind: 'loot',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.gridX, entity.gridY),
        });
        host.makePlayerGoToItem(entity);
        return;
    }
    if (entity instanceof Npc) {
        host.stopPlayerCombat();
        host.kernel.setClientInteractionIntent({
            kind: 'talk',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.gridX, entity.gridY),
        });
        return;
    }
    if (entity instanceof Chest) {
        host.stopPlayerCombat();
        host.kernel.setClientInteractionIntent({
            kind: 'open',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.gridX, entity.gridY),
        });
        return;
    }

    clearClientInteractionIntentWithSideEffects(host);
    host.makePlayerGoTo(x, y);
}
