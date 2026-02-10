import { expect, test } from 'bun:test';
import { Evented } from '../../shared/js/evented';
import type { MergeEvents, NoEvents, TypedEventSource } from '../../shared/js/typed-event-emitter';

type Assert<T extends true> = T;
type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type CoreEvents = {
    connected: [];
    moved: [x: number, y: number];
};

type ExtraEvents = {
    disconnected: [reason: string];
};

type CombinedEvents = MergeEvents<CoreEvents, ExtraEvents>;

class Probe extends Evented<CombinedEvents> {}

// Compile-time contract checks.
type _sourceContract = Assert<IsEqual<Probe['on'], TypedEventSource<CombinedEvents>['on']>>;
type _noEventsIsEmpty = Assert<IsEqual<keyof NoEvents, never>>;

test('typed evented compile-time contracts are stable', () => {
    const probe = new Probe();
    let called = false;

    probe.on('connected', () => {
        called = true;
    });
    probe.emit('connected');
    expect(called).toBe(true);
});
