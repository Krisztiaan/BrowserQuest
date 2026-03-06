import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { entityIdFromWire } from '../../shared/domain/ids';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';

test('ClientWorldKernel upserts spawn snapshots and exposes stable views', () => {
    const kernel = new ClientWorldKernel();

    const view = kernel.upsertFromSpawnSnapshot({
        id: 42,
        kind: Types.Entities.WARRIOR,
        x: 10,
        y: 11,
        extras: {
            type: 'player',
            name: 'alice',
            orientation: 2,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });

    expect(view.id).toBe(entityIdFromWire(42));
    expect(view.kind).toBe(Types.Entities.WARRIOR);
    expect(view.type).toBe('player');
    expect(view.position.x).toBe(10);
    expect(view.position.y).toBe(11);
    expect(view.authoritativeWorldPosition).toEqual(view.worldPosition);
    expect(view.presentationTargetWorldPosition).toEqual(view.worldPosition);
    expect(view.renderedWorldPosition).toEqual(view.worldPosition);
    expect(view.name).toBe('alice');
    expect(view.orientation).toBe(2);
    expect(view.armor).toBe(Types.Entities.CLOTHARMOR);
    expect(view.weapon).toBe(Types.Entities.SWORD1);
});

test('ClientWorldKernel keeps authoritative and presentation world positions separately', () => {
    const kernel = new ClientWorldKernel();
    const view = kernel.upsertFromSpawnSnapshot({
        id: 79,
        kind: Types.Entities.RAT,
        x: 2,
        y: 3,
        extras: { type: 'mob', orientation: 0 },
    });

    kernel.setClientRenderedWorldPosition(view.id, 600, 700);
    kernel.setClientPresentationTargetWorldPosition(view.id, 800, 900);
    kernel.setWorldPosition(view.id, 1000, 1100);

    const moved = kernel.getEntityView(view.id);
    expect(moved.authoritativeWorldPosition).toEqual({ x: 1000, y: 1100 });
    expect(moved.presentationTargetWorldPosition).toEqual({ x: 800, y: 900 });
    expect(moved.renderedWorldPosition).toEqual({ x: 600, y: 700 });
});

test('ClientWorldKernel updates positions only for alive entities', () => {
    const kernel = new ClientWorldKernel();
    const missing = entityIdFromWire(999);
    kernel.setPosition(missing, 1, 2);
    expect(kernel.alive.has(missing)).toBe(false);

    const view = kernel.upsertFromSpawnSnapshot({
        id: 7,
        kind: Types.Entities.RAT,
        x: 1,
        y: 1,
        extras: { type: 'mob', orientation: 0 },
    });
    kernel.setPosition(view.id, 5, 6);

    const moved = kernel.getEntityView(view.id);
    expect(moved.position.x).toBe(5);
    expect(moved.position.y).toBe(6);
});

test('ClientWorldKernel removeEntity clears component maps', () => {
    const kernel = new ClientWorldKernel();
    const view = kernel.upsertFromSpawnSnapshot({
        id: 1,
        kind: Types.Entities.RAT,
        x: 1,
        y: 2,
        extras: { type: 'mob', orientation: 3, targetId: 2 },
    });

    kernel.removeEntity(view.id);
    expect(kernel.alive.has(view.id)).toBe(false);
    expect(kernel.kind.has(view.id)).toBe(false);
    expect(kernel.position.has(view.id)).toBe(false);
    expect(kernel.orientation.has(view.id)).toBe(false);
    expect(kernel.target.has(view.id)).toBe(false);
});

test('ClientWorldKernel stores population counts as kernel state', () => {
    const kernel = new ClientWorldKernel();
    kernel.setPopulation(3, 99);
    expect(kernel.worldPlayers).toBe(3);
    expect(kernel.totalPlayers).toBe(99);
});

test('ClientWorldKernel keeps bounded remote snapshot history and interpolates delayed world position', () => {
    const kernel = new ClientWorldKernel();
    const view = kernel.upsertFromSpawnSnapshot({
        id: 77,
        kind: Types.Entities.RAT,
        x: 1,
        y: 1,
        extras: { type: 'mob', orientation: 0 },
    });

    kernel.pushClientRemoteStateSnapshot(view.id, 100, 100, 1, 1_000);
    kernel.pushClientRemoteStateSnapshot(view.id, 200, 100, 2, 1_100);
    kernel.pushClientRemoteStateSnapshot(view.id, 300, 100, 3, 1_200);
    kernel.pushClientRemoteStateSnapshot(view.id, 400, 100, 4, 1_300);
    kernel.pushClientRemoteStateSnapshot(view.id, 500, 100, 5, 1_400);

    // Bounded history keeps only the newest 4 entries.
    expect(kernel.clientRemoteStateSnapshots.get(view.id)?.length).toBe(4);

    // Render time = now - 100ms => 1250 is midway between 1200 and 1300.
    const interpolated = kernel.getClientRemoteInterpolatedWorldPosition(view.id, 1_350, 100);
    expect(interpolated).toEqual({ x: 350, y: 100 });
});

test('ClientWorldKernel clears remote snapshot history on authoritative tile position set', () => {
    const kernel = new ClientWorldKernel();
    const view = kernel.upsertFromSpawnSnapshot({
        id: 78,
        kind: Types.Entities.RAT,
        x: 1,
        y: 1,
        extras: { type: 'mob', orientation: 0 },
    });

    kernel.pushClientRemoteStateSnapshot(view.id, 100, 100, 1, 1_000);
    expect(kernel.getClientRemoteInterpolatedWorldPosition(view.id, 1_100, 100)).not.toBeNull();

    kernel.setPosition(view.id, 5, 6);
    expect(kernel.getClientRemoteInterpolatedWorldPosition(view.id, 1_100, 100)).toBeNull();
});
