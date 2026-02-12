import type { EntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import type { ClientWorldKernel } from '../world-kernel';
import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import Player from '../../player';
import Character from '../../character';
import Chest from '../../chest';

export type ClientInteractionIntentSystemHost = Readonly<{
    started: boolean;
    client: { sendOpen(chest: { id: EntityId }): void } | null;
    playerId: EntityId | null;
    player: Player;
    entities: Record<string, unknown>;
    kernel: ClientWorldKernel;

    tryLootAtPlayerPosition(): void;
    stopPlayerCombat(): void;
    clearClientInteractionIntent(): void;

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
        host.clearClientInteractionIntent();
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
        host.clearClientInteractionIntent();
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
            host.clearClientInteractionIntent();
            return;
        }
        if (host.player.gridX === target.gridX && host.player.gridY === target.gridY) {
            host.tryLootAtPlayerPosition();
            return;
        }
        // If pathing stopped early, cancel instead of auto-looting incidental items en route.
        if (!host.player.isMoving()) {
            host.clearClientInteractionIntent();
        }
        return;
    }

    if (intent.kind === 'attack') {
        if (target instanceof Character && target.isDead) {
            host.stopPlayerCombat();
            host.clearClientInteractionIntent();
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
            host.clearClientInteractionIntent();
            return;
        }
        if (host.player.isAdjacentNonDiagonal(target)) {
            host.player.stop();
            host.makeNpcTalk(target);
            host.player.disengage();
            host.player.idle();
            host.clearClientInteractionIntent();
            return;
        }
        if (hasTargetMoved || !host.player.isMoving()) {
            host.makePlayerTalkTo(target);
        }
        return;
    }

    if (intent.kind === 'open') {
        if (!(target instanceof Chest)) {
            host.clearClientInteractionIntent();
            return;
        }
        if (host.player.isAdjacentNonDiagonal(target)) {
            host.player.stop();
            host.client.sendOpen(target);
            host.player.disengage();
            host.player.idle();
            host.clearClientInteractionIntent();
            return;
        }
        if (hasTargetMoved || !host.player.isMoving()) {
            host.makePlayerOpenChest(target);
        }
        return;
    }
}

