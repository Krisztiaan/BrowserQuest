import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../../support/process-cleanup';
import WebSocket from '../../support/ws-client';
import {
    getFreePort,
    startStructuredLogCapture,
    waitForCondition,
    waitForHttpOk,
    waitForStringMessage,
    type StructuredEventRecord,
} from '../../support/server-harness';

const repoRoot = new URL('../../..', import.meta.url).pathname;

let proc: ReturnType<typeof Bun.spawn> | null = null;

afterEach(async () => {
    await killBunProcess(proc);
    proc = null;
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
            map_filepath: './assets/maps/tiled/map-pack.config.json',
            metrics_enabled: false,
        })
    );

    const events: StructuredEventRecord[] = [];
    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    startStructuredLogCapture(proc.stdout, events);

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
    const message = await waitForStringMessage(ws, 3000);

    expect(message).toBe('go');
    ws.close();
    await Bun.file(configPath).delete();
});
