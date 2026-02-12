import { gridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import { clearClientInteractionIntentWithSideEffects } from './client-interaction-intent-system';

export type ClientClickIntentSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    player: { isDead: boolean; isOnPlateau: boolean; nextGridX?: number; nextGridY?: number } | null;
    map: { isColliding(x: number, y: number): boolean; isPlateau(x: number, y: number): boolean } | null;

    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
}>;

type SpatialPick = Readonly<{ id: EntityId; x: number; y: number; kind: number; isPlayer: boolean }>;

function pickEntityAt(kernel: ClientWorldKernel, x: number, y: number): SpatialPick | null {
    const ids = kernel.getClientEntityIdsAt(x, y);
    for (const id of ids) {
        const record = kernel.clientSpatialRecords.get(id);
        if (!record) {
            continue;
        }
        if (record.isPlayer) {
            continue;
        }
        return { id, x: record.gridX, y: record.gridY, kind: record.kind, isPlayer: record.isPlayer };
    }
    return null;
}

function pickItemAt(kernel: ClientWorldKernel, x: number, y: number): SpatialPick | null {
    const ids = kernel.getClientItemIdsAt(x, y);
    if (ids.length === 0) {
        return null;
    }

    let picked: SpatialPick | null = null;
    for (const id of ids) {
        const record = kernel.clientSpatialRecords.get(id);
        if (!record) {
            continue;
        }
        picked ??= { id, x: record.gridX, y: record.gridY, kind: record.kind, isPlayer: record.isPlayer };
        if (Types.isExpendableItem(record.kind)) {
            picked = { id, x: record.gridX, y: record.gridY, kind: record.kind, isPlayer: record.isPlayer };
        }
    }

    return picked;
}

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

    const kernel = host.kernel;
    const entity = pickEntityAt(kernel, x, y);
    if (entity && Types.isMob(entity.kind)) {
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.setClientInteractionIntent({
            kind: 'attack',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.x, entity.y),
        });
        return;
    }

    const item = pickItemAt(kernel, x, y);
    if (item) {
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.clearClientLootAttempt();
        host.kernel.setClientInteractionIntent({
            kind: 'loot',
            targetId: item.id,
            lastKnownTargetPos: gridPos(item.x, item.y),
        });
        host.kernel.enqueueClientCommand({ type: 'playerGoToItem', itemId: item.id });
        return;
    }

    if (entity && Types.isNpc(entity.kind)) {
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.setClientInteractionIntent({
            kind: 'talk',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.x, entity.y),
        });
        return;
    }

    if (entity && Types.isChest(entity.kind)) {
        host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
        host.kernel.setClientInteractionIntent({
            kind: 'open',
            targetId: entity.id,
            lastKnownTargetPos: gridPos(entity.x, entity.y),
        });
        return;
    }

    clearClientInteractionIntentWithSideEffects(host);
    host.kernel.enqueueClientCommand({ type: 'playerGoTo', x, y });
}
