import type { EntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { resolveEngagementDecision } from '../../../shared/combat/engagement';
import Types from '../../../shared/gametypes-browser';
import type { ClientWorldKernel } from '../world-kernel';
import type { ClientCommand } from '../client-commands';
import type Player from '../../player';
import Character from '../../character';

export function clearClientInteractionIntentWithSideEffects(host: { kernel: ClientWorldKernel }): void {
    const prev = host.kernel.clientInteractionIntent;
    if (prev?.kind === 'attack') {
        const cmd: ClientCommand = { type: 'stopPlayerCombat' };
        host.kernel.enqueueClientCommand(cmd);
    }
    if (prev?.kind === 'loot') {
        host.kernel.clearClientLootAttempt();
    }
    host.kernel.clearClientInteractionIntent();
}

export type ClientInteractionIntentSystemHost = Readonly<{
    started: boolean;
    currentTime: number;
    playerId: EntityId | null;
    player: Player;
    entities: Record<string, Character | Player | object | null | undefined>;
    kernel: ClientWorldKernel;
}>;

function isAdjacentNonDiagonal(ax: number, ay: number, bx: number, by: number): boolean {
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function runClientInteractionIntentSystem(host: ClientInteractionIntentSystemHost): void {
    if (!host.started || !host.playerId) {
        return;
    }
    if (host.player.isDead) {
        clearClientInteractionIntentWithSideEffects(host);
        return;
    }

    const intent = host.kernel.clientInteractionIntent;
    if (!intent) {
        return;
    }

    const targetRecord = host.kernel.clientSpatialRecords.get(intent.targetId);
    if (!targetRecord) {
        clearClientInteractionIntentWithSideEffects(host);
        return;
    }

    const targetPos = gridPos(targetRecord.gridX, targetRecord.gridY);
    const lastPos = intent.lastKnownTargetPos;
    const hasTargetMoved = !lastPos || lastPos.x !== targetPos.x || lastPos.y !== targetPos.y;

    if (hasTargetMoved) {
        host.kernel.setClientInteractionIntent({ ...intent, lastKnownTargetPos: targetPos });
    }

    if (intent.kind === 'loot') {
        if (!Types.isItem(targetRecord.kind)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }

        const playerX = host.player.gridX;
        const playerY = host.player.gridY;
        if (playerX === targetRecord.gridX && playerY === targetRecord.gridY) {
            const last = host.kernel.clientLootAttempt;
            if (last?.itemId === intent.targetId && last.pos.x === playerX && last.pos.y === playerY) {
                return;
            }
            host.kernel.setClientLootAttempt(intent.targetId, playerX, playerY);
            const cmd: ClientCommand = { type: 'tryLoot', itemId: intent.targetId };
            host.kernel.enqueueClientCommand(cmd);
            return;
        }

        // If pathing stopped early, cancel instead of auto-looting incidental items en route.
        const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
        if (!isMoving) {
            clearClientInteractionIntentWithSideEffects(host);
        }
        return;
    }

    if (intent.kind === 'attack') {
        if (!Types.isMob(targetRecord.kind)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const targetEntity = host.entities[String(intent.targetId)];
        if (targetEntity instanceof Character && targetEntity.isDead) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const playerWeaponName = host.player.getWeaponName();
        const playerWeaponKind = typeof playerWeaponName === 'string' ? Types.getKindFromString(playerWeaponName) : undefined;
        const engagement = resolveEngagementDecision({
            attackerPos: gridPos(host.player.gridX, host.player.gridY),
            targetPos: gridPos(targetRecord.gridX, targetRecord.gridY),
            attackerKind: host.player.kind,
            attackerWeaponKind: playerWeaponKind,
        });
        const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
        const hasPendingMoveIntents =
            host.kernel.clientPendingMoveAcks.length > 0 || host.kernel.clientPendingMoveSeqAcks.length > 0;
        const authoritativePlayerPos = host.kernel.clientReplicationLastPos.get(host.playerId);
        const isAuthoritativelyAligned =
            !authoritativePlayerPos ||
            (authoritativePlayerPos.x === host.player.gridX && authoritativePlayerPos.y === host.player.gridY);
        if (engagement === 'attack') {
            // Do not send ATTACK while movement is still in flight. Server-side movement processing clears
            // Target during movement ticks, so ATTACK emitted before move acks drain can be dropped.
            if (isMoving || hasPendingMoveIntents || !isAuthoritativelyAligned) {
                return;
            }

            const shouldRetryAttack =
                host.player.target?.id === intent.targetId &&
                host.player.isAttacking() &&
                host.player.canAttack(host.currentTime);

            // Keep ATTACK emission idempotent and resilient: send on first engage and periodically retry while
            // staying in range, so dropped/early packets don't require a second click.
            if (host.player.target?.id !== intent.targetId || !host.player.isAttacking() || shouldRetryAttack) {
                const cmd: ClientCommand = { type: 'playerAttack', targetId: intent.targetId };
                host.kernel.enqueueClientCommand(cmd);
            }
            return;
        }
        if (hasPendingMoveIntents) {
            return;
        }
        if (hasTargetMoved || !isMoving) {
            const cmd: ClientCommand = { type: 'playerFollow', targetId: intent.targetId };
            host.kernel.enqueueClientCommand(cmd);
        }
        return;
    }

    if (intent.kind === 'talk') {
        if (!Types.isNpc(targetRecord.kind)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const adjacent = isAdjacentNonDiagonal(
            host.player.gridX,
            host.player.gridY,
            targetRecord.gridX,
            targetRecord.gridY
        );
        if (adjacent) {
            host.kernel.enqueueClientCommand({ type: 'playerStop' });
            host.kernel.enqueueClientCommand({ type: 'npcTalk', npcId: intent.targetId });
            host.kernel.enqueueClientCommand({ type: 'playerDisengage' });
            host.kernel.enqueueClientCommand({ type: 'playerIdle' });
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
        if (hasTargetMoved || !isMoving) {
            host.kernel.enqueueClientCommand({ type: 'playerTalkTo', npcId: intent.targetId });
        }
        return;
    }

    // Remaining kind is 'open'.
    if (!Types.isChest(targetRecord.kind)) {
        clearClientInteractionIntentWithSideEffects(host);
        return;
    }
    const adjacent = isAdjacentNonDiagonal(
        host.player.gridX,
        host.player.gridY,
        targetRecord.gridX,
        targetRecord.gridY
    );
    if (adjacent) {
        host.kernel.enqueueClientCommand({ type: 'playerStop' });
        host.kernel.enqueueClientCommand({ type: 'clientSendOpen', chestId: intent.targetId });
        host.kernel.enqueueClientCommand({ type: 'playerDisengage' });
        host.kernel.enqueueClientCommand({ type: 'playerIdle' });
        clearClientInteractionIntentWithSideEffects(host);
        return;
    }
    const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
    if (hasTargetMoved || !isMoving) {
        host.kernel.enqueueClientCommand({ type: 'playerOpenChest', chestId: intent.targetId });
    }
    return;
}
