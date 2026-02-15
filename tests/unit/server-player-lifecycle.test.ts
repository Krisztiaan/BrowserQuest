import { expect, test } from 'bun:test';
import { installWorldPlayerLifecycle } from '../../server/world/player-lifecycle';

type EventName = 'playerConnect' | 'playerEnter';
type PlayerEventName = 'move' | 'lootMove' | 'exit';

test('player lifecycle binds disconnect teardown once across repeated playerEnter', () => {
    const worldHandlers: Record<EventName, Array<(player: unknown) => void>> = {
        playerConnect: [],
        playerEnter: [],
    };
    const playerHandlers: Record<PlayerEventName, Array<(...args: unknown[]) => void>> = {
        move: [],
        lootMove: [],
        exit: [],
    };

    let removePlayerCalls = 0;
    let decrementPlayerCountCalls = 0;
    const emitted: string[] = [];

    const world = {
        id: 'world-1',
        map: {
            getRandomStartingPosition() {
                return { x: 1, y: 1 };
            },
        },
        playerCount: 1,
        on(eventName: EventName, callback: (player: unknown) => void) {
            worldHandlers[eventName].push(callback);
        },
        emit(eventName: 'playerAdded' | 'playerRemoved') {
            emitted.push(eventName);
        },
        incrementPlayerCount() {},
        decrementPlayerCount() {
            decrementPlayerCountCalls += 1;
        },
        pushToPlayer() {},
        removePlayer() {
            removePlayerCalls += 1;
        },
    };

    installWorldPlayerLifecycle(world as never);

    const player = {
        id: 5001,
        name: 'Alice',
        hasEnteredGame: true,
        lastCheckpoint: null,
        setPositionResolver() {},
        on(eventName: PlayerEventName, callback: (...args: unknown[]) => void) {
            playerHandlers[eventName].push(callback);
        },
    };

    for (const callback of worldHandlers.playerEnter) {
        callback(player);
        callback(player);
    }

    expect(playerHandlers.exit.length).toBe(1);
    expect(playerHandlers.move.length).toBe(1);
    expect(playerHandlers.lootMove.length).toBe(1);

    for (const callback of playerHandlers.exit) {
        callback();
    }

    expect(removePlayerCalls).toBe(1);
    expect(decrementPlayerCountCalls).toBe(1);
    expect(emitted.filter((eventName) => eventName === 'playerRemoved')).toHaveLength(1);
});

