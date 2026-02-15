import { expect, test } from 'bun:test';
import { TimeWheel } from '../../../server/world/time/timewheel';

test('TimeWheel drains due jobs in tick order and supports reschedule/cancel', () => {
    const wheel = new TimeWheel<string>();

    wheel.schedule({ id: 'a', dueTick: 5, payload: 'A' });
    wheel.schedule({ id: 'b', dueTick: 3, payload: 'B' });
    expect(wheel.peekNextDueTick()).toBe(3);
    expect(wheel.drainDue(2)).toEqual([]);

    expect(wheel.drainDue(3)).toEqual([{ id: 'b', dueTick: 3, payload: 'B' }]);
    expect(wheel.peekNextDueTick()).toBe(5);

    // Reschedule overwrites by id (latest wins).
    wheel.schedule({ id: 'a', dueTick: 4, payload: 'A2' });
    expect(wheel.peekNextDueTick()).toBe(4);
    expect(wheel.drainDue(4)).toEqual([{ id: 'a', dueTick: 4, payload: 'A2' }]);

    // Cancel removes pending jobs by id.
    wheel.schedule({ id: 'c', dueTick: 10, payload: 'C' });
    expect(wheel.cancel('c')).toBe(true);
    expect(wheel.drainDue(100)).toEqual([]);
});

test('TimeWheel honors maxJobs without scanning future jobs', () => {
    const wheel = new TimeWheel<number>();
    wheel.schedule({ id: 'a', dueTick: 1, payload: 1 });
    wheel.schedule({ id: 'b', dueTick: 1, payload: 2 });
    wheel.schedule({ id: 'c', dueTick: 1, payload: 3 });

    const first = wheel.drainDue(1, { maxJobs: 2 });
    expect(first).toHaveLength(2);

    const second = wheel.drainDue(1);
    expect(second).toHaveLength(1);
});

