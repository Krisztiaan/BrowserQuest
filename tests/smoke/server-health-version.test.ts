import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../support/process-cleanup';
import { getFreePort, waitForHttpOk } from '../support/server-harness';

const repoRoot = new URL('../..', import.meta.url).pathname;

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

test('server exposes stable /healthz and /version probe contracts', async () => {
    const port = await getFreePort();
    configPath = `${repoRoot}/server/.tmp-config.probes-${port}.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port,
            debug_level: 'error',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/map-pack.config.json',
            metrics_enabled: false,
        })
    );

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'ignore',
        stderr: 'pipe',
    });

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);

    const healthzResponse = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(healthzResponse.status).toBe(200);
    const healthzBody = (await healthzResponse.json()) as { status?: string };
    expect(healthzBody.status).toBe('ok');

    const versionResponse = await fetch(`http://127.0.0.1:${port}/version`);
    expect(versionResponse.status).toBe(200);
    const versionBody = (await versionResponse.json()) as { version?: string };
    expect(typeof versionBody.version).toBe('string');
    expect((versionBody.version ?? '').length).toBeGreaterThan(0);
});
