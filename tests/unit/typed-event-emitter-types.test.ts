import { expect, test } from 'bun:test';
import { Evented } from '../../shared/evented';
import type { MergeEvents, NoEvents, TypedEventSource } from '../../shared/typed-event-emitter';

type Assert<T extends true> = T;
type IsEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

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
