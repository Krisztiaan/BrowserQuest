import type { EntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import type { ClientWorldKernel } from '../world-kernel';
import type { ClientCommand } from '../client-commands';
import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import type Player from '../../player';
import Character from '../../character';
import Chest from '../../chest';

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
    playerId: EntityId | null;
    player: Player;
    entities: Record<string, unknown>;
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

    const target = host.entities[intent.targetId];
    if (!target) {
        clearClientInteractionIntentWithSideEffects(host);
        return;
    }

    const targetPos = gridPos((target as { gridX: number }).gridX, (target as { gridY: number }).gridY);
    const lastPos = intent.lastKnownTargetPos;
    const hasTargetMoved = !lastPos || lastPos.x !== targetPos.x || lastPos.y !== targetPos.y;

    if (hasTargetMoved) {
        host.kernel.setClientInteractionIntent({ ...intent, lastKnownTargetPos: targetPos });
    }

    if (intent.kind === 'loot') {
        if (!(target instanceof Item)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }

        const playerX = host.player.gridX;
        const playerY = host.player.gridY;
        if (playerX === target.gridX && playerY === target.gridY) {
            const last = host.kernel.clientLootAttempt;
            if (last?.itemId === target.id && last.pos.x === playerX && last.pos.y === playerY) {
                return;
            }
            host.kernel.setClientLootAttempt(target.id, playerX, playerY);
            const cmd: ClientCommand = { type: 'tryLoot', itemId: target.id };
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
        if (target instanceof Character && target.isDead) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        if (target instanceof Mob) {
            const adjacent = isAdjacentNonDiagonal(host.player.gridX, host.player.gridY, target.gridX, target.gridY);
            if (adjacent) {
                if (host.player.target?.id !== target.id) {
                    const cmd: ClientCommand = { type: 'playerAttack', targetId: target.id };
                    host.kernel.enqueueClientCommand(cmd);
                }
                return;
            }
            const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
            if (hasTargetMoved || !isMoving) {
                const cmd: ClientCommand = { type: 'playerFollow', targetId: target.id };
                host.kernel.enqueueClientCommand(cmd);
            }
        }
        return;
    }

    if (intent.kind === 'talk') {
        if (!(target instanceof Npc)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const adjacent = isAdjacentNonDiagonal(host.player.gridX, host.player.gridY, target.gridX, target.gridY);
        if (adjacent) {
            host.kernel.enqueueClientCommand({ type: 'playerStop' });
            host.kernel.enqueueClientCommand({ type: 'npcTalk', npcId: target.id });
            host.kernel.enqueueClientCommand({ type: 'playerDisengage' });
            host.kernel.enqueueClientCommand({ type: 'playerIdle' });
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
        if (hasTargetMoved || !isMoving) {
            host.kernel.enqueueClientCommand({ type: 'playerTalkTo', npcId: target.id });
        }
        return;
    }

    if (intent.kind === 'open') {
        if (!(target instanceof Chest)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const adjacent = isAdjacentNonDiagonal(host.player.gridX, host.player.gridY, target.gridX, target.gridY);
        if (adjacent) {
            host.kernel.enqueueClientCommand({ type: 'playerStop' });
            host.kernel.enqueueClientCommand({ type: 'clientSendOpen', chestId: target.id });
            host.kernel.enqueueClientCommand({ type: 'playerDisengage' });
            host.kernel.enqueueClientCommand({ type: 'playerIdle' });
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        const isMoving = host.kernel.clientSpatialRecords.get(host.playerId)?.isMoving ?? false;
        if (hasTargetMoved || !isMoving) {
            host.kernel.enqueueClientCommand({ type: 'playerOpenChest', chestId: target.id });
        }
        return;
    }
}
