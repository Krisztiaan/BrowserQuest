import { CLOCK_RESOURCE, RNG_RESOURCE } from '../ecs/core-resources';
import { FixedClock } from '../ecs/clock';
import { XorShift32 } from '../ecs/rng';
import { Scheduler } from '../ecs/scheduler';
import { WorldState } from '../ecs/world-state';
import type { RuntimeEventFields } from '../runtime-types';

export function runEcsSchedulerProbeIfEnabled({
    env,
    emitProbeEvent,
    fail,
}: {
    env: NodeJS.ProcessEnv;
    emitProbeEvent: (level: string, fields: RuntimeEventFields) => void;
    fail: (code: number) => void;
}): Promise<void> {
    if (env.BQ_ECS_SCHEDULER_PROBE !== '1') {
        return Promise.resolve();
    }

    try {
        const state = new WorldState<string, number>();
        state.resources.set(RNG_RESOURCE, new XorShift32(123));
        state.resources.set(CLOCK_RESOURCE, new FixedClock(0));

        const scheduler = new Scheduler<string, number>({
            nowMs: () => state.resources.require(CLOCK_RESOURCE).nowMs(),
        });

        scheduler.register('sim', 'probe_rng', (s) => {
            const rng = s.resources.require(RNG_RESOURCE);
            s.events.push(rng.nextInt(1000));
        });

        scheduler.tick(state, 1);
        const events = state.events.drain();
        const first = events[0];
        if (events.length !== 1 || typeof first !== 'number') {
            throw new Error('ecs probe: unexpected events shape');
        }

        emitProbeEvent('info', {
            status: 'ok',
        });
        return Promise.resolve();
    } catch (error) {
        emitProbeEvent('error', {
            status: 'failed',
            error: String(error),
        });
        fail(1);
        return Promise.resolve();
    }
}

export default {
    runEcsSchedulerProbeIfEnabled,
};
