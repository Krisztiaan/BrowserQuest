import { expect, test } from 'bun:test';
import { runEcsSchedulerProbeIfEnabled } from '../../../../server/startup/ecs-scheduler-probe';

test('ecs scheduler probe does nothing when probe mode is disabled', async () => {
    let calls = 0;
    await runEcsSchedulerProbeIfEnabled({
        env: {},
        emitProbeEvent: () => {
            calls += 1;
        },
        fail: () => {
            calls += 100;
        },
    });
    expect(calls).toBe(0);
});

test('ecs scheduler probe emits ok when enabled', async () => {
    const events: Array<{ level: string; status?: string }> = [];
    await runEcsSchedulerProbeIfEnabled({
        env: { BQ_ECS_SCHEDULER_PROBE: '1' },
        emitProbeEvent: (level, fields) => {
            events.push({ level, status: fields.status });
        },
        fail: () => {
            throw new Error('should not fail');
        },
    });
    expect(events).toEqual([{ level: 'info', status: 'ok' }]);
});
