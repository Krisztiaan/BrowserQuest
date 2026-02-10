import { expect, test } from 'bun:test';
import { TypedEventEmitter } from '../../shared/js/typed-event-emitter';

type TestEvents = {
    connected: [];
    disconnected: [reason: string];
    moved: [x: number, y: number];
};

test('typed emitter invokes listeners registered with on', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    let called = false;
    let reason = '';

    emitter.on('connected', () => {
        called = true;
    });
    emitter.on('disconnected', (message) => {
        reason = message;
    });

    emitter.emit('connected');
    emitter.emit('disconnected', 'timeout');

    expect(called).toBe(true);
    expect(reason).toBe('timeout');
});

test('typed emitter on returns unsubscribe function', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    let calls = 0;
    const unsubscribe = emitter.on('connected', () => {
        calls += 1;
    });

    emitter.emit('connected');
    unsubscribe();
    emitter.emit('connected');

    expect(calls).toBe(1);
});

test('typed emitter once listener runs at most once', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    let calls = 0;

    emitter.once('moved', () => {
        calls += 1;
    });

    emitter.emit('moved', 10, 11);
    emitter.emit('moved', 12, 13);

    expect(calls).toBe(1);
});

test('typed emitter off removes previously registered listener', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    let calls = 0;
    const callback = () => {
        calls += 1;
    };

    emitter.on('connected', callback);
    emitter.off('connected', callback);
    emitter.emit('connected');

    expect(calls).toBe(0);
});
