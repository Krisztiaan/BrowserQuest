import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { entityIdFromWire } from '../../shared/domain/ids';
import { gridPos } from '../../shared/domain/positions';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import { runClientKernelReplicationSyncSystem } from '../../client/ecs/systems/client-kernel-replication-sync-system';

test('kernel removeEntity leaves replication bookkeeping so sync can emit remove command', () => {
    const kernel = new ClientWorldKernel();
    const mobId = entityIdFromWire(1222);

    kernel.upsertFromSpawnSnapshot({
        id: 1222,
        kind: Types.Entities.RAT,
        x: 1,
        y: 1,
        extras: { type: 'mob', orientation: 0 },
    });

    // Simulate that the renderer has already been told about this entity.
    kernel.clientReplicationKnownAlive.add(mobId);
    kernel.clientReplicationLastPos.set(mobId, gridPos(1, 1));

    kernel.removeEntity(mobId);
    expect(kernel.alive.has(mobId)).toBe(false);
    expect(kernel.clientReplicationKnownAlive.has(mobId)).toBe(true);

    runClientKernelReplicationSyncSystem({ kernel, playerId: entityIdFromWire(1) });
    const cmds = kernel.drainClientCommands();

    expect(cmds).toContainEqual({ type: 'removeEntityById', entityId: mobId });
});
