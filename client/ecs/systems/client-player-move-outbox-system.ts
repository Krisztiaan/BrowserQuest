import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import { debugMoves } from '../../debug-flags';

export type ClientPlayerMoveOutboxSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
    player: { gridX: number; gridY: number } | null;

    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
}>;

export function runClientPlayerMoveOutboxSystem(host: ClientPlayerMoveOutboxSystemHost): void {
    if (!host.started || !host.playerId || !host.player) {
        return;
    }
    const playerId = host.playerId;
    const player = host.player;

    if (host.kernel.clientMovementSuppressed) {
        return;
    }

    const x = player.gridX;
    const y = player.gridY;

    // Zone transitions are server-authoritative for movement, but the legacy zone handshake still needs to be kicked
    // off once the local player actually arrives on a zoning tile.
    if (!host.isZoning() && host.isZoningTile(x, y)) {
        host.kernel.enqueueClientCommand({ type: 'enqueueZoningFrom', x, y });
    }

    const plan = host.kernel.clientMovePlan;
    if (!plan) {
        return;
    }

    const isMoving = host.kernel.clientSpatialRecords.get(playerId)?.isMoving ?? false;

    // Clear completed plan once the player arrives and the server has ACKed the move intent.
    const reachedTarget = x === plan.target.x && y === plan.target.y;
    if (reachedTarget && !isMoving && host.kernel.clientPendingMoveSeqAcks.length === 0) {
        host.kernel.clearClientMovePlan();
        return;
    }

    if (plan.sent) {
        return;
    }

    debugMoves('outbox:send_move_to', {
        requestedTo: plan.requestedTo,
        stopAdjacentToTarget: plan.stopAdjacentToTarget,
        target: plan.target,
        steps: plan.steps.length,
        pendingSeqAcks: host.kernel.clientPendingMoveSeqAcks.length,
    });

    host.kernel.enqueueClientCommand({
        type: 'clientSendMoveTo',
        x: plan.requestedTo.x,
        y: plan.requestedTo.y,
        stopAdjacentToTarget: plan.stopAdjacentToTarget,
    });
    host.kernel.clientMovePlan = { ...plan, sent: true };
}
