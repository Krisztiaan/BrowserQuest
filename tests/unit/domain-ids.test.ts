import { expect, test } from 'bun:test';
import {
    ENTITY_ID_NONE,
    ENTITY_ID_MAX_GENERATION,
    ENTITY_ID_MAX_INDEX,
    entityIdFromWire,
    entityIdFromWireString,
    entityIdToWire,
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

test('EntityId wire conversions validate and round-trip', () => {
    const id = entityIdFromWire(123);
    expect(entityIdToWire(id)).toBe(123);
    expect(entityIdFromWireString('123')).toBe(id);
    expect(() => entityIdFromWireString('abc')).toThrow();
    expect(() => entityIdFromWire(0xffff_ffff + 1)).toThrow();
});

test('ENTITY_ID_NONE is recognized', () => {
    expect(isNoneEntityId(ENTITY_ID_NONE)).toBe(true);
    expect(entityIdIndex(ENTITY_ID_NONE)).toBe(0);
    expect(entityIdGeneration(ENTITY_ID_NONE)).toBe(0);
});

test('makeEntityId rejects invalid inputs', () => {
    expect(() => makeEntityId(-1, 0)).toThrow();
    expect(() => makeEntityId(0, -1)).toThrow();
    expect(() => makeEntityId(ENTITY_ID_MAX_INDEX + 1, 0)).toThrow();
    expect(() => makeEntityId(0, ENTITY_ID_MAX_GENERATION + 1)).toThrow();
});

test('EntityId packing budgets index and generation for ECS reuse safety', () => {
    expect(ENTITY_ID_MAX_INDEX).toBe(1_048_575);
    expect(ENTITY_ID_MAX_GENERATION).toBe(4_095);
});
