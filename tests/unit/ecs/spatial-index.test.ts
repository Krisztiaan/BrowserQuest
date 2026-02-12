import { expect, test } from 'bun:test';
import { makeEntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { SoaGridPosStore } from '../../../server/ecs/component-store';
import { InterestTracker } from '../../../server/ecs/interest-tracker';
import { createSpatialIndexRebuildSystem } from '../../../server/ecs/spatial-systems';
import { SpatialIndex } from '../../../server/ecs/spatial-index';
import { SPATIAL_INDEX_RESOURCE } from '../../../server/ecs/spatial-resources';
import { WorldState } from '../../../server/ecs/world-state';

test('SpatialIndex queries by radius over grid cells', () => {
    const index = new SpatialIndex();
    const a = makeEntityId(1, 0);
    const b = makeEntityId(2, 0);
    const c = makeEntityId(3, 0);

    index.insert(a, gridPos(0, 0));
    index.insert(b, gridPos(1, 0));
    index.insert(c, gridPos(10, 10));

    expect(index.queryRadius(gridPos(0, 0), 0)).toEqual([a]);
    expect(index.queryRadius(gridPos(0, 0), 1)).toEqual([a, b]);
});

test('InterestTracker computes enter/leave diffs', () => {
    const tracker = new InterestTracker();
    const player = makeEntityId(9, 0);
    const a = makeEntityId(1, 0);
    const b = makeEntityId(2, 0);

    expect(tracker.update(player, [a, b]).enter).toEqual([a, b]);
    expect(tracker.update(player, [b]).enter).toEqual([]);
    expect(tracker.update(player, [b]).leave).toEqual([]);
    expect(tracker.update(player, [a]).leave).toEqual([b]);
});

test('Spatial index rebuild system snapshots Position store into SpatialIndex resource', () => {
    const state = new WorldState();
    const index = new SpatialIndex();
    state.resources.set(SPATIAL_INDEX_RESOURCE, index);

    const Position = state.world.components.register('Position', new SoaGridPosStore());
    const e1 = state.world.createEntity();
    const e2 = state.world.createEntity();
    state.world.addComponent(e1, Position, gridPos(0, 0));
    state.world.addComponent(e2, Position, gridPos(5, 5));

    const sys = createSpatialIndexRebuildSystem({ Position, spatialIndexKey: SPATIAL_INDEX_RESOURCE });
    sys(state, { tick: 1 });

    expect(index.queryRadius(gridPos(0, 0), 0)).toEqual([e1]);
    expect(index.queryRadius(gridPos(5, 5), 0)).toEqual([e2]);
});

test('Spatial index rebuild system does not retain stale positions', () => {
    const state = new WorldState();
    const index = new SpatialIndex();
    state.resources.set(SPATIAL_INDEX_RESOURCE, index);

    const Position = state.world.components.register('Position', new SoaGridPosStore());
    const e1 = state.world.createEntity();
    state.world.addComponent(e1, Position, gridPos(0, 0));

    const sys = createSpatialIndexRebuildSystem({ Position, spatialIndexKey: SPATIAL_INDEX_RESOURCE });
    sys(state, { tick: 1 });
    expect(index.queryRadius(gridPos(0, 0), 0)).toEqual([e1]);

    state.world.addComponent(e1, Position, gridPos(10, 0));
    sys(state, { tick: 2 });

    expect(index.queryRadius(gridPos(0, 0), 0)).toEqual([]);
    expect(index.queryRadius(gridPos(10, 0), 0)).toEqual([e1]);
});
