import type { EntityId } from '../../../shared/domain/ids';
import type { WorldPos } from '../../../shared/world/worldpos';
import type { ClientWorldKernel, KernelEntityView } from '../world-kernel';
import type { ClientCommand } from '../client-commands';

export type ClientKernelReplicationSyncSystemHost = {
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
    currentTime?: number;
};

const REMOTE_INTERPOLATION_DELAY_MS = 100;

function isSameWorldPos(a: WorldPos | undefined, b: WorldPos): boolean {
    if (!a) {
        return false;
    }
    return a.x === b.x && a.y === b.y;
}

function addSpawnedEntity(host: ClientKernelReplicationSyncSystemHost, view: KernelEntityView): void {
    const cmd: ClientCommand = { type: 'spawnEntityFromKernel', entityId: view.id };
    host.kernel.enqueueClientCommand(cmd);
    host.kernel.clientReplicationKnownAlive.add(view.id);
    host.kernel.clientReplicationLastPos.set(view.id, view.position);
    host.kernel.clientReplicationLastWorldPos.set(view.id, view.presentationTargetWorldPosition);
    if (view.targetId !== undefined) {
        host.kernel.clientReplicationLastTarget.set(view.id, view.targetId);
    }
}

function isEntityInActiveMap(kernel: ClientWorldKernel, id: EntityId, localPlayerId: EntityId | null): boolean {
    if (localPlayerId !== null && id === localPlayerId) {
        return true;
    }
    const activeMapId = kernel.activeMapId;
    if (!activeMapId) {
        return true;
    }
    const mapId = kernel.getEntityMapId(id);
    if (!mapId) {
        return true;
    }
    return mapId === activeMapId;
}

export function runClientKernelReplicationSyncSystem(host: ClientKernelReplicationSyncSystemHost): void {
    const kernel = host.kernel;
    const localPlayerIsDead = host.playerId !== null && kernel.clientLocalPlayerDead;
    const nowMs = typeof host.currentTime === 'number' ? host.currentTime : Date.now();

    // Removed entities: kernel no longer considers them alive.
    for (const id of Array.from(kernel.clientReplicationKnownAlive)) {
        if (kernel.alive.has(id) && isEntityInActiveMap(kernel, id, host.playerId)) {
            continue;
        }
        kernel.enqueueClientCommand({ type: 'removeEntityById', entityId: id });
        kernel.clientReplicationKnownAlive.delete(id);
        kernel.clientReplicationLastPos.delete(id);
        kernel.clientReplicationLastWorldPos.delete(id);
        kernel.clientReplicationLastTarget.delete(id);
    }

    // New entities: kernel has them alive but the client has not yet synced them.
    for (const id of kernel.alive) {
        if (kernel.clientReplicationKnownAlive.has(id)) {
            continue;
        }
        if (!isEntityInActiveMap(kernel, id, host.playerId)) {
            continue;
        }

        const view = kernel.getEntityView(id);
        if (view.type === 'player' && host.playerId === null) {
            continue;
        }
        addSpawnedEntity(host, view);
    }

    // Movement: drive entities toward their authoritative kernel world positions.
    for (const [id, worldPos] of kernel.worldPosition.entries()) {
        if (!kernel.clientReplicationKnownAlive.has(id)) {
            continue;
        }
        if (!isEntityInActiveMap(kernel, id, host.playerId)) {
            continue;
        }

        const isLocalPlayer = host.playerId !== null && id === host.playerId;
        let targetWorldPos = worldPos;

        if (!isLocalPlayer) {
            const interpolated = kernel.getClientRemoteInterpolatedWorldPosition(id, nowMs, REMOTE_INTERPOLATION_DELAY_MS);
            if (interpolated) {
                targetWorldPos = interpolated;
            }
        }

        if (isSameWorldPos(kernel.getClientPresentationTargetWorldPosition(id) ?? undefined, targetWorldPos)) {
            continue;
        }

        const kind = kernel.kind.get(id);
        const pos = kernel.position.get(id);
        if (!pos) {
            continue;
        }

        // Prediction: if the local player is currently predicting, tolerate small drift so we don't fight the
        // local step interpolation; large drift triggers a teleport snap.
        const hasPredictionPlan =
            kernel.clientMovementNetcodeMode === 'predictive'
            && isLocalPlayer
            && (kernel.clientMovePlan !== null || kernel.clientMoveInputKeysMask !== 0);
        if (hasPredictionPlan) {
            const record = kernel.clientSpatialRecords.get(id);
            if (record) {
                const drift = Math.abs(record.gridX - pos.x) + Math.abs(record.gridY - pos.y);
                if (drift <= 1) {
                    kernel.clientReplicationLastWorldPos.set(id, worldPos);
                    kernel.clientReplicationLastPos.set(id, pos);
                    continue;
                }
                kernel.enqueueClientCommand({ type: 'teleportEntity', entityId: id, x: pos.x, y: pos.y });
                kernel.setClientPresentationTargetWorldPosition(id, worldPos.x, worldPos.y);
                kernel.setClientRenderedWorldPosition(id, worldPos.x, worldPos.y);
                kernel.clientReplicationLastWorldPos.set(id, worldPos);
                kernel.clientReplicationLastPos.set(id, pos);
                continue;
            }
        }

        // Apply world position to render entities; remote entities are fed from the interpolation timeline while
        // local player remains prediction-aware.
        if (kind !== undefined) {
            // Items/chests are static, but keeping the same command path simplifies the client state model.
            kernel.setClientPresentationTargetWorldPosition(id, targetWorldPos.x, targetWorldPos.y);
            kernel.enqueueClientCommand({
                type: 'setEntityWorldPosition',
                entityId: id,
                worldX: targetWorldPos.x,
                worldY: targetWorldPos.y,
            });
        }

        kernel.clientReplicationLastWorldPos.set(id, targetWorldPos);
        kernel.clientReplicationLastPos.set(id, pos);
    }

    // Target updates: maintain attack links based on kernel target map changes.
    for (const [attackerId, targetId] of kernel.target.entries()) {
        const targetIsLocalPlayer = host.playerId !== null && targetId === host.playerId;
        if (targetIsLocalPlayer && localPlayerIsDead) {
            continue;
        }
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
        if (lastTargetIsLocalPlayer && localPlayerIsDead) {
            if (host.playerId !== null && attackerId === host.playerId) {
                kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
            } else {
                kernel.enqueueClientCommand({ type: 'characterClearTarget', entityId: attackerId });
            }
            kernel.clientReplicationLastTarget.delete(attackerId);
            kernel.target.delete(attackerId);
            continue;
        }
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
