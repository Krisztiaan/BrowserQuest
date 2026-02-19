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
import type { PlayerLike } from '../../../server/world/player-like';
import type { EntityId } from '../../../shared/domain/ids';

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

function makePlayerLike(id: EntityId, x: number, y: number): PlayerLike {
    function on(eventName: 'move', callback: (x: number, y: number) => void): void;
    function on(eventName: 'lootMove', callback: (x: number, y: number) => void): void;
    function on(eventName: 'exit', callback: () => void): void;
    function on(_eventName: 'move' | 'lootMove' | 'exit', _callback: ((x: number, y: number) => void) | (() => void)): void {
        // no-op for unit tests
    }

    function emit(eventName: 'exit'): void;
    function emit(eventName: 'zone'): void;
    function emit(eventName: 'move', x: number, y: number): void;
    function emit(eventName: 'lootMove', x: number, y: number): void;
    function emit(
        _eventName: 'exit' | 'zone' | 'move' | 'lootMove',
        _x?: number,
        _y?: number
    ): void {
        // no-op for unit tests
    }

    const player: PlayerLike = {
        id,
        x,
        y,
        kind: Types.Entities.WARRIOR,
        name: 'p',
        orientation: Types.Orientations.DOWN,
        armor: Types.Entities.CLOTHARMOR,
        weapon: Types.Entities.SWORD1,
        armorLevel: 1,
        weaponLevel: 1,
        maxHitPoints: 100,
        hitPoints: 100,
        hasEnteredGame: true,
        isDead: false,
        lastCheckpoint: null,
        setPositionResolver: () => {},
        on,
        updatePosition: () => {},
        setPosition: (nx, ny) => {
            player.x = nx;
            player.y = ny;
        },
        setTarget: () => {},
        clearTarget: () => {},
        emit,
    };
    return player;
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
        player: makePlayerLike(playerId, 1, 1),
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
        player: makePlayerLike(playerId, 1, 1),
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
        player: makePlayerLike(playerId, 1, 1),
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

test('move.to pathing uses constrained diagonal routing (keeps diagonal steps)', () => {
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
        player: makePlayerLike(playerId, 1, 1),
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
    expect(queue?.entries.length).toBeGreaterThanOrEqual(3);

    // Diagonal variant should choose the shorter diagonal route on an empty grid.
    expect(queue?.entries[0]).toEqual(gridPos(2, 2));
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
        player: makePlayerLike(playerId, 0, 0),
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

test('move.to does not crash when map.isOutOfBounds relies on `this`', () => {
    const state = new WorldState<Command, DomainEvent>();
    const replication = registerSpawnReplicationComponents(state.world);
    const movement = registerMovementComponents(state.world);

    const Position = replication.Position;
    const Kind = replication.Kind;

    const grid = makeEmptyGrid(4, 4);

    type ThisBoundMap = IntentWorldHost['map'] & { width: number; height: number };
    const map: ThisBoundMap = {
        getDoorDestination: () => null,
        grid,
        width: 4,
        height: 4,
        isOutOfBounds(this: ThisBoundMap, x: number, y: number) {
            // This reproduces the server Map method behavior (`this.width` usage).
            return x < 0 || y < 0 || x >= this.width || y >= this.height;
        },
    };

    const world: IntentWorldHost = {
        map,
        isValidPosition: (x, y) => x >= 0 && y >= 0 && x < 4 && y < 4 && grid[y]?.[x] === 0,
    };

    const playerId = state.world.createEntity();
    state.world.addComponent(playerId, Position, gridPos(1, 1));
    state.world.addComponent(playerId, Kind, Types.Entities.WARRIOR);

    const res = applyMoveToIntentCommand({
        state,
        Position,
        Kind,
        player: makePlayerLike(playerId, 1, 1),
        movement,
        world,
        cmd: {
            type: 'MOVE_TO',
            source: { connectionId: 'c1', playerId },
            to: gridPos(3, 1),
            stopAdjacentToTarget: false,
        },
    });
    expect(res).toBeUndefined();
});
