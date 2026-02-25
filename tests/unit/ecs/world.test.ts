import { expect, test } from 'bun:test';
import { gridPos } from '../../../shared/domain/positions';
import { SoaGridPosStore, SparseSetStore } from '../../../server/ecs/component-store';
import { EcsWorld } from '../../../server/ecs/world';
import { makeEntityId } from '../../../shared/domain/ids';

test('EcsWorld registers components and queries by required set', () => {
    const world = new EcsWorld();
    const Position = world.components.register('Position', new SoaGridPosStore());
    const Health = world.components.register('Health', new SparseSetStore<number>());

    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();

    world.addComponent(e1, Position, gridPos(1, 2));
    world.addComponent(e1, Health, 10);

    world.addComponent(e2, Position, gridPos(5, 6));

    world.addComponent(e3, Health, 3);

    expect(world.query([Position]).sort()).toEqual([e1, e2].sort());
    expect(world.query([Health]).sort()).toEqual([e1, e3].sort());
    expect(world.query([Position, Health]).sort()).toEqual([e1].sort());
});

test('EcsWorld destroy removes components and allows index reuse without stale-store errors', () => {
    const world = new EcsWorld();
    const Position = world.components.register('Position', new SoaGridPosStore());

    const e1 = world.createEntity();
    world.addComponent(e1, Position, gridPos(10, 20));
    world.destroyEntity(e1);

    const e2 = world.createEntity();
    // If the index was reused, the store must not consider it stale.
    world.addComponent(e2, Position, gridPos(30, 40));
    expect(world.getComponent(e2, Position)).toEqual(gridPos(30, 40));
});

test('EcsWorld.ensureEntity adopts an externally-defined EntityId', () => {
    const world = new EcsWorld();
    const Position = world.components.register('Position', new SoaGridPosStore());

    const external = makeEntityId(123, 0);
    world.ensureEntity(external);
    world.addComponent(external, Position, gridPos(1, 2));
    expect(world.getComponent(external, Position)).toEqual(gridPos(1, 2));
});

test('EcsWorld query snapshots are isolated and refresh after archetype mutation', () => {
    const world = new EcsWorld();
    const Position = world.components.register('Position', new SoaGridPosStore());

    const e1 = world.createEntity();
    const e2 = world.createEntity();
    world.addComponent(e1, Position, gridPos(1, 1));
    world.addComponent(e2, Position, gridPos(2, 2));

    const first = world.query([Position]);
    first.pop();

    const second = world.query([Position]);
    expect(second.sort()).toEqual([e1, e2].sort());

    world.removeComponent(e2, Position);
    const third = world.query([Position]);
    expect(third).toEqual([e1]);
});
