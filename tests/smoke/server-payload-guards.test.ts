import { expect, test } from 'bun:test';
import WebSocket from '../support/ws-client';
import { ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1, MSG_HELLO, MSG_MOVE } from '../support/protocol/contract';
import WsCloseCodes from '../../shared/ws-close-codes';
import { killBunProcess } from '../support/process-cleanup';
import {
    deleteFileIfExists,
    getFreePort,
    waitForGoHandshake,
    waitForHttpOk,
    waitForWebSocketClose,
} from '../support/server-harness';

const repoRoot = new URL('../..', import.meta.url).pathname;
const CLOSE_INVALID_PAYLOAD = WsCloseCodes.INVALID_PAYLOAD;

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
        await deleteFileIfExists(server.configPath);
    }
}

test('rejects HELLO payload with oversized UTF-8 name', async () => {
    await withServer(async (server) => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
        await waitForGoHandshake(ws);

        const oversizedName = '🚀'.repeat(40); // 160 bytes in UTF-8
        ws.send(JSON.stringify([MSG_HELLO, oversizedName, ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));

        const closed = await waitForWebSocketClose(ws);
        expect(ws.readyState).toBe(WebSocket.CLOSED);
        expect(closed.code).toBe(CLOSE_INVALID_PAYLOAD);
    });
});

test('rejects MOVE payload containing non-integer coordinates', async () => {
    await withServer(async (server) => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
        await waitForGoHandshake(ws);

        ws.send(JSON.stringify([MSG_HELLO, 'guarded', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));
        ws.send(JSON.stringify([MSG_MOVE, 10.5, 7]));

        const closed = await waitForWebSocketClose(ws, 15000);
        expect(ws.readyState).toBe(WebSocket.CLOSED);
        expect(closed.code).toBe(CLOSE_INVALID_PAYLOAD);
    });
});
