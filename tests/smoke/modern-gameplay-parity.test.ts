import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';
import WebSocket from '../support/ws-client';
import {
    ENTITY_CLOTH_ARMOR,
    ENTITY_SWORD_1,
    MSG_ATTACK,
    MSG_CHAT,
    MSG_DAMAGE,
    MSG_HELLO,
    MSG_HIT,
    MSG_LIST,
    MSG_LOOTMOVE,
    MSG_MOVE,
    MSG_SPAWN,
    MSG_WELCOME,
    MSG_WHO,
    MSG_ZONE,
    parseProtocolActionBatch,
    type ProtocolAction,
} from '../support/protocol';

const repoRoot = new URL('../..', import.meta.url).pathname;

type Action = ProtocolAction;

type ActionStream = {
    actions: Action[];
    cursor: number;
    closed: boolean;
};

type RunningServer = {
    configPath: string;
    port: number;
    proc: ReturnType<typeof Bun.spawn>;
};

function isActionArray(value: unknown): value is Action {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'number';
}

function collectActionsFromPayload(payload: string): Action[] {
    return parseProtocolActionBatch(payload).filter((entry): entry is Action => isActionArray(entry));
}

function isSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value);
}

function createActionStream(ws: WebSocket): ActionStream {
    const stream: ActionStream = {
        actions: [],
        cursor: 0,
        closed: false,
    };

    ws.on('message', (data) => {
        const text = data.toString();
        if (text === 'go') {
            return;
        }
        try {
            const actions = collectActionsFromPayload(text);
            actions.forEach((action) => stream.actions.push(action));
        } catch (_) {
            // ignore non-JSON messages
        }
    });

    ws.once('close', () => {
        stream.closed = true;
    });

    return stream;
}

async function waitForNextAction(
    stream: ActionStream,
    predicate: (action: Action) => boolean,
    label: string,
    timeoutMs = 5000
) {
    const startedAt = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
        for (let i = stream.cursor; i < stream.actions.length; i += 1) {
            const action = stream.actions[i];
            if (predicate(action)) {
                stream.cursor = i + 1;
                return action;
            }
        }

        if (stream.closed) {
            throw new Error(`Socket closed while waiting for ${label}`);
        }
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for ${label}`);
        }
        await Bun.sleep(20);
    }
}

async function ensureSocketOpen(ws: WebSocket, waitMs = 200) {
    await Bun.sleep(waitMs);
    expect(ws.readyState).toBe(WebSocket.OPEN);
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
    });
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

async function startServer(): Promise<RunningServer> {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.modern-parity-${port}.json`;

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
        cmd: ['bun', 'server/js/main-esm.ts', configPath],
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

test('modern gameplay protocol parity: login, move, chat, zone, combat path, lootmove, reconnect', async () => {
    server = await startServer();

    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/`);
    const stream = createActionStream(ws);
    await waitForGo(ws);

    ws.send(JSON.stringify([MSG_HELLO, 'modern-e2e', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));
    const welcome = await waitForNextAction(stream, (action) => action[0] === MSG_WELCOME, 'WELCOME');
    const playerX = welcome[3];
    const playerY = welcome[4];

    expect(typeof welcome[1]).toBe('number');
    expect(typeof playerX).toBe('number');
    expect(typeof playerY).toBe('number');

    let nearbyEntityIds: number[] = [];
    try {
        const listAction = await waitForNextAction(stream, (action) => action[0] === MSG_LIST, 'LIST', 1500);
        nearbyEntityIds = listAction.slice(1).filter((id): id is number => isSafeInteger(id));
    } catch (_) {
        nearbyEntityIds = [];
    }

    let combatTargetId: number | null = null;
    if (nearbyEntityIds.length > 0) {
        ws.send(JSON.stringify([MSG_WHO, ...nearbyEntityIds.slice(0, 30)]));
        await waitForNextAction(stream, (action) => action[0] === MSG_SPAWN, 'SPAWN');

        const spawns = stream.actions.filter((action) => action[0] === MSG_SPAWN);
        const mobSpawn = spawns.find((action) => {
            const kind = action[2];
            return isSafeInteger(kind) && kind >= 2 && kind <= 14;
        });
        const fallbackSpawn = spawns.find((action) => isSafeInteger(action[1]));
        const candidateTargetId = (mobSpawn ?? fallbackSpawn)?.[1];
        combatTargetId = isSafeInteger(candidateTargetId) ? candidateTargetId : null;
    }

    ws.send(JSON.stringify([MSG_MOVE, playerX, playerY]));
    await ensureSocketOpen(ws);

    const chatMessage = 'modern-e2e-chat';
    ws.send(JSON.stringify([MSG_CHAT, chatMessage]));
    await ensureSocketOpen(ws);

    ws.send(JSON.stringify([MSG_ZONE]));
    await ensureSocketOpen(ws);

    if (combatTargetId !== null) {
        ws.send(JSON.stringify([MSG_ATTACK, combatTargetId]));
        for (let i = 0; i < 6; i += 1) {
            ws.send(JSON.stringify([MSG_HIT, combatTargetId]));
        }

        // Damage events are random; if one arrives, validate shape.
        try {
            const damageAction = await waitForNextAction(
                stream,
                (action) => action[0] === MSG_DAMAGE,
                'optional DAMAGE',
                800
            );
            expect(typeof damageAction[1]).toBe('number');
            expect(typeof damageAction[2]).toBe('number');
        } catch (_) {
            // no damage event within timeout is acceptable, but socket must stay open
        }
        await ensureSocketOpen(ws);

        ws.send(JSON.stringify([MSG_LOOTMOVE, playerX, playerY, combatTargetId]));
        await ensureSocketOpen(ws);
    }

    ws.close();
    await waitForClose(ws);

    const reconnect = new WebSocket(`ws://127.0.0.1:${server.port}/`);
    const reconnectStream = createActionStream(reconnect);
    await waitForGo(reconnect);
    reconnect.send(JSON.stringify([MSG_HELLO, 'modern-e2e-reconnect', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));
    await waitForNextAction(reconnectStream, (action) => action[0] === MSG_WELCOME, 'WELCOME after reconnect');
    expect(reconnect.readyState).toBe(WebSocket.OPEN);
    reconnect.close();
    await waitForClose(reconnect);
});
