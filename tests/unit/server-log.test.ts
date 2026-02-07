import { afterEach, expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Log = require('../../server/js/log');

const originalConsoleInfo = console.info;
const originalConsoleError = console.error;
const originalLogLevel = Log.getLogger().level;

afterEach(() => {
    console.info = originalConsoleInfo;
    console.error = originalConsoleError;
    Log.setLevel(originalLogLevel);
});

test('logger emits structured JSON events', () => {
    const lines: string[] = [];
    console.info = (...args: unknown[]) => {
        lines.push(args.join(' '));
    };

    const log = new Log(Log.INFO);
    log.event('info', 'test.event', { answer: 42 });

    expect(lines.length).toBe(1);
    const record = JSON.parse(lines[0]);
    expect(record.level).toBe('info');
    expect(record.event).toBe('test.event');
    expect(record.answer).toBe(42);
    expect(typeof record.ts).toBe('string');
});

test('logger suppresses debug events when level is info', () => {
    const lines: string[] = [];
    console.info = (...args: unknown[]) => {
        lines.push(args.join(' '));
    };

    const log = new Log(Log.INFO);
    log.event('debug', 'test.debug', { enabled: false });

    expect(lines.length).toBe(0);
});

test('logger singleton instance is shared and setLevel guards invalid values', () => {
    const loggerA = Log.getLogger();
    const loggerB = Log.getLogger();

    expect(loggerA).toBe(loggerB);

    const configured = Log.setLevel(Log.DEBUG);
    expect(configured).toBe(loggerA);
    expect(loggerA.level).toBe(Log.DEBUG);

    Log.setLevel(999);
    expect(loggerA.level).toBe(Log.INFO);
});
