import { expect, test } from 'bun:test';
import { makeEntityId } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { SoaGridPosStore, SparseSetStore } from '../../../server/ecs/component-store';

test('SparseSetStore basic CRUD', () => {
    const store = new SparseSetStore<{ hp: number }>();
    const a = makeEntityId(1, 0);
    const b = makeEntityId(2, 0);

    expect(store.size).toBe(0);
    expect(store.has(a)).toBe(false);

    store.set(a, { hp: 10 });
    store.set(b, { hp: 20 });
    expect(store.size).toBe(2);
    expect(store.get(a)?.hp).toBe(10);

    store.remove(a);
    expect(store.has(a)).toBe(false);
    expect(store.size).toBe(1);

    store.clear();
    expect(store.size).toBe(0);
});

test('SoaGridPosStore stores grid positions in SoA layout', () => {
    const store = new SoaGridPosStore();
    const id = makeEntityId(7, 3);
    store.set(id, gridPos(10, 20));
    expect(store.has(id)).toBe(true);
    expect(store.get(id)).toEqual(gridPos(10, 20));
    store.remove(id);
    expect(store.get(id)).toBeUndefined();
});

test('SoA stores reject stale generation reuse without explicit removal', () => {
    const store = new SoaGridPosStore();
    const id0 = makeEntityId(9, 0);
    const id1 = makeEntityId(9, 1);
    store.set(id0, gridPos(1, 2));
    expect(() => store.set(id1, gridPos(3, 4))).toThrow();
});
