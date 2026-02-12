import type { EntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import type { ClientWorldKernel } from '../world-kernel';
import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import Player from '../../player';
import Character from '../../character';
import Chest from '../../chest';
import Exceptions from '../../exceptions';

export function clearClientInteractionIntentWithSideEffects(host: {
    kernel: ClientWorldKernel;
    stopPlayerCombat(): void;
}): void {
    const prev = host.kernel.clientInteractionIntent;
    if (prev?.kind === 'attack') {
        host.stopPlayerCombat();
    }
    if (prev?.kind === 'loot') {
        host.kernel.clearClientLootAttempt();
    }
    host.kernel.clearClientInteractionIntent();
}

export type ClientInteractionIntentSystemHost = Readonly<{
    started: boolean;
    client: { sendOpen(chest: { id: EntityId }): void; sendLoot(item: { id: EntityId }): void } | null;
    playerId: EntityId | null;
    player: Player;
    entities: Record<string, unknown>;
    kernel: ClientWorldKernel;
    emit(eventName: 'notification', message: string): void;

    stopPlayerCombat(): void;

    makePlayerAttack(mob: Mob): void;
    makePlayerTalkTo(npc: Npc): void;
    makePlayerOpenChest(chest: Chest): void;
    makeNpcTalk(npc: Npc): void;
}>;

export function runClientInteractionIntentSystem(host: ClientInteractionIntentSystemHost): void {
    if (!host.started || !host.client || !host.playerId) {
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
        if (intent.kind === 'attack') {
            host.stopPlayerCombat();
        }
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
        if (host.player.gridX === target.gridX && host.player.gridY === target.gridY) {
            const x = host.player.gridX;
            const y = host.player.gridY;

            const last = host.kernel.clientLootAttempt;
            if (last && last.itemId === target.id && last.pos.x === x && last.pos.y === y) {
                return;
            }
            host.kernel.setClientLootAttempt(target.id, x, y);

            try {
                host.player.loot({
                    id: target.id,
                    kind: target.kind,
                    type: target.type,
                    onLoot: () => {},
                });
            } catch (err) {
                if (err instanceof Exceptions.LootException) {
                    host.emit('notification', err.message);
                    clearClientInteractionIntentWithSideEffects(host);
                    return;
                }
                throw err;
            }

            host.client.sendLoot(target);
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        // If pathing stopped early, cancel instead of auto-looting incidental items en route.
        if (!host.player.isMoving()) {
            clearClientInteractionIntentWithSideEffects(host);
        }
        return;
    }

    if (intent.kind === 'attack') {
        if (target instanceof Character && target.isDead) {
            host.stopPlayerCombat();
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        if (target instanceof Mob) {
            if (host.player.isAdjacentNonDiagonal(target)) {
                if (!host.player.hasTarget() || host.player.target?.id !== target.id) {
                    host.makePlayerAttack(target);
                }
                return;
            }
            if (hasTargetMoved || !host.player.isMoving()) {
                host.player.follow(target);
            }
        }
        return;
    }

    if (intent.kind === 'talk') {
        if (!(target instanceof Npc)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        if (host.player.isAdjacentNonDiagonal(target)) {
            host.player.stop();
            host.makeNpcTalk(target);
            host.player.disengage();
            host.player.idle();
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        if (hasTargetMoved || !host.player.isMoving()) {
            host.makePlayerTalkTo(target);
        }
        return;
    }

    if (intent.kind === 'open') {
        if (!(target instanceof Chest)) {
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        if (host.player.isAdjacentNonDiagonal(target)) {
            host.player.stop();
            host.client.sendOpen(target);
            host.player.disengage();
            host.player.idle();
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
        if (hasTargetMoved || !host.player.isMoving()) {
            host.makePlayerOpenChest(target);
        }
        return;
    }
}
