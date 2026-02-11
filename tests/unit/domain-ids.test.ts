import { expect, test } from 'bun:test';
import {
    ENTITY_ID_NONE,
    entityIdGeneration,
    entityIdIndex,
    formatEntityId,
    isEntityId,
    isNoneEntityId,
    makeEntityId,
} from '../../shared/domain/ids';

test('EntityId packs index and generation into a uint32', () => {
    const id = makeEntityId(123, 7);
    expect(isEntityId(id)).toBe(true);
    expect(entityIdIndex(id)).toBe(123);
    expect(entityIdGeneration(id)).toBe(7);
    expect(formatEntityId(id)).toBe('7:123');
});

test('ENTITY_ID_NONE is recognized', () => {
    expect(isNoneEntityId(ENTITY_ID_NONE)).toBe(true);
    expect(entityIdIndex(ENTITY_ID_NONE)).toBe(0);
    expect(entityIdGeneration(ENTITY_ID_NONE)).toBe(0);
});

test('makeEntityId rejects invalid inputs', () => {
    expect(() => makeEntityId(-1, 0)).toThrow();
    expect(() => makeEntityId(0, -1)).toThrow();
    expect(() => makeEntityId(2 ** 20, 0)).toThrow();
    expect(() => makeEntityId(0, 2 ** 12)).toThrow();
});

