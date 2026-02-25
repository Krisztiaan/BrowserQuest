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

async function runHandshakeScenario(config: {
    port: number;
    debug_level: string;
    nb_players_per_world: number;
    nb_worlds: number;
    map_filepath: string;
    metrics_enabled: boolean;
    memcached_host?: string;
    memcached_port?: number;
    server_name?: string;
    game_servers?: Array<{ name: string }>;
}) {
    const configPath = `${repoRoot}/server/.tmp-config.test-${config.port}.json`;
    await Bun.write(configPath, JSON.stringify(config));

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'ignore',
        stderr: 'pipe',
    });

    await waitForHttpOk(`http://127.0.0.1:${config.port}/status`, 8000);

    const ws = new WebSocket(`ws://127.0.0.1:${config.port}/ws`);
    const message = await waitForStringMessage(ws, 3000);

    expect(message).toBe('go');
    ws.close();
    await Bun.file(configPath).delete();
}

test("server sends initial 'go' handshake", async () => {
    const port = await getFreePort();

    await runHandshakeScenario({
        port,
        debug_level: 'error',
        nb_players_per_world: 5,
        nb_worlds: 1,
        map_filepath: './assets/maps/runtime/map-pack.json',
        metrics_enabled: false,
    });
});

test('server keeps handshake path when metrics are enabled but adapter is unavailable', async () => {
    const port = await getFreePort();

    await runHandshakeScenario({
        port,
        debug_level: 'error',
        nb_players_per_world: 5,
        nb_worlds: 1,
        map_filepath: './assets/maps/runtime/map-pack.json',
        metrics_enabled: true,
        memcached_host: '127.0.0.1',
        memcached_port: 11211,
        server_name: 'local',
        game_servers: [{ name: 'local' }],
    });
});

test('server keeps handshake path when metrics are enabled with invalid metrics config', async () => {
    const port = await getFreePort();

    await runHandshakeScenario({
        port,
        debug_level: 'error',
        nb_players_per_world: 5,
        nb_worlds: 1,
        map_filepath: './assets/maps/runtime/map-pack.json',
        metrics_enabled: true,
    });
});
