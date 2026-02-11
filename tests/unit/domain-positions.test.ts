import { expect, test } from 'bun:test';
import { gridPos, gridPosKey, isGridPos, isWorldPos, worldPos } from '../../shared/domain/positions';

test('gridPos validates integer coordinates', () => {
    const pos = gridPos(10, 20);
    expect(isGridPos(pos)).toBe(true);
    expect(gridPosKey(pos)).toBe('10,20');
    expect(() => gridPos(1.5, 2)).toThrow();
});

test('worldPos validates finite coordinates', () => {
    const pos = worldPos(1.25, 2);
    expect(isWorldPos(pos)).toBe(true);
    expect(() => worldPos(Number.NaN, 0)).toThrow();
});

