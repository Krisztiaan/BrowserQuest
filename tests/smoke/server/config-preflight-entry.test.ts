import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../../support/process-cleanup';

const repoRoot = new URL('../../..', import.meta.url).pathname;

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

async function readStreamText(stream: ReadableStream<Uint8Array> | number | null | undefined) {
    if (!stream || typeof stream === 'number') {
        return '';
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value);
    }

    return output;
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

test('server entry fails fast when configured map JSON is invalid', async () => {
    mapPath = `${repoRoot}/server/.tmp-map.invalid-json.json`;
    await Bun.write(mapPath, '{bad json');

    configPath = `${repoRoot}/server/.tmp-config.invalid-map-json-runtime.json`;
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

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);

    const [stdoutText, stderrText] = await Promise.all([readStreamText(proc.stdout), readStreamText(proc.stderr)]);
    expect(`${stdoutText}\n${stderrText}`).toContain('Startup preflight: map file contains invalid JSON:');
});

test('server entry fails fast when configured map payload shape is invalid', async () => {
    mapPath = `${repoRoot}/server/.tmp-map.invalid-shape.json`;
    await Bun.write(mapPath, JSON.stringify({ width: 1 }));

    configPath = `${repoRoot}/server/.tmp-config.invalid-map-shape-runtime.json`;
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

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);

    const [stdoutText, stderrText] = await Promise.all([readStreamText(proc.stdout), readStreamText(proc.stderr)]);
    expect(`${stdoutText}\n${stderrText}`).toContain('Startup preflight: map file contains invalid map payload:');
});
