import { expect, test } from 'bun:test';
import { WorldState } from '../../../server/ecs/world-state';

test('WorldState queues drain with stable semantics', () => {
    const state = new WorldState<string, number>();
    state.commands.push('MOVE');
    state.commands.push('LOOT');
    state.events.push(1);

    expect(state.commands.size).toBe(2);
    expect(state.events.size).toBe(1);

    expect(state.commands.drain()).toEqual(['MOVE', 'LOOT']);
    expect(state.commands.size).toBe(0);
    expect(state.commands.drain()).toEqual([]);
});
