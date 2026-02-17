import { afterEach, expect, test } from 'bun:test';
import { createStructuredLogHarness } from './server-structured-logs.harness';

const harness = createStructuredLogHarness();

afterEach(async () => {
    await harness.cleanup();
});

const fatalCases = [
    {
        title: 'server emits normalized unhandled-rejection structured event names and fields',
        name: 'fatal-logs',
        fatalTrigger: 'unhandled_rejection',
        eventName: 'server.fatal.unhandled_rejection',
        source: 'unhandledRejection',
        messageFragment: 'bq-fatal-test-unhandled-rejection',
        expectsStack: false,
    },
    {
        title: 'server emits normalized uncaught-exception structured event names and fields',
        name: 'fatal-exception-logs',
        fatalTrigger: 'uncaught_exception',
        eventName: 'server.fatal.uncaught_exception',
        source: 'uncaughtException',
        messageFragment: 'bq-fatal-test-uncaught-exception',
        expectsStack: true,
    },
] as const;

for (const fatalCase of fatalCases) {
    test(fatalCase.title, async () => {
        const { events } = await harness.startServerWithEventCapture({
            name: fatalCase.name,
            fatalTrigger: fatalCase.fatalTrigger,
            captureStderr: true,
        });
        const fatalEvent = await harness.waitForEvent(events, fatalCase.eventName, 8000);

        expect(fatalEvent.level).toBe('error');
        expect(fatalEvent.source).toBe(fatalCase.source);
        const fatalMessage = typeof fatalEvent.message === 'string' ? fatalEvent.message : '';
        expect(fatalMessage).toContain(fatalCase.messageFragment);
        if (fatalCase.expectsStack) {
            expect(typeof fatalEvent.stack).toBe('string');
        }
    });
}
