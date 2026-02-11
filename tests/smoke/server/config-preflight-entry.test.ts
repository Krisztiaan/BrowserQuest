import { afterEach, expect, test } from 'bun:test';

const repoRoot = new URL('../../..', import.meta.url).pathname;

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

async function readStreamText(stream: ReadableStream<Uint8Array> | number | null | undefined) {
    if (!stream || typeof stream === 'number') {
        return '';
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value);
    }

    return output;
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

test('server entry fails fast with preflight error for invalid config', async () => {
    configPath = `${repoRoot}/server/.tmp-config.invalid-preflight-runtime.json`;
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

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);

    const [stdoutText, stderrText] = await Promise.all([readStreamText(proc.stdout), readStreamText(proc.stderr)]);
    expect(`${stdoutText}\n${stderrText}`).toContain('Startup preflight: invalid server configuration:');
});
