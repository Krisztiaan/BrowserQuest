import net from 'node:net';
import { killBunProcess } from '../support/process-cleanup';
import WebSocket from '../support/ws-client';
import { toError } from '../support/format';

const repoRoot = new URL('../..', import.meta.url).pathname;

type EventValue = string | number | boolean | null | undefined | EventValue[] | { [key: string]: EventValue };
type EventRecord = Record<string, EventValue>;
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type FatalTrigger = 'unhandled_rejection' | 'uncaught_exception';
type ServerConfig = {
    port: number;
    debug_level: string;
    nb_players_per_world: number;
    nb_worlds: number;
    map_filepath: string;
    metrics_enabled: boolean;
    memcached_host?: string;
    memcached_port?: number;
    server_name?: string;
    game_servers?: Array<{ name: string }>;
};
type StartServerWithEventCaptureOptions = {
    name: string;
    fatalTrigger?: FatalTrigger;
    captureStderr?: boolean;
    configOverrides?: Partial<ServerConfig>;
};
type StartServerWithEventCaptureResult = {
    port: number;
    events: EventRecord[];
};
type StructuredLogHarness = {
    startServerWithEventCapture: (
        options?: StartServerWithEventCaptureOptions
    ) => Promise<StartServerWithEventCaptureResult>;
    openAndCloseWebSocketSession: (port: number) => Promise<void>;
    waitForEvent: (events: EventRecord[], eventName: string, timeoutMs?: number) => Promise<EventRecord>;
    cleanup: () => Promise<void>;
};

export function createStructuredLogHarness(): StructuredLogHarness {
    let proc: ReturnType<typeof Bun.spawn> | null = null;
    let configPath: string | null = null;
    const recentStructuredLines: string[] = [];

    function pushRecentStructuredLine(line: string) {
        recentStructuredLines.push(line);
        if (recentStructuredLines.length > 30) {
            recentStructuredLines.shift();
        }
    }

    function formatRecentContext(events: EventRecord[]) {
        const seenEvents = Array.from(
            new Set(
                events
                    .map((eventRecord) => eventRecord.event)
                    .filter((eventName): eventName is string => typeof eventName === 'string')
            )
        );
        const eventSummary = seenEvents.length > 0 ? seenEvents.join(', ') : '(none)';
        const recentLines =
            recentStructuredLines.length > 0 ? recentStructuredLines.join('\n') : '(no structured lines captured)';
        return `seen events: ${eventSummary}\nrecent structured lines:\n${recentLines}`;
    }

    async function getFreePort() {
        return new Promise<number>((resolve, reject) => {
            const server = net.createServer();
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                if (!address || typeof address === 'string') {
                    server.close(() => reject(new Error('Unable to allocate port')));
                    return;
                }
                const port = address.port;
                server.close((err) => (err ? reject(err) : resolve(port)));
            });
        });
    }

    // Wait until the status endpoint responds successfully.
    async function waitForHttpOk(url: string, timeoutMs = 5000) {
        const start = Date.now();
        let lastError: string | Error | null = null;

        for (;;) {
            try {
                const res = await fetch(url);
                if (res.ok) return;
                lastError = `HTTP ${res.status}`;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
            }

            if (Date.now() - start > timeoutMs) {
                throw new Error(`Timed out waiting for ${url}. Last error: ${String(lastError)}`);
            }
            await Bun.sleep(50);
        }
    }

    // Wait for a structured event name to appear in captured records.
    async function waitForEvent(events: EventRecord[], eventName: string, timeoutMs = 5000) {
        const start = Date.now();

        for (;;) {
            const found = events.find((e) => e.event === eventName);
            if (found) {
                return found;
            }
            if (Date.now() - start > timeoutMs) {
                throw new Error(`Timed out waiting for event ${eventName}.\n${formatRecentContext(events)}`);
            }
            await Bun.sleep(25);
        }
    }

    function attachEventReader(
        stream: ReadableStream<Uint8Array> | number | null | undefined,
        events: EventRecord[],
        sourceLabel: string
    ) {
        if (!stream || typeof stream === 'number') {
            return;
        }
        const reader = stream.getReader();
        void (async () => {
            let carry = '';
            try {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (!(value instanceof Uint8Array)) {
                        continue;
                    }
                    carry += new TextDecoder().decode(value);
                    const lines = carry.split('\n');
                    carry = lines.pop() ?? '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('{')) continue;
                        pushRecentStructuredLine(`[${sourceLabel}] ${trimmed}`);
                        try {
                            const parsed = JSON.parse(trimmed) as JsonValue;
                            if (parsed && typeof parsed === 'object' && 'event' in parsed) {
                                events.push(parsed as EventRecord);
                            }
                        } catch (_) {
                            // ignore non-json lines
                        }
                    }
                }
            } catch (_) {
                // ignore read errors during teardown
            }
        })();
    }

    // Start the server with temp config, attach stream readers, and wait for startup.
    async function startServerWithEventCapture(
        options?: StartServerWithEventCaptureOptions
    ): Promise<StartServerWithEventCaptureResult> {
        const suffix = options?.name ?? 'structured-logs';
        const captureStderr = options?.captureStderr === true;
        const port = await getFreePort();

        configPath = `${repoRoot}/server/.tmp-config.${suffix}-${port}.json`;
        const baseConfig: ServerConfig = {
            port,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/world.json',
            metrics_enabled: false,
        };
        const mergedConfig = Object.assign({}, baseConfig, options?.configOverrides ?? {});
        await Bun.write(configPath, JSON.stringify(mergedConfig));

        const events: EventRecord[] = [];
        recentStructuredLines.length = 0;
        proc = Bun.spawn({
            cmd: ['bun', 'server/entry.ts', configPath],
            cwd: repoRoot,
            env: options?.fatalTrigger
                ? {
                      ...process.env,
                      BQ_TEST_TRIGGER_FATAL_EVENT: options.fatalTrigger,
                  }
                : process.env,
            stdout: 'pipe',
            stderr: captureStderr ? 'pipe' : 'ignore',
        });

        attachEventReader(proc.stdout, events, 'stdout');
        if (captureStderr) {
            attachEventReader(proc.stderr, events, 'stderr');
        }

        await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);
        await waitForEvent(events, 'server.start');

        return { port, events };
    }

    // Open and close a websocket session to trigger connection lifecycle events.
    async function openAndCloseWebSocketSession(port: number) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for handshake')), 4000);
            ws.once('error', (err) => {
                clearTimeout(timeout);
                reject(toError(err));
            });
            ws.on('message', (data) => {
                if (typeof data === 'string' ? data === 'go' : false) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });
        ws.close();
        await new Promise<void>((resolve) => ws.once('close', () => resolve()));
    }

    // Kill server process and remove temp config file after each test.
    async function cleanup() {
        await killBunProcess(proc);
        proc = null;

        if (configPath) {
            try {
                await Bun.file(configPath).delete();
            } catch (_) {
                // ignore
            } finally {
                configPath = null;
            }
        }
    }

    return {
        startServerWithEventCapture,
        openAndCloseWebSocketSession,
        waitForEvent,
        cleanup,
    };
}
