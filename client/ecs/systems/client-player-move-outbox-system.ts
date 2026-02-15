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

    if (host.kernel.clientMovementSuppressed) {
        return;
    }

    const x = host.player.gridX;
    const y = host.player.gridY;

    // Zone transitions are server-authoritative for movement, but the legacy zone handshake still needs to be kicked
    // off once the local player actually arrives on a zoning tile.
    if (!host.isZoning() && host.isZoningTile(x, y)) {
        host.kernel.enqueueClientCommand({ type: 'enqueueZoningFrom', x, y });
    }

    const plan = host.kernel.clientMovePlan;
    if (!plan) {
        return;
    }

    // Clear completed plan once the player arrives and the server has applied all queued steps.
    const reachedTarget = x === plan.target.x && y === plan.target.y;
    if (reachedTarget && plan.nextStepIndex >= plan.steps.length && host.kernel.clientPendingMoveAcks.length === 0) {
        host.kernel.clearClientMovePlan();
        return;
    }

    // Keep the server move queue short so retargeting is responsive and corrections are rare.
    const MAX_QUEUED_STEPS = 2;
    const MAX_SEND_PER_FRAME = 2;

    let nextPlan = plan;
    let sent = 0;
    while (
        sent < MAX_SEND_PER_FRAME
        && host.kernel.clientPendingMoveAcks.length < MAX_QUEUED_STEPS
        && nextPlan.nextStepIndex < nextPlan.steps.length
    ) {
        const step = nextPlan.steps[nextPlan.nextStepIndex];
        if (!step) {
            break;
        }

        debugMoves('outbox:send_step', {
            step: { x: step.x, y: step.y },
            planTarget: nextPlan.target,
            queued: host.kernel.clientPendingMoveAcks.length,
            nextStepIndex: nextPlan.nextStepIndex,
            stopAdjacentToTarget: nextPlan.stopAdjacentToTarget,
        });

        host.kernel.enqueueClientPendingMoveAck(step.x, step.y);
        host.kernel.enqueueClientCommand({ type: 'clientSendMove', x: step.x, y: step.y });

        sent += 1;
        nextPlan = {
            target: nextPlan.target,
            steps: nextPlan.steps,
            nextStepIndex: nextPlan.nextStepIndex + 1,
            stopAdjacentToTarget: nextPlan.stopAdjacentToTarget,
        };
        host.kernel.clientMovePlan = nextPlan;
    }
}
