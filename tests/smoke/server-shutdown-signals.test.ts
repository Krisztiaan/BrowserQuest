import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../support/process-cleanup';
import { getFreePort, waitForHttpOk, waitForProcessExit } from '../support/server-harness';

const repoRoot = new URL('../..', import.meta.url).pathname;

let proc: ReturnType<typeof Bun.spawn> | null = null;

afterEach(async () => {
    await killBunProcess(proc);
    proc = null;
});

async function runSignalShutdownScenario(signal: 'SIGTERM' | 'SIGINT') {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.shutdown-${signal}-${port}.json`;

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

    try {
        proc = Bun.spawn({
            cmd: ['bun', 'server/entry.ts', configPath],
            cwd: repoRoot,
            stdout: 'ignore',
            stderr: 'pipe',
        });

        await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);

        proc.kill(signal);
        const exitCode = await waitForProcessExit(proc, 5000);
        expect(exitCode).toBe(0);
        proc = null;
    } finally {
        try {
            await Bun.file(configPath).delete();
        } catch (_) {
            // ignore
        }
    }
}

test('server performs controlled shutdown on SIGTERM and SIGINT', async () => {
    await runSignalShutdownScenario('SIGTERM');
    await runSignalShutdownScenario('SIGINT');
});
