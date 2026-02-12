import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';
import WebSocket from '../support/ws-client';
import { killBunProcess } from '../support/process-cleanup';

const repoRoot = new URL('../..', import.meta.url).pathname;
const runHealthySmoke = process.env.BQ_TEST_METRICS_HEALTH === '1';
const maybeTest = runHealthySmoke ? test : test.skip;

type EventRecord = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function startStructuredLogCapture(stream: ReadableStream<unknown> | number | null | undefined, events: EventRecord[]) {
    if (!stream || typeof stream === 'number') {
        return;
    }

    const reader = stream.getReader();

    void (async () => {
        let carry = '';
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!(value instanceof Uint8Array)) {
                continue;
            }
            carry += new TextDecoder().decode(value);
            const chunks = carry.split('\n');
            carry = chunks.pop() ?? '';
            chunks.forEach((line) => {
                const trimmed = line.trim();
                if (!trimmed.startsWith('{')) {
                    return;
                }
                try {
                    const parsed: unknown = JSON.parse(trimmed);
                    if (isRecord(parsed)) {
                        events.push(parsed);
                    }
                } catch (_) {
                    // ignore non-structured lines
                }
            });
        }
    })();
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

async function waitForHttpOk(url: string, timeoutMs = 8000) {
    const start = Date.now();
     
    for (;;) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch (_) {
            // ignore until timeout
        }

        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for ${url}`);
        }
        await Bun.sleep(50);
    }
}

async function waitForCondition(check: () => boolean, timeoutMs: number, label: string) {
    const start = Date.now();
     
    for (;;) {
        if (check()) return;
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for ${label}`);
        }
        await Bun.sleep(50);
    }
}

let proc: ReturnType<typeof Bun.spawn> | null = null;
let configPath: string | null = null;

afterEach(async () => {
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
});

maybeTest('optional: healthy metrics path starts with memcache backend and no fallback event', async () => {
     
    const hasMemcacheDependency = (() => {
        try {
            require.resolve('memcache');
            return true;
        } catch (_) {
            return false;
        }
    })();

    expect(hasMemcacheDependency).toBe(true);

    const port = await getFreePort();
    const memcachedHostEnv = process.env.BQ_TEST_METRICS_HOST;
    const memcachedHost =
        memcachedHostEnv && memcachedHostEnv.trim() !== '' ? memcachedHostEnv : '127.0.0.1';
    const memcachedPortEnv = process.env.BQ_TEST_METRICS_PORT;
    const memcachedPort = Number.parseInt(
        memcachedPortEnv && memcachedPortEnv.trim() !== '' ? memcachedPortEnv : '11211',
        10
    );

    configPath = `${repoRoot}/server/.tmp-config.metrics-healthy-${port}.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/world.json',
            metrics_enabled: true,
            memcached_host: memcachedHost,
            memcached_port: memcachedPort,
            server_name: 'local',
            game_servers: [{ name: 'local' }],
        })
    );

    const events: EventRecord[] = [];

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    startStructuredLogCapture(proc.stdout, events);
    startStructuredLogCapture(proc.stderr, events);

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const message = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for handshake')), 4000);
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err instanceof Error ? err : new Error(String(err)));
        });
        ws.once('message', (data: unknown) => {
            clearTimeout(timeout);
            if (typeof data !== 'string') {
                reject(new Error('Unexpected websocket handshake payload type'));
                ws.close();
                return;
            }
            resolve(data);
            ws.close();
        });
    });
    expect(message).toBe('go');

    await waitForCondition(
        () =>
            events.some((eventRecord) => eventRecord.event === 'server.metrics.ready') ||
            events.some((eventRecord) => eventRecord.event === 'server.metrics.unavailable'),
        4000,
        'metrics adapter startup signal'
    );

    const fallbackEvent = events.find((eventRecord) => eventRecord.event === 'server.metrics.unavailable');
    expect(fallbackEvent).toBeUndefined();
    const readyEvent = events.find((eventRecord) => eventRecord.event === 'server.metrics.ready');
    expect(readyEvent).toBeDefined();
});
