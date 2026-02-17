import net from 'node:net';
import { expect, test } from 'bun:test';
import WebSocket from '../support/ws-client';
import { ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1, MSG_HELLO, MSG_MOVE } from '../support/protocol/contract';
import WsCloseCodes from '../../shared/ws-close-codes';
import { killBunProcess } from '../support/process-cleanup';

const repoRoot = new URL('../..', import.meta.url).pathname;
const CLOSE_INVALID_PAYLOAD = WsCloseCodes.INVALID_PAYLOAD;

function getFreePort() {
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

async function waitForHttpOk(url: string, timeoutMs = 25000) {
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

async function waitForGo(ws: WebSocket, timeoutMs = 8000) {
    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for go')), timeoutMs);

        ws.on('message', (data) => {
            if (typeof data === 'string' && data === 'go') {
                clearTimeout(timeout);
                resolve();
            }
        });
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
}

async function waitForClose(ws: WebSocket, timeoutMs = 3000) {
    return new Promise<{ code: number; reason: string }>((resolve, reject) => {
        if (ws.readyState === WebSocket.CLOSED) {
            resolve({ code: WebSocket.CLOSED, reason: '' });
            return;
        }

        const timeout = setTimeout(() => reject(new Error('Timed out waiting for close')), timeoutMs);
        ws.once('close', (closeEvent) => {
            clearTimeout(timeout);
            const eventRecord = closeEvent as { code?: number; reason?: string };
            resolve({
                code: typeof eventRecord.code === 'number' ? eventRecord.code : WebSocket.CLOSED,
                reason: typeof eventRecord.reason === 'string' ? eventRecord.reason : '',
            });
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
            map_filepath: './assets/maps/tiled/world.json',
            metrics_enabled: false,
        })
    );

    const proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'ignore',
        stderr: 'pipe',
    });

    await waitForHttpOk(`http://127.0.0.1:${port}/status`);
    return { configPath, port, proc };
}

async function withServer(run: (server: RunningServer) => Promise<void>): Promise<void> {
    const server = await startServer();
    try {
        await run(server);
    } finally {
        await killBunProcess(server.proc);
        try {
            await Bun.file(server.configPath).delete();
        } catch (_) {
            // ignore
        }
    }
}

test('rejects HELLO payload with oversized UTF-8 name', async () => {
    await withServer(async (server) => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
        await waitForGo(ws);

        const oversizedName = '🚀'.repeat(40); // 160 bytes in UTF-8
        ws.send(JSON.stringify([MSG_HELLO, oversizedName, ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));

        const closed = await waitForClose(ws);
        expect(ws.readyState).toBe(WebSocket.CLOSED);
        expect(closed.code).toBe(CLOSE_INVALID_PAYLOAD);
    });
});

test('rejects MOVE payload containing non-integer coordinates', async () => {
    await withServer(async (server) => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
        await waitForGo(ws);

        ws.send(JSON.stringify([MSG_HELLO, 'guarded', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));
        ws.send(JSON.stringify([MSG_MOVE, 10.5, 7]));

        const closed = await waitForClose(ws, 15000);
        expect(ws.readyState).toBe(WebSocket.CLOSED);
        expect(closed.code).toBe(CLOSE_INVALID_PAYLOAD);
    });
});
