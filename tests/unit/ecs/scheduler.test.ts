import { expect, test } from 'bun:test';
import { CLOCK_RESOURCE, RNG_RESOURCE } from '../../../server/ecs/core-resources';
import { FixedClock } from '../../../server/ecs/clock';
import { XorShift32 } from '../../../server/ecs/rng';
import { Scheduler, type SchedulerStage } from '../../../server/ecs/scheduler';
import { WorldState } from '../../../server/ecs/world-state';

test('Scheduler runs stages in pre/sim/post order', () => {
    const calls: Array<`${SchedulerStage}:${string}`> = [];
    const scheduler = new Scheduler({
        hooks: {
            onSystemStart(stage, name) {
                calls.push(`${stage}:${name}`);
            },
        },
        nowMs: () => 0,
    });

    scheduler.register('pre', 'a', () => {});
    scheduler.register('sim', 'b', () => {});
    scheduler.register('post', 'c', () => {});

    scheduler.tick(new WorldState(), 1);
    expect(calls).toEqual(['pre:a', 'sim:b', 'post:c']);
});

test('Scheduler reports budget overruns via hooks', () => {
    const exceeded: Array<{ stage: SchedulerStage; name: string }> = [];
    let t = 0;
    const scheduler = new Scheduler({
        hooks: {
            onSystemBudgetExceeded(stage, name) {
                exceeded.push({ stage, name });
            },
        },
        nowMs: () => {
            t += 10;
            return t;
        },
    });

    scheduler.registerWithOptions('sim', 'slow', () => {}, { budgetMs: 5 });
    scheduler.tick(new WorldState(), 1);

    expect(exceeded).toEqual([{ stage: 'sim', name: 'slow' }]);
});

test('Scheduler is deterministic under fixed seed, clock, and command stream', () => {
    const make = () => {
        const state = new WorldState<string, number>();
        state.resources.set(RNG_RESOURCE, new XorShift32(123));
        state.resources.set(CLOCK_RESOURCE, new FixedClock(0));
        const scheduler = new Scheduler<string, number>({
            nowMs: () => state.resources.require(CLOCK_RESOURCE).nowMs(),
        });

        scheduler.register('pre', 'ingest', (s) => {
            const cmds = s.commands.drain();
            for (let i = 0; i < cmds.length; i += 1) {
                // encode command stream into events deterministically
                s.events.push(cmds[i]?.length ?? 0);
            }
        });

        scheduler.register('sim', 'rng', (s) => {
            const rng = s.resources.require(RNG_RESOURCE);
            s.events.push(rng.nextInt(1000));
        });

        scheduler.register('post', 'clock', (s) => {
            s.resources.require(CLOCK_RESOURCE).advanceMs(16);
        });

        return { state, scheduler };
    };

    const a = make();
    const b = make();

    for (let tick = 1; tick <= 5; tick += 1) {
        a.state.commands.push('MOVE');
        a.state.commands.push('CHAT');
        b.state.commands.push('MOVE');
        b.state.commands.push('CHAT');

        a.scheduler.tick(a.state, tick);
        b.scheduler.tick(b.state, tick);
    }

    expect(a.state.events.drain()).toEqual(b.state.events.drain());
});
