import type { EntityId } from '../../../shared/domain/ids';
import { gridPos, type GridPos } from '../../../shared/domain/positions';
import { isCardinalStep, resolveMoveBaseline } from '../../../shared/world/movement-intents';
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

function resolveAuthoritativeLocalBaseline({
    host,
    playerId,
    player,
}: {
    host: ClientPlayerMoveOutboxSystemHost;
    playerId: EntityId;
    player: { gridX: number; gridY: number };
}): GridPos {
    const authoritative = host.kernel.position.get(playerId);
    if (!authoritative) {
        return resolveMoveBaseline(
            gridPos(player.gridX, player.gridY),
            host.kernel.clientPendingMoveAcks
        );
    }
    return resolveMoveBaseline(
        gridPos(authoritative.x, authoritative.y),
        host.kernel.clientPendingMoveAcks
    );
}

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

    // Clear completed plan once the player arrives and the server has applied all queued steps.
    const reachedTarget = x === plan.target.x && y === plan.target.y;
    if (reachedTarget && plan.nextStepIndex >= plan.steps.length && host.kernel.clientPendingMoveAcks.length === 0) {
        host.kernel.clearClientMovePlan();
        return;
    }

    // Keep queue depth short for retarget responsiveness while still allowing smooth streaming motion.
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

        const baseline = resolveAuthoritativeLocalBaseline({ host, playerId, player });
        if (baseline.x === step.x && baseline.y === step.y) {
            nextPlan = {
                target: nextPlan.target,
                steps: nextPlan.steps,
                nextStepIndex: nextPlan.nextStepIndex + 1,
                stopAdjacentToTarget: nextPlan.stopAdjacentToTarget,
            };
            host.kernel.clientMovePlan = nextPlan;
            continue;
        }
        if (!isCardinalStep(baseline, step)) {
            debugMoves('outbox:pause_non_adjacent_step', {
                baseline,
                step: { x: step.x, y: step.y },
                planTarget: nextPlan.target,
                nextStepIndex: nextPlan.nextStepIndex,
            });
            break;
        }

        debugMoves('outbox:send_step', {
            step: { x: step.x, y: step.y },
            baseline,
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
