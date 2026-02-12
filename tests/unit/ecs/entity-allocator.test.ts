import { expect, test } from 'bun:test';
import { entityIdGeneration, entityIdIndex, makeEntityId } from '../../../shared/domain/ids';
import { EntityAllocator } from '../../../server/ecs/entity-allocator';

test('EntityAllocator creates live ids and reuses indices with generation bump', () => {
    const alloc = new EntityAllocator();

    const a = alloc.create();
    const b = alloc.create();
    expect(alloc.isAlive(a)).toBe(true);
    expect(alloc.isAlive(b)).toBe(true);
    expect(alloc.aliveCount).toBe(2);

    alloc.destroy(a);
    expect(alloc.isAlive(a)).toBe(false);
    expect(alloc.aliveCount).toBe(1);

    const a2 = alloc.create();
    expect(entityIdIndex(a2)).toBe(entityIdIndex(a));
    expect(entityIdGeneration(a2)).toBe(entityIdGeneration(a) + 1);
    expect(alloc.isAlive(a2)).toBe(true);
});

test('EntityAllocator rejects double-destroy and stale generation', () => {
    const alloc = new EntityAllocator();
    const id = alloc.create();
    alloc.destroy(id);
    expect(() => alloc.destroy(id)).toThrow();
});

test('EntityAllocator.ensureAlive adopts a specific id and keeps create() from reusing it', () => {
    const alloc = new EntityAllocator();
    const adopted = makeEntityId(10, 0);
    alloc.ensureAlive(adopted);
    expect(alloc.isAlive(adopted)).toBe(true);

    // Sequential creates must never return the adopted index.
    const createdIndices = new Set<number>();
    for (let i = 0; i < 9; i += 1) {
        createdIndices.add(entityIdIndex(alloc.create()));
    }
    expect(createdIndices.has(10)).toBe(false);

    const next = alloc.create();
    expect(entityIdIndex(next)).toBe(11);
});
