import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { entityIdFromWire } from '../../shared/domain/ids';
import { gridPos } from '../../shared/domain/positions';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import { runClientKernelReplicationSyncSystem } from '../../client/ecs/systems/client-kernel-replication-sync-system';
import { tileToWorldPosCenter } from '../../shared/world/worldpos';

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

test('dead local player clears stale mob attack links from replication sync', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(1);
    const mobId = entityIdFromWire(1223);

    kernel.upsertFromSpawnSnapshot({
        id: 1,
        kind: Types.Entities.WARRIOR,
        x: 10,
        y: 10,
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });
    kernel.upsertFromSpawnSnapshot({
        id: 1223,
        kind: Types.Entities.RAT,
        x: 11,
        y: 10,
        extras: { type: 'mob', orientation: Types.Orientations.LEFT, targetId: 1 },
    });

    kernel.clientReplicationKnownAlive.add(playerId);
    kernel.clientReplicationKnownAlive.add(mobId);
    kernel.clientReplicationLastPos.set(playerId, gridPos(10, 10));
    kernel.clientReplicationLastPos.set(mobId, gridPos(11, 10));
    kernel.target.set(mobId, playerId);
    kernel.clientReplicationLastTarget.set(mobId, playerId);
    kernel.clientLocalPlayerDead = true;

    runClientKernelReplicationSyncSystem({ kernel, playerId });
    const cmds = kernel.drainClientCommands();

    expect(cmds).toContainEqual({ type: 'characterClearTarget', entityId: mobId });
    expect(kernel.clientReplicationLastTarget.has(mobId)).toBe(false);
    expect(kernel.target.has(mobId)).toBe(false);
});

test('replication sync removes entities outside the active map scope', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(10);
    const mobId = entityIdFromWire(11);

    kernel.upsertFromSpawnSnapshot({
        id: 10,
        kind: Types.Entities.WARRIOR,
        x: 1,
        y: 1,
        mapId: 'world',
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });
    kernel.upsertFromSpawnSnapshot({
        id: 11,
        kind: Types.Entities.RAT,
        x: 2,
        y: 2,
        mapId: 'house',
        extras: { type: 'mob', orientation: Types.Orientations.DOWN },
    });

    kernel.clientReplicationKnownAlive.add(playerId);
    kernel.clientReplicationKnownAlive.add(mobId);
    kernel.clientReplicationLastPos.set(playerId, gridPos(1, 1));
    kernel.clientReplicationLastPos.set(mobId, gridPos(2, 2));
    kernel.setActiveMapId('world');

    runClientKernelReplicationSyncSystem({ kernel, playerId });
    const cmds = kernel.drainClientCommands();

    expect(cmds).toContainEqual({ type: 'removeEntityById', entityId: mobId });
    expect(cmds).not.toContainEqual({ type: 'removeEntityById', entityId: playerId });
    expect(kernel.clientReplicationKnownAlive.has(mobId)).toBe(false);
});

test('replication sync renders remote entities from delayed interpolation snapshots', () => {
    const kernel = new ClientWorldKernel();
    const mobId = entityIdFromWire(55);

    kernel.upsertFromSpawnSnapshot({
        id: 55,
        kind: Types.Entities.RAT,
        x: 1,
        y: 1,
        extras: { type: 'mob', orientation: 0 },
    });

    kernel.clientReplicationKnownAlive.add(mobId);
    kernel.clientReplicationLastPos.set(mobId, gridPos(1, 1));
    kernel.clientReplicationLastWorldPos.set(mobId, { x: 100, y: 100 });

    kernel.setWorldPosition(mobId, 200, 100);
    kernel.pushClientRemoteStateSnapshot(mobId, 100, 100, 10, 1_000);
    kernel.pushClientRemoteStateSnapshot(mobId, 200, 100, 11, 1_100);

    runClientKernelReplicationSyncSystem({ kernel, playerId: null, currentTime: 1_150 });
    const cmds = kernel.drainClientCommands();

    expect(cmds).toContainEqual({
        type: 'setEntityWorldPosition',
        entityId: mobId,
        worldX: 166,
        worldY: 100,
        visualDivergenceClass: 'ordinary',
    });
    expect(kernel.clientReplicationLastWorldPos.get(mobId)).toEqual({ x: 166, y: 100 });
});

test('replication sync snap-renders remote discontinuities instead of smoothing teleports', () => {
    const kernel = new ClientWorldKernel();
    const mobId = entityIdFromWire(56);

    kernel.upsertFromSpawnSnapshot({
        id: 56,
        kind: Types.Entities.RAT,
        x: 1,
        y: 1,
        extras: { type: 'mob', orientation: 0 },
    });

    kernel.clientReplicationKnownAlive.add(mobId);
    kernel.clientReplicationLastPos.set(mobId, gridPos(1, 1));
    kernel.clientReplicationLastWorldPos.set(mobId, { x: 100, y: 100 });
    kernel.setClientPresentationTargetWorldPosition(mobId, 100, 100);

    kernel.setWorldPosition(mobId, 10_000, 100);

    runClientKernelReplicationSyncSystem({ kernel, playerId: null, currentTime: 1_150 });
    const cmds = kernel.drainClientCommands();

    expect(cmds).toContainEqual({
        type: 'setEntityWorldPosition',
        entityId: mobId,
        worldX: 10_000,
        worldY: 100,
        visualDivergenceClass: 'remote_discontinuity',
    });
});

test('lockstep mode applies authoritative local-player world updates even when move input is active', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(1);

    kernel.upsertFromSpawnSnapshot({
        id: 1,
        kind: Types.Entities.WARRIOR,
        x: 10,
        y: 10,
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });

    kernel.clientReplicationKnownAlive.add(playerId);
    kernel.clientReplicationLastPos.set(playerId, gridPos(10, 10));
    const authoritative = tileToWorldPosCenter(10, 10);
    kernel.clientReplicationLastWorldPos.set(playerId, authoritative);
    kernel.clientMoveInputKeysMask = 1;
    kernel.setClientMovementNetcodeMode('lockstep');
    kernel.setWorldPosition(playerId, 132, 100);

    runClientKernelReplicationSyncSystem({ kernel, playerId, currentTime: 1_000 });
    const cmds = kernel.drainClientCommands();

    expect(cmds).toContainEqual({
        type: 'setEntityWorldPosition',
        entityId: playerId,
        worldX: 132,
        worldY: 100,
        visualDivergenceClass: 'ordinary',
    });
});

test('predictive local-player diagonal drift does not trigger teleport correction in replication sync', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(77);

    kernel.upsertFromSpawnSnapshot({
        id: 77,
        kind: Types.Entities.WARRIOR,
        x: 10,
        y: 10,
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });

    kernel.clientReplicationKnownAlive.add(playerId);
    kernel.clientReplicationLastPos.set(playerId, gridPos(10, 10));
    const authoritative = tileToWorldPosCenter(10, 10);
    kernel.clientReplicationLastWorldPos.set(playerId, authoritative);
    kernel.clientSpatialRecords.set(playerId, {
        gridX: 11,
        gridY: 11,
        nextGridX: 11,
        nextGridY: 11,
        isMoving: true,
        isDead: false,
        kind: Types.Entities.WARRIOR,
        isPlayer: true,
    });
    kernel.clientMovePlan = {
        requestedTo: gridPos(12, 12),
        target: gridPos(12, 12),
        steps: [gridPos(11, 11), gridPos(12, 12)],
        stopAdjacentToTarget: false,
        sent: true,
    };
    kernel.setWorldPosition(playerId, authoritative.x, authoritative.y);

    runClientKernelReplicationSyncSystem({ kernel, playerId, currentTime: 1_000 });
    const cmds = kernel.drainClientCommands();

    expect(cmds.some((cmd) => cmd.type === 'teleportEntity' && cmd.entityId === playerId)).toBe(false);
    expect(kernel.clientReplicationLastPos.get(playerId)).toEqual(gridPos(10, 10));
});

test('predictive local move-to drift larger than one tile does not emit a replication visual correction', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(78);

    kernel.upsertFromSpawnSnapshot({
        id: 78,
        kind: Types.Entities.WARRIOR,
        x: 10,
        y: 10,
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });

    kernel.clientReplicationKnownAlive.add(playerId);
    kernel.clientReplicationLastPos.set(playerId, gridPos(10, 10));
    const authoritative = tileToWorldPosCenter(10, 10);
    kernel.clientReplicationLastWorldPos.set(playerId, authoritative);
    kernel.setClientPresentationTargetWorldPosition(playerId, tileToWorldPosCenter(13, 10).x, tileToWorldPosCenter(13, 10).y);
    kernel.clientSpatialRecords.set(playerId, {
        gridX: 13,
        gridY: 10,
        nextGridX: 14,
        nextGridY: 10,
        isMoving: true,
        isDead: false,
        kind: Types.Entities.WARRIOR,
        isPlayer: true,
    });
    kernel.clientMovePlan = {
        requestedTo: gridPos(15, 10),
        target: gridPos(15, 10),
        steps: [gridPos(11, 10), gridPos(12, 10), gridPos(13, 10), gridPos(14, 10), gridPos(15, 10)],
        stopAdjacentToTarget: false,
        sent: true,
    };
    kernel.setWorldPosition(playerId, tileToWorldPosCenter(11, 10).x, tileToWorldPosCenter(11, 10).y);

    runClientKernelReplicationSyncSystem({ kernel, playerId, currentTime: 1_000 });
    const cmds = kernel.drainClientCommands();

    expect(cmds.some((cmd) => cmd.type === 'teleportEntity' && cmd.entityId === playerId)).toBe(false);
    expect(cmds.some((cmd) => cmd.type === 'setEntityWorldPosition' && cmd.entityId === playerId)).toBe(false);
    expect(kernel.clientReplicationLastWorldPos.get(playerId)).toEqual(tileToWorldPosCenter(11, 10));
    expect(kernel.clientReplicationLastPos.get(playerId)).toEqual(gridPos(11, 10));

    runClientKernelReplicationSyncSystem({ kernel, playerId, currentTime: 1_016 });
    expect(kernel.drainClientCommands()).toEqual([]);
});

test('predictive held-input drift larger than one tile does not emit a replication visual correction', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(79);

    kernel.upsertFromSpawnSnapshot({
        id: 79,
        kind: Types.Entities.WARRIOR,
        x: 10,
        y: 10,
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });

    kernel.clientReplicationKnownAlive.add(playerId);
    kernel.clientReplicationLastPos.set(playerId, gridPos(10, 10));
    kernel.clientReplicationLastWorldPos.set(playerId, tileToWorldPosCenter(10, 10));
    kernel.setClientPresentationTargetWorldPosition(playerId, tileToWorldPosCenter(13, 10).x, tileToWorldPosCenter(13, 10).y);
    kernel.clientSpatialRecords.set(playerId, {
        gridX: 13,
        gridY: 10,
        nextGridX: 14,
        nextGridY: 10,
        isMoving: true,
        isDead: false,
        kind: Types.Entities.WARRIOR,
        isPlayer: true,
    });
    kernel.clientMoveInputKeysMask = 1;
    kernel.setWorldPosition(playerId, tileToWorldPosCenter(11, 10).x, tileToWorldPosCenter(11, 10).y);

    runClientKernelReplicationSyncSystem({ kernel, playerId, currentTime: 1_000 });
    const cmds = kernel.drainClientCommands();

    expect(cmds.some((cmd) => cmd.type === 'teleportEntity' && cmd.entityId === playerId)).toBe(false);
    expect(cmds.some((cmd) => cmd.type === 'setEntityWorldPosition' && cmd.entityId === playerId)).toBe(false);
    expect(kernel.clientReplicationLastWorldPos.get(playerId)).toEqual(tileToWorldPosCenter(11, 10));
    expect(kernel.clientReplicationLastPos.get(playerId)).toEqual(gridPos(11, 10));

    runClientKernelReplicationSyncSystem({ kernel, playerId, currentTime: 1_016 });
    expect(kernel.drainClientCommands()).toEqual([]);
});
