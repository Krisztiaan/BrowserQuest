import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../../support/process-cleanup';
import WebSocket from '../../support/ws-client';

const repoRoot = new URL('../../..', import.meta.url).pathname;

async function getFreePort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close(() => reject(new Error('Unable to allocate port')));
                return;
            }
            const port = address.port;
            server.close((err) => (err ? reject(err) : resolve(port)));
        });
    });
}

async function waitForHttpOk(url: string, timeoutMs = 5000) {
    const start = Date.now();

    for (;;) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch (_) {
            // ignore until timeout
        }

        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for ${url}`);
        }
        await Bun.sleep(50);
    }
}

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
    const message = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for handshake')), 3000);
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err instanceof Error ? err : new Error(String(err)));
        });
        ws.once('message', (data) => {
            clearTimeout(timeout);
            if (typeof data !== 'string') {
                reject(new Error(`Expected string handshake, got ${typeof data}`));
                return;
            }
            resolve(data);
            try {
                ws.close();
            } catch (_) {
                // ignore
            }
        });
    });

    expect(message).toBe('go');
    await Bun.file(configPath).delete();
}

test("server sends initial 'go' handshake", async () => {
    const port = await getFreePort();

    await runHandshakeScenario({
        port,
        debug_level: 'error',
        nb_players_per_world: 5,
        nb_worlds: 1,
        map_filepath: './assets/maps/tiled/world.json',
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
        map_filepath: './assets/maps/tiled/world.json',
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
        map_filepath: './assets/maps/tiled/world.json',
        metrics_enabled: true,
    });
});
