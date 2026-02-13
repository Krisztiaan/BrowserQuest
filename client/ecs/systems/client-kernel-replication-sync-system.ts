import type { EntityId } from '../../../shared/domain/ids';
import type { GridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import type { ClientWorldKernel, KernelEntityView } from '../world-kernel';
import type { ClientCommand } from '../client-commands';

export type ClientKernelReplicationSyncSystemHost = {
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
};

function isSamePos(a: GridPos | undefined, b: GridPos): boolean {
    return a?.x === b.x && a.y === b.y;
}

function addSpawnedEntity(host: ClientKernelReplicationSyncSystemHost, view: KernelEntityView): void {
    const cmd: ClientCommand = { type: 'spawnEntityFromKernel', entityId: view.id };
    host.kernel.enqueueClientCommand(cmd);
    host.kernel.clientReplicationKnownAlive.add(view.id);
    host.kernel.clientReplicationLastPos.set(view.id, view.position);
    if (view.targetId !== undefined) {
        host.kernel.clientReplicationLastTarget.set(view.id, view.targetId);
    }
}

export function runClientKernelReplicationSyncSystem(host: ClientKernelReplicationSyncSystemHost): void {
    const kernel = host.kernel;

    // Removed entities: kernel no longer considers them alive.
    for (const id of Array.from(kernel.clientReplicationKnownAlive)) {
        if (kernel.alive.has(id)) {
            continue;
        }
        kernel.enqueueClientCommand({ type: 'removeEntityById', entityId: id });
        kernel.clientReplicationKnownAlive.delete(id);
        kernel.clientReplicationLastPos.delete(id);
        kernel.clientReplicationLastTarget.delete(id);
    }

    // New entities: kernel has them alive but the client has not yet synced them.
    for (const id of kernel.alive) {
        if (kernel.clientReplicationKnownAlive.has(id)) {
            continue;
        }

        const view = kernel.getEntityView(id);
        if (view.type === 'player' && host.playerId === null) {
            continue;
        }
        addSpawnedEntity(host, view);
    }

    // Movement: drive characters toward their authoritative kernel positions (once per destination).
    for (const [id, pos] of kernel.position.entries()) {
        if (!kernel.clientReplicationKnownAlive.has(id)) {
            continue;
        }
        if (isSamePos(kernel.clientReplicationLastPos.get(id), pos)) {
            continue;
        }

        const kind = kernel.kind.get(id);
        // Only characters path; items/chests are static.
        if (kind !== undefined && !Types.isItem(kind) && !Types.isChest(kind)) {
            kernel.enqueueClientCommand({ type: 'characterGoTo', entityId: id, x: pos.x, y: pos.y });
        }
        kernel.clientReplicationLastPos.set(id, pos);
    }

    // Target updates: maintain attack links based on kernel target map changes.
    for (const [attackerId, targetId] of kernel.target.entries()) {
        const targetIsLocalPlayer = host.playerId !== null && targetId === host.playerId;
        if (!kernel.clientReplicationKnownAlive.has(attackerId) || (!targetIsLocalPlayer && !kernel.clientReplicationKnownAlive.has(targetId))) {
            continue;
        }
        const lastTargetId = kernel.clientReplicationLastTarget.get(attackerId);
        if (lastTargetId === targetId) {
            continue;
        }

        kernel.enqueueClientCommand({ type: 'createAttackLink', attackerId, targetId });
        kernel.clientReplicationLastTarget.set(attackerId, targetId);
    }

    // Target removals: if an attacker previously had a target but no longer does, clear the combat link.
    for (const [attackerId, lastTargetId] of kernel.clientReplicationLastTarget.entries()) {
        if (!kernel.clientReplicationKnownAlive.has(attackerId)) {
            continue;
        }
        const lastTargetIsLocalPlayer = host.playerId !== null && lastTargetId === host.playerId;
        if (!lastTargetIsLocalPlayer && !kernel.clientReplicationKnownAlive.has(lastTargetId)) {
            // Target despawned; treat as a removal.
            if (host.playerId !== null && attackerId === host.playerId) {
                kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
            } else {
                kernel.enqueueClientCommand({ type: 'characterClearTarget', entityId: attackerId });
            }
            kernel.clientReplicationLastTarget.delete(attackerId);
            continue;
        }

        const current = kernel.target.get(attackerId);
        if (current === undefined) {
            if (host.playerId !== null && attackerId === host.playerId) {
                kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
            } else {
                kernel.enqueueClientCommand({ type: 'characterClearTarget', entityId: attackerId });
            }
            kernel.clientReplicationLastTarget.delete(attackerId);
        }
    }
}
