import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';
import WebSocket from 'ws';

const repoRoot = new URL('../..', import.meta.url).pathname;

async function getFreePort() {
    return await new Promise<number>((resolve, reject) => {
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
    // eslint-disable-next-line no-constant-condition
    while (true) {
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
    try {
        proc?.kill();
    } catch (_) {
        // ignore
    } finally {
        proc = null;
    }
});

test("esm server entry with websocket bridge probe sends initial 'go' handshake", async () => {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.test-esm-ws-bridge-${port}.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port,
            debug_level: 'error',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './server/maps/world_server.json',
            metrics_enabled: false,
        })
    );

    proc = Bun.spawn({
        cmd: ['bun', 'server/js/main-esm.mjs', configPath],
        cwd: repoRoot,
        env: {
            ...process.env,
            BQ_ESM_WS_BRIDGE_PROBE: '1',
        },
        stdout: 'ignore',
        stderr: 'pipe',
    });

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
    const message = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for handshake')), 3000);
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        ws.once('message', (data) => {
            clearTimeout(timeout);
            resolve(data.toString());
            try {
                ws.close();
            } catch (_) {
                // ignore
            }
        });
    });

    expect(message).toBe('go');
    await Bun.file(configPath).delete();
});
