import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';
import WebSocket from 'ws';
import { ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1, MSG_HELLO, MSG_MOVE } from '../support/protocol';

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

async function waitForGo(ws: WebSocket, timeoutMs = 3000) {
    return await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for go')), timeoutMs);

        ws.on('message', (data) => {
            if (data.toString() === 'go') {
                clearTimeout(timeout);
                resolve();
            }
        });
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function waitForAnyJsonMessage(ws: WebSocket, timeoutMs = 3000) {
    return await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for JSON message')), timeoutMs);

        ws.on('message', (data) => {
            const text = data.toString();
            if (text === 'go') {
                return;
            }
            try {
                JSON.parse(text);
                clearTimeout(timeout);
                resolve();
            } catch (_) {
                // ignore non-JSON messages
            }
        });
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function waitForClose(ws: WebSocket, timeoutMs = 3000) {
    return await new Promise<void>((resolve, reject) => {
        if (ws.readyState === WebSocket.CLOSED) {
            resolve();
            return;
        }

        const timeout = setTimeout(() => reject(new Error('Timed out waiting for close')), timeoutMs);
        ws.once('close', () => {
            clearTimeout(timeout);
            resolve();
        });
        ws.once('error', () => {
            // close is expected shortly after protocol rejection
        });
    });
}

type RunningServer = {
    configPath: string;
    port: number;
    proc: ReturnType<typeof Bun.spawn>;
};

async function startServer(): Promise<RunningServer> {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.payload-${port}.json`;

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

    const proc = Bun.spawn({
        cmd: ['bun', 'server/js/main.js', configPath],
        cwd: repoRoot,
        stdout: 'ignore',
        stderr: 'pipe',
    });

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);
    return { configPath, port, proc };
}

let server: RunningServer | null = null;

afterEach(async () => {
    try {
        server?.proc.kill();
    } catch (_) {
        // ignore
    }
    if (server) {
        try {
            await Bun.file(server.configPath).delete();
        } catch (_) {
            // ignore
        }
    }
    server = null;
});

test('rejects HELLO payload with oversized UTF-8 name', async () => {
    server = await startServer();

    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/`);
    await waitForGo(ws);

    const oversizedName = '🚀'.repeat(40); // 160 bytes in UTF-8
    ws.send(JSON.stringify([MSG_HELLO, oversizedName, ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));

    await waitForClose(ws);
    expect(ws.readyState).toBe(WebSocket.CLOSED);
});

test('rejects MOVE payload containing non-integer coordinates', async () => {
    server = await startServer();

    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/`);
    await waitForGo(ws);

    ws.send(JSON.stringify([MSG_HELLO, 'guarded', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));
    await waitForAnyJsonMessage(ws);

    ws.send(JSON.stringify([MSG_MOVE, 10.5, 7]));

    await waitForClose(ws);
    expect(ws.readyState).toBe(WebSocket.CLOSED);
});
