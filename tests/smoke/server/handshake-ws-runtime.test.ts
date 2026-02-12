import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';
import WebSocket from '../../support/ws-client';

const repoRoot = new URL('../../..', import.meta.url).pathname;
type EventRecord = Record<string, unknown>;

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

async function waitForHttpOk(url: string, timeoutMs = 5000) {
    const start = Date.now();
     
    while (true) {
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
     
    while (true) {
        if (check()) return;
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for ${label}`);
        }
        await Bun.sleep(25);
    }
}

function startStructuredCapture(stream: ReadableStream<unknown> | number | null | undefined, events: EventRecord[]) {
    if (!stream || typeof stream === 'number') {
        return;
    }
    const reader = stream.getReader();
    void (async () => {
        let carry = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!(value instanceof Uint8Array)) {
                continue;
            }
            carry += new TextDecoder().decode(value);
            const chunks = carry.split('\n');
            carry = chunks.pop() || '';
            chunks.forEach((line) => {
                const trimmed = line.trim();
                if (!trimmed.startsWith('{')) {
                    return;
                }
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && typeof parsed === 'object') {
                        events.push(parsed);
                    }
                } catch (_) {
                    // ignore
                }
            });
        }
    })();
}

let proc: ReturnType<typeof Bun.spawn> | null = null;

afterEach(async () => {
    try {
        proc?.kill();
    } catch (_) {
        // ignore
    } finally {
        proc = null;
    }
});

test("server entry uses default websocket runtime and sends 'go' handshake", async () => {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.test-runtime-ws-runtime-${port}.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port,
            debug_level: 'error',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/world.json',
            metrics_enabled: false,
        })
    );

    const events: EventRecord[] = [];
    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    startStructuredCapture(proc.stdout, events);

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);
    await waitForCondition(
        () =>
            events.some(
                (eventRecord) =>
                    eventRecord.event === 'server.runtime.ws_runtime_mode' &&
                    eventRecord.mode === 'runtime' &&
                    eventRecord.status === 'ok'
            ),
        4000,
        'runtime websocket runtime mode event'
    );

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const message = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for handshake')), 3000);
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        ws.once('message', (data) => {
            clearTimeout(timeout);
            resolve(data.toString());
            try {
                ws.close();
            } catch (_) {
                // ignore
            }
        });
    });

    expect(message).toBe('go');
    await Bun.file(configPath).delete();
});
