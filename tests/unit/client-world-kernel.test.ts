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
    expect(view.name).toBe('alice');
    expect(view.orientation).toBe(2);
    expect(view.armor).toBe(Types.Entities.CLOTHARMOR);
    expect(view.weapon).toBe(Types.Entities.SWORD1);
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
