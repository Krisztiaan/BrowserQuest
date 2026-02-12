import { expect, test } from 'bun:test';
import { FixedClock } from '../../../server/ecs/clock';
import { RNG_RESOURCE, CLOCK_RESOURCE } from '../../../server/ecs/core-resources';
import { XorShift32 } from '../../../server/ecs/rng';
import { Scheduler } from '../../../server/ecs/scheduler';
import { WorldState } from '../../../server/ecs/world-state';

function withDeterminismGuards<T>(fn: () => T): T {
    const originalRandom = Math.random;
    const originalNow = Date.now;

    Math.random = () => {
        throw new Error('nondeterminism guard: Math.random is forbidden in deterministic sim');
    };
    Date.now = () => {
        throw new Error('nondeterminism guard: Date.now is forbidden in deterministic sim');
    };

    try {
        return fn();
    } finally {
        Math.random = originalRandom;
        Date.now = originalNow;
    }
}

test('deterministic ECS scheduler tick runs without Math.random/Date.now when seeded rng + fixed clock are used', () => {
    withDeterminismGuards(() => {
        const state = new WorldState();
        state.resources.set(RNG_RESOURCE, new XorShift32(123));
        state.resources.set(CLOCK_RESOURCE, new FixedClock(0));

        const scheduler = new Scheduler({
            nowMs: () => state.resources.require(CLOCK_RESOURCE).nowMs(),
        });

        const draws: number[] = [];
        scheduler.register('sim', 'rng_draw', (worldState) => {
            const rng = worldState.resources.require(RNG_RESOURCE);
            draws.push(rng.nextInt(1000));
        });

        scheduler.tick(state, 1);
        scheduler.tick(state, 2);

        expect(draws.length).toBe(2);
    });
});

test('nondeterminism guard fails fast when a system calls Math.random', () => {
    expect(() =>
        withDeterminismGuards(() => {
            const state = new WorldState();
            const scheduler = new Scheduler({ nowMs: () => 0 });
            scheduler.register('sim', 'bad_random', () => {
                Math.random();
            });
            scheduler.tick(state, 1);
        })
    ).toThrow(/Math\.random/);
});

test('nondeterminism guard fails fast when a system calls Date.now', () => {
    expect(() =>
        withDeterminismGuards(() => {
            const state = new WorldState();
            const scheduler = new Scheduler({ nowMs: () => 0 });
            scheduler.register('sim', 'bad_now', () => {
                Date.now();
            });
            scheduler.tick(state, 1);
        })
    ).toThrow(/Date\.now/);
});
