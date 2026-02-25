import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../../support/process-cleanup';
import WebSocket from '../../support/ws-client';
import { getFreePort, waitForHttpOk, waitForStringMessage } from '../../support/server-harness';

const repoRoot = new URL('../../..', import.meta.url).pathname;

let proc: ReturnType<typeof Bun.spawn> | null = null;

afterEach(async () => {
    await killBunProcess(proc);
    proc = null;
});

test("server entry sends initial 'go' handshake", async () => {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.test-runtime-${port}.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port,
            debug_level: 'error',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/runtime/map-pack.json',
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

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const message = await waitForStringMessage(ws, 3000);

    expect(message).toBe('go');
    ws.close();
    await Bun.file(configPath).delete();
});
