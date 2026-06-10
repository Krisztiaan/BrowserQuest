import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../../support/process-cleanup';
import WebSocket from '../../support/ws-client';
import {
    getFreePort,
    readStreamText,
    startStructuredLogCapture,
    waitForCondition,
    waitForHttpOk,
    waitForProcessExit,
    waitForStringMessage,
    type StructuredEventRecord,
} from '../../support/server-harness';

const repoRoot = new URL('../../..', import.meta.url).pathname;

let proc: ReturnType<typeof Bun.spawn> | null = null;

afterEach(async () => {
    await killBunProcess(proc);
    proc = null;
});

test("server entry with websocket bridge probe sends initial 'go' handshake", async () => {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.test-runtime-ws-bridge-${port}.json`;
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
        env: {
            ...process.env,
            BQ_WS_BRIDGE_PROBE: '1',
        },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    startStructuredLogCapture(proc.stdout, events);

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);
    await waitForCondition(
        () =>
            events.some(
                (eventRecord) => eventRecord.event === 'server.runtime.ws_bridge_probe' && eventRecord.status === 'ok'
            ),
        4000,
        'runtime websocket bridge probe success event'
    );

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const message = await waitForStringMessage(ws, 3000);

    expect(message).toBe('go');
    ws.close();
    await Bun.file(configPath).delete();
});

test('server entry websocket bridge probe fails fast with structured failure signal', async () => {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.test-runtime-ws-bridge-fail-${port}.json`;
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
        env: {
            ...process.env,
            BQ_WS_BRIDGE_PROBE: '1',
            BQ_WS_BRIDGE_PROBE_FORCE_FAIL: '1',
        },
        stdout: 'pipe',
        stderr: 'pipe',
    });

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);

    const [stdoutText, stderrText] = await Promise.all([readStreamText(proc.stdout), readStreamText(proc.stderr)]);
    const merged = `${stdoutText}\n${stderrText}`;
    expect(merged).toContain('"event":"server.runtime.ws_bridge_probe"');
    expect(merged).toContain('"status":"failed"');
    expect(merged).toContain('"reason":"forced_failure"');

    await Bun.file(configPath).delete();
});
