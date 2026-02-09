import { afterEach, expect, test } from 'bun:test';

const repoRoot = new URL('../..', import.meta.url).pathname;

type EventRecord = Record<string, unknown>;

function startStructuredLogCapture(
    stream: ReadableStream<unknown> | number | null | undefined,
    events: EventRecord[],
    rawLines?: string[]
) {
    if (!stream || typeof stream === 'number') {
        return;
    }

    const reader = stream.getReader();
    if (!reader) {
        return;
    }

    (async () => {
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
                if (rawLines && trimmed) {
                    rawLines.push(trimmed);
                }
                if (!trimmed || !trimmed.startsWith('{')) {
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

async function waitForProcessExit(proc: ReturnType<typeof Bun.spawn>, timeoutMs = 4000) {
    return await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for server exit')), timeoutMs);
        proc.exited
            .then((code) => {
                clearTimeout(timeout);
                resolve(code);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}

let proc: ReturnType<typeof Bun.spawn> | null = null;
let configPath: string | null = null;

afterEach(async () => {
    try {
        proc?.kill();
    } catch (_) {
        // ignore
    } finally {
        proc = null;
    }

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

test('server fails fast with structured config-invalid event when config preflight fails', async () => {
    configPath = `${repoRoot}/server/.tmp-config.invalid-preflight.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port: 0,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './server/maps/world_server.json',
            metrics_enabled: false,
        })
    );

    const events: EventRecord[] = [];
    const stderrLines: string[] = [];

    proc = Bun.spawn({
        cmd: ['bun', 'server/js/main-esm.ts', configPath],
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
        line.includes('ESM preflight: invalid server configuration')
    );
    expect(Boolean(invalidEvent) || hasPreflightMessage).toBe(true);
});
