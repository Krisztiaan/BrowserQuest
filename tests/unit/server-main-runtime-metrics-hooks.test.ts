import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainRuntime = require('../../server/js/main-runtime');

test('main runtime population change handler updates counters, world population, and distribution', () => {
    const worldUpdates: number[] = [];
    const distributionWrites: unknown[] = [];
    const worlds = [
        {
            playerCount: 1,
            updatePopulation(total: number) {
                worldUpdates.push(total);
            },
        },
        {
            playerCount: 2,
            updatePopulation(total: number) {
                worldUpdates.push(total * 10);
            },
        },
    ];
    const metrics = {
        updatePlayerCounters(receivedWorlds: unknown, callback: (totalPlayers: number) => void) {
            expect(receivedWorlds).toBe(worlds);
            callback(5);
        },
        updateWorldDistribution(distribution: unknown) {
            distributionWrites.push(distribution);
        },
    };
    const onPopulationChange = MainRuntime.createPopulationChangeHandler(
        metrics,
        () => worlds,
        (receivedWorlds: Array<{ playerCount: number }>) => receivedWorlds.map((world) => world.playerCount)
    );

    onPopulationChange();

    expect(worldUpdates).toEqual([5, 50]);
    expect(distributionWrites).toEqual([[1, 2]]);
});

test('main runtime world population hooks are installed only when metrics are enabled', () => {
    let addedHooks = 0;
    let removedHooks = 0;
    const worlds = [
        {
            onPlayerAdded() {
                addedHooks += 1;
            },
            onPlayerRemoved() {
                removedHooks += 1;
            },
        },
        {
            onPlayerAdded() {
                addedHooks += 1;
            },
            onPlayerRemoved() {
                removedHooks += 1;
            },
        },
    ];
    const handler = () => {
        // no-op
    };

    MainRuntime.installWorldPopulationHooks(worlds, { isEnabled: true }, handler);
    expect(addedHooks).toBe(2);
    expect(removedHooks).toBe(2);

    MainRuntime.installWorldPopulationHooks(worlds, { isEnabled: false }, handler);
    expect(addedHooks).toBe(2);
    expect(removedHooks).toBe(2);
});

test('main runtime metrics initializer triggers population bootstrap only when metrics are enabled', () => {
    let populationInits = 0;
    let readyCalls = 0;

    MainRuntime.initializeMetricsPopulation(
        {
            isEnabled: true,
            ready(callback: () => void) {
                readyCalls += 1;
                callback();
            },
        },
        () => {
            populationInits += 1;
        }
    );
    expect(readyCalls).toBe(1);
    expect(populationInits).toBe(1);

    MainRuntime.initializeMetricsPopulation(
        {
            isEnabled: false,
            ready() {
                readyCalls += 1;
            },
        },
        () => {
            populationInits += 1;
        }
    );
    expect(readyCalls).toBe(1);
    expect(populationInits).toBe(1);
});
