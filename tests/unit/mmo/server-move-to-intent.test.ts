import { expect, test } from 'bun:test';
import { gridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import type { IntentWorldHost } from '../../../server/world/ecs-command-pipeline/core-module-registry';
import type { Command } from '../../../server/ecs/commands';
import type { DomainEvent } from '../../../server/ecs/events';
import { registerMovementComponents } from '../../../server/ecs/movement-components';
import { WorldState } from '../../../server/ecs/world-state';
import { registerSpawnReplicationComponents } from '../../../server/replication/spawn-replication';
import { applyMoveToIntentCommand } from '../../../server/world/intents/move-to-intent';

function makeEmptyGrid(width: number, height: number): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y += 1) {
        const row: number[] = [];
        for (let x = 0; x < width; x += 1) {
            row.push(0);
        }
        grid.push(row);
    }
    return grid;
}

test('move.to populates MoveQueue with a multi-step path (no occupancy)', () => {
    const state = new WorldState<Command, DomainEvent>();
    const replication = registerSpawnReplicationComponents(state.world);
    const movement = registerMovementComponents(state.world);

    const Position = replication.Position;
    const Kind = replication.Kind;

    const grid = makeEmptyGrid(8, 8);
    const world: IntentWorldHost = {
        map: {
            getDoorDestination: () => null,
            grid,
            width: 8,
            height: 8,
            isOutOfBounds: (x, y) => x < 0 || y < 0 || x >= 8 || y >= 8,
        },
        isValidPosition: (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && grid[y]?.[x] === 0,
    };

    const playerId = state.world.createEntity();
    state.world.addComponent(playerId, Position, gridPos(1, 1));
    state.world.addComponent(playerId, Kind, Types.Entities.WARRIOR);

    const res = applyMoveToIntentCommand({
        state,
        Position,
        Kind,
        player: { id: playerId, x: 1, y: 1, name: 'p' } as any,
        movement,
        world,
        cmd: {
            type: 'MOVE_TO',
            source: { connectionId: 'c1', playerId },
            to: gridPos(4, 1),
            stopAdjacentToTarget: false,
        },
    });
    expect(res).toBeUndefined();

    const queue = state.world.getComponent(playerId, movement.MoveQueue);
    expect(queue?.entries.length).toBeGreaterThanOrEqual(2);
    expect(queue?.entries[0]).toEqual(gridPos(2, 1));
    expect(queue?.entries[queue.entries.length - 1]).toEqual(gridPos(4, 1));
});

test('move.to respects stopAdjacentToTarget when the target tile is occupied by a blocking entity', () => {
    const state = new WorldState<Command, DomainEvent>();
    const replication = registerSpawnReplicationComponents(state.world);
    const movement = registerMovementComponents(state.world);

    const Position = replication.Position;
    const Kind = replication.Kind;

    const grid = makeEmptyGrid(8, 8);
    const world: IntentWorldHost = {
        map: {
            getDoorDestination: () => null,
            grid,
            width: 8,
            height: 8,
            isOutOfBounds: (x, y) => x < 0 || y < 0 || x >= 8 || y >= 8,
        },
        isValidPosition: (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && grid[y]?.[x] === 0,
    };

    const playerId = state.world.createEntity();
    state.world.addComponent(playerId, Position, gridPos(1, 1));
    state.world.addComponent(playerId, Kind, Types.Entities.WARRIOR);

    const mobId = state.world.createEntity();
    state.world.addComponent(mobId, Position, gridPos(4, 1));
    state.world.addComponent(mobId, Kind, Types.Entities.RAT);

    const reject = applyMoveToIntentCommand({
        state,
        Position,
        Kind,
        player: { id: playerId, x: 1, y: 1, name: 'p' } as any,
        movement,
        world,
        cmd: {
            type: 'MOVE_TO',
            source: { connectionId: 'c1', playerId },
            to: gridPos(4, 1),
            stopAdjacentToTarget: false,
        },
    });
    expect(reject).toEqual({ ok: false, reason: 'Invalid move.to (no path).' });
    expect(state.world.getComponent(playerId, movement.MoveQueue)).toBeUndefined();
    expect(grid[1]?.[4]).toBe(0); // occupancy overlay must be restored

    const res = applyMoveToIntentCommand({
        state,
        Position,
        Kind,
        player: { id: playerId, x: 1, y: 1, name: 'p' } as any,
        movement,
        world,
        cmd: {
            type: 'MOVE_TO',
            source: { connectionId: 'c1', playerId },
            to: gridPos(4, 1),
            stopAdjacentToTarget: true,
        },
    });
    expect(res).toBeUndefined();

    const queue = state.world.getComponent(playerId, movement.MoveQueue);
    expect(queue?.entries[queue.entries.length - 1]).toEqual(gridPos(3, 1));
    expect(grid[1]?.[4]).toBe(0); // occupancy overlay must be restored
});

test('move.to pathing uses constrained diagonal routing (expanded to cardinal steps)', () => {
    const state = new WorldState<Command, DomainEvent>();
    const replication = registerSpawnReplicationComponents(state.world);
    const movement = registerMovementComponents(state.world);

    const Position = replication.Position;
    const Kind = replication.Kind;

    const grid = makeEmptyGrid(8, 8);
    const world: IntentWorldHost = {
        map: {
            getDoorDestination: () => null,
            grid,
            width: 8,
            height: 8,
            isOutOfBounds: (x, y) => x < 0 || y < 0 || x >= 8 || y >= 8,
        },
        isValidPosition: (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && grid[y]?.[x] === 0,
    };

    const playerId = state.world.createEntity();
    state.world.addComponent(playerId, Position, gridPos(1, 1));
    state.world.addComponent(playerId, Kind, Types.Entities.WARRIOR);

    const res = applyMoveToIntentCommand({
        state,
        Position,
        Kind,
        player: { id: playerId, x: 1, y: 1, name: 'p' } as any,
        movement,
        world,
        cmd: {
            type: 'MOVE_TO',
            source: { connectionId: 'c1', playerId },
            to: gridPos(4, 4),
            stopAdjacentToTarget: false,
        },
    });
    expect(res).toBeUndefined();

    const queue = state.world.getComponent(playerId, movement.MoveQueue);
    expect(queue?.entries.length).toBeGreaterThanOrEqual(4);

    // First diagonal step expands to horizontal then vertical (parity rule).
    expect(queue?.entries[0]).toEqual(gridPos(2, 1));
    expect(queue?.entries[1]).toEqual(gridPos(2, 2));
    expect(queue?.entries[queue.entries.length - 1]).toEqual(gridPos(4, 4));
});

test('move.to diagonal routing does not cut corners (blocked orth neighbor forbids diagonal)', () => {
    const state = new WorldState<Command, DomainEvent>();
    const replication = registerSpawnReplicationComponents(state.world);
    const movement = registerMovementComponents(state.world);

    const Position = replication.Position;
    const Kind = replication.Kind;

    const grid = makeEmptyGrid(3, 3);
    grid[0][1] = 1; // block east of start; diagonal (0,0)->(1,1) must be rejected.

    const world: IntentWorldHost = {
        map: {
            getDoorDestination: () => null,
            grid,
            width: 3,
            height: 3,
            isOutOfBounds: (x, y) => x < 0 || y < 0 || x >= 3 || y >= 3,
        },
        isValidPosition: (x, y) => x >= 0 && y >= 0 && x < 3 && y < 3 && grid[y]?.[x] === 0,
    };

    const playerId = state.world.createEntity();
    state.world.addComponent(playerId, Position, gridPos(0, 0));
    state.world.addComponent(playerId, Kind, Types.Entities.WARRIOR);

    const res = applyMoveToIntentCommand({
        state,
        Position,
        Kind,
        player: { id: playerId, x: 0, y: 0, name: 'p' } as any,
        movement,
        world,
        cmd: {
            type: 'MOVE_TO',
            source: { connectionId: 'c1', playerId },
            to: gridPos(1, 1),
            stopAdjacentToTarget: false,
        },
    });
    expect(res).toBeUndefined();

    const queue = state.world.getComponent(playerId, movement.MoveQueue);
    expect(queue?.entries).toEqual([gridPos(0, 1), gridPos(1, 1)]);
});
