import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../../support/process-cleanup';

const repoRoot = new URL('../../..', import.meta.url).pathname;

type EventValue = string | number | boolean | null | undefined | EventValue[] | { [key: string]: EventValue };
type EventRecord = Record<string, EventValue>;
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function startStructuredLogCapture(
    stream: ReadableStream<Uint8Array> | number | null | undefined,
    events: EventRecord[],
    rawLines?: string[]
) {
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
                if (rawLines && trimmed) {
                    rawLines.push(trimmed);
                }
                if (!trimmed.startsWith('{')) {
                    return;
                }
                try {
                    const parsed = JSON.parse(trimmed) as JsonValue;
                    if (parsed && typeof parsed === 'object') {
                        events.push(parsed as EventRecord);
                    }
                } catch (_) {
                    // ignore
                }
            });
        }
    })();
}

async function waitForProcessExit(proc: ReturnType<typeof Bun.spawn>, timeoutMs = 4000) {
    return new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for server exit')), timeoutMs);
        proc.exited
            .then((code) => {
                clearTimeout(timeout);
                resolve(code);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(error instanceof Error ? error : new Error(String(error)));
            });
    });
}

let proc: ReturnType<typeof Bun.spawn> | null = null;
let configPath: string | null = null;
let mapPath: string | null = null;

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

    if (mapPath) {
        try {
            await Bun.file(mapPath).delete();
        } catch (_) {
            // ignore
        } finally {
            mapPath = null;
        }
    }
});

test('server fails fast with structured config-invalid event when config preflight fails', async () => {
    configPath = `${repoRoot}/server/.tmp-config.invalid-preflight.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port: 0,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/world.json',
            metrics_enabled: false,
        })
    );

    const events: EventRecord[] = [];
    const stderrLines: string[] = [];

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    startStructuredLogCapture(proc.stdout, events);
    startStructuredLogCapture(proc.stderr, events, stderrLines);

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);

    const invalidEvent = events.find((eventRecord) => eventRecord.event === 'server.config.invalid');
    const hasPreflightMessage = stderrLines.some((line) =>
        line.includes('Startup preflight: invalid server configuration')
    );
    expect(Boolean(invalidEvent) || hasPreflightMessage).toBe(true);
});

test('server fails fast when startup preflight cannot read configured map file', async () => {
    configPath = `${repoRoot}/server/.tmp-config.invalid-map-missing.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port: 8000,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/does-not-exist.json',
            metrics_enabled: false,
        })
    );

    const stderrLines: string[] = [];
    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    startStructuredLogCapture(proc.stderr, [], stderrLines);

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);
    expect(stderrLines.some((line) => line.includes('Startup preflight: map file missing or unreadable:'))).toBe(true);
});

test('server fails fast when startup preflight reads map JSON with invalid payload shape', async () => {
    mapPath = `${repoRoot}/server/.tmp-map.invalid-shape.json`;
    await Bun.write(mapPath, JSON.stringify({ width: 1 }));

    configPath = `${repoRoot}/server/.tmp-config.invalid-map-shape.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port: 8000,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: mapPath,
            metrics_enabled: false,
        })
    );

    const stderrLines: string[] = [];
    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    startStructuredLogCapture(proc.stderr, [], stderrLines);

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);
    expect(stderrLines.some((line) => line.includes('Startup preflight: map file contains invalid map payload:'))).toBe(true);
});
