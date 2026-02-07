import { afterEach, expect, test } from 'bun:test';

const repoRoot = new URL('../..', import.meta.url).pathname;

type EventRecord = Record<string, unknown>;

function startStructuredLogCapture(stream: ReadableStream<Uint8Array> | null | undefined, events: EventRecord[]) {
    const reader = stream?.getReader();
    if (!reader) {
        return;
    }

    (async () => {
        let carry = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            carry += new TextDecoder().decode(value);
            const chunks = carry.split('\n');
            carry = chunks.pop() || '';
            chunks.forEach((line) => {
                const trimmed = line.trim();
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

    proc = Bun.spawn({
        cmd: ['bun', 'server/js/main.js', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    startStructuredLogCapture(proc.stdout, events);
    startStructuredLogCapture(proc.stderr, events);

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);

    const invalidEvent = events.find((eventRecord) => eventRecord.event === 'server.config.invalid');
    expect(invalidEvent).toBeDefined();

    const errors = (invalidEvent?.errors || []) as Array<{ field?: string; reason?: string }>;
    expect(errors.some((error) => error.field === 'port')).toBe(true);
});
