import type { EntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { resolveEngagementDecision } from '../../../shared/combat/engagement';
import Types from '../../../shared/gametypes-browser';
import type { ClientWorldKernel } from '../world-kernel';
import type { ClientCommand } from '../client-commands';
import type Player from '../../player';
import Character from '../../character';
import log from '../../platform/log';

const lastAttackIntentDiagnosticByPlayerId = new Map<EntityId, string>();

function clearAttackIntentDiagnostic(playerId: EntityId | null): void {
    if (playerId === null) {
        return;
    }
    lastAttackIntentDiagnosticByPlayerId.delete(playerId);
}

function updateAttackIntentDiagnostic({
    playerId,
    key,
    level,
    payload,
}: {
    playerId: EntityId | null;
    key: string;
    level: 'info' | 'warn';
    payload: Record<string, unknown>;
}): void {
    if (playerId === null) {
        return;
    }
    const prev = lastAttackIntentDiagnosticByPlayerId.get(playerId);
    if (prev === key) {
        return;
    }
    lastAttackIntentDiagnosticByPlayerId.set(playerId, key);
    if (level === 'warn') {
        log.warn({ scope: 'client_interaction', level, ...payload });
        return;
    }
    log.info({ scope: 'client_interaction', level, ...payload });
}

export function clearClientInteractionIntentWithSideEffects(host: { kernel: ClientWorldKernel; playerId?: EntityId | null }): void {
    const prev = host.kernel.clientInteractionIntent;
    clearAttackIntentDiagnostic(host.playerId ?? null);
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

function isAdjacentIncludingDiagonal(ax: number, ay: number, bx: number, by: number): boolean {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return dx <= 1 && dy <= 1 && dx + dy > 0;
}

function isAuthoritativeAttackAligned({
    authoritativePlayerPos,
    targetPos,
    player,
}: {
    authoritativePlayerPos: { x: number; y: number } | undefined;
    targetPos: { x: number; y: number };
    player: Player;
}): boolean {
    if (!authoritativePlayerPos) {
        return true;
    }
    const playerWeaponName = player.getWeaponName();
    const playerWeaponKind = typeof playerWeaponName === 'string' ? Types.getKindFromString(playerWeaponName) : undefined;
    return resolveEngagementDecision({
        attackerPos: gridPos(authoritativePlayerPos.x, authoritativePlayerPos.y),
        targetPos: gridPos(targetPos.x, targetPos.y),
        attackerKind: player.kind,
        attackerWeaponKind: playerWeaponKind,
    }) === 'attack';
}

function resolveAuthoritativeEngagementDecision({
    authoritativePlayerPos,
    targetPos,
    player,
}: {
    authoritativePlayerPos: { x: number; y: number } | undefined;
    targetPos: { x: number; y: number };
    player: Player;
}): 'attack' | 'pursue' | null {
    if (!authoritativePlayerPos) {
        return null;
    }
    const playerWeaponName = player.getWeaponName();
    const playerWeaponKind = typeof playerWeaponName === 'string' ? Types.getKindFromString(playerWeaponName) : undefined;
    return resolveEngagementDecision({
        attackerPos: gridPos(authoritativePlayerPos.x, authoritativePlayerPos.y),
        targetPos: gridPos(targetPos.x, targetPos.y),
        attackerKind: player.kind,
        attackerWeaponKind: playerWeaponKind,
    });
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
        const renderedEngagement = resolveEngagementDecision({
            attackerPos: gridPos(host.player.gridX, host.player.gridY),
            targetPos: gridPos(targetRecord.gridX, targetRecord.gridY),
            attackerKind: host.player.kind,
            attackerWeaponKind: playerWeaponKind,
        });
        const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
        const hasPendingMoveIntents =
            host.kernel.clientPendingMoveAcks.length > 0 || host.kernel.clientPendingMoveSeqAcks.length > 0;
        const authoritativePlayerPos = host.kernel.clientReplicationLastPos.get(host.playerId);
        const authoritativeEngagement = resolveAuthoritativeEngagementDecision({
            authoritativePlayerPos,
            targetPos,
            player: host.player,
        });
        const isAuthoritativelyAligned = isAuthoritativeAttackAligned({
            authoritativePlayerPos,
            targetPos,
            player: host.player,
        });
        const engagement = renderedEngagement === 'attack' || authoritativeEngagement === 'attack' ? 'attack' : 'pursue';
        if (engagement === 'attack') {
            // Do not send ATTACK while movement is still in flight. Server-side movement processing clears
            // Target during movement ticks, so ATTACK emitted before move acks drain can be dropped.
            if (isMoving || hasPendingMoveIntents || !isAuthoritativelyAligned) {
                updateAttackIntentDiagnostic({
                    playerId: host.playerId,
                    key: `attack_blocked:${intent.targetId}:${Number(isMoving)}:${Number(hasPendingMoveIntents)}:${Number(isAuthoritativelyAligned)}`,
                    level: !isAuthoritativelyAligned && !isMoving && !hasPendingMoveIntents ? 'warn' : 'info',
                    payload: {
                        event: 'attack.blocked',
                        targetId: intent.targetId,
                        isMoving,
                        hasPendingMoveIntents,
                        isAuthoritativelyAligned,
                        renderedEngagement,
                        authoritativeEngagement,
                        renderedPlayerPos: { x: host.player.gridX, y: host.player.gridY },
                        authoritativePlayerPos: authoritativePlayerPos ?? null,
                        targetPos,
                    },
                });
                return;
            }

            const shouldRetryAttack =
                host.player.target?.id === intent.targetId &&
                host.player.isAttacking() &&
                host.player.canAttack(host.currentTime);

            // Keep ATTACK emission idempotent and resilient: send on first engage and periodically retry while
            // staying in range, so dropped/early packets don't require a second click.
            if (host.player.target?.id !== intent.targetId || !host.player.isAttacking() || shouldRetryAttack) {
                updateAttackIntentDiagnostic({
                    playerId: host.playerId,
                    key: `attack_sent:${intent.targetId}:${Number(shouldRetryAttack)}`,
                    level: 'info',
                    payload: {
                        event: 'attack.sent',
                        targetId: intent.targetId,
                        shouldRetryAttack,
                        renderedEngagement,
                        authoritativeEngagement,
                        renderedPlayerPos: { x: host.player.gridX, y: host.player.gridY },
                        authoritativePlayerPos: authoritativePlayerPos ?? null,
                        targetPos,
                    },
                });
                const cmd: ClientCommand = { type: 'playerAttack', targetId: intent.targetId };
                host.kernel.enqueueClientCommand(cmd);
            }
            return;
        }
        if (hasPendingMoveIntents) {
            updateAttackIntentDiagnostic({
                playerId: host.playerId,
                key: `follow_pending:${intent.targetId}`,
                level: 'info',
                payload: {
                    event: 'attack.follow_deferred_pending_move',
                    targetId: intent.targetId,
                    renderedEngagement,
                    authoritativeEngagement,
                    targetPos,
                },
            });
            return;
        }
        if (hasTargetMoved || !isMoving) {
            updateAttackIntentDiagnostic({
                playerId: host.playerId,
                key: `follow_sent:${intent.targetId}:${targetPos.x}:${targetPos.y}`,
                level: 'info',
                payload: {
                    event: 'attack.follow_sent',
                    targetId: intent.targetId,
                    hasTargetMoved,
                    isMoving,
                    renderedEngagement,
                    authoritativeEngagement,
                    targetPos,
                },
            });
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
        const adjacent = isAdjacentIncludingDiagonal(
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
    const adjacent = isAdjacentIncludingDiagonal(
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
