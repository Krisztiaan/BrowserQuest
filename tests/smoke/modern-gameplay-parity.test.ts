import { afterEach, expect, test } from 'bun:test';
import WebSocket from '../support/ws-client';
import { killBunProcess } from '../support/process-cleanup';
import { formatUnknown } from '../support/format';
import {
    deleteFileIfExists,
    getFreePort,
    waitForGoHandshake,
    waitForHttpOk,
    waitForWebSocketClose,
} from '../support/server-harness';
import {
    ENTITY_CLOTH_ARMOR,
    ENTITY_SWORD_1,
    MSG_ATTACK,
    MSG_CHAT,
    MSG_DAMAGE,
    MSG_HELLO,
    MSG_INTENT,
    MSG_LIST,
    MSG_LOOTMOVE,
    MSG_SPAWN,
    MSG_WELCOME,
    MSG_WHO,
    MSG_ZONE,
    type ProtocolAction,
} from '../support/protocol/contract';
import {
    decodeServerToClientProtocolActionBatchBinary,
    encodeProtocolActionBinary,
} from '../../shared/protocol/registry';
import { encodeMoveStepIntentPayload } from '../../shared/protocol/intents';

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

type FramePayload =
    | string
    | ArrayBuffer
    | ArrayBufferView
    | ReadonlyArray<Action | number | string | boolean | null | undefined | object>
    | object
    | null
    | undefined;

function isActionArray(value: unknown): value is Action {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'number';
}

function normalizePayloadToActions(payload: FramePayload): Action[] {
    if (Array.isArray(payload)) {
        if (payload.length > 0 && Array.isArray(payload[0])) {
            return payload.filter((entry): entry is Action => isActionArray(entry));
        }
        return isActionArray(payload) ? [payload] : [];
    }

    if (typeof payload === 'string') {
        return [];
    }
    if (payload instanceof ArrayBuffer) {
        return decodeServerToClientProtocolActionBatchBinary(payload).filter((entry): entry is Action => isActionArray(entry));
    }
    if (ArrayBuffer.isView(payload)) {
        const view = payload;
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        return decodeServerToClientProtocolActionBatchBinary(bytes).filter((entry): entry is Action => isActionArray(entry));
    }
    void formatUnknown(payload);
    return [];
}

function isSafeInteger(value: number | string | boolean | null | undefined | object): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value);
}

function createActionStream(ws: WebSocket): ActionStream {
    const stream: ActionStream = {
        actions: [],
        cursor: 0,
        closed: false,
    };

    ws.on('message', (data) => {
        if (typeof data === 'string' && data === 'go') {
            return;
        }
        try {
            const actions = normalizePayloadToActions(data);
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
    timeoutMs = 10000
) {
    const startedAt = Date.now();

    for (;;) {
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

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);
    return { configPath, port, proc };
}

let server: RunningServer | null = null;

afterEach(async () => {
    await killBunProcess(server?.proc);
    await deleteFileIfExists(server?.configPath);
    server = null;
});

test(
    'modern gameplay protocol parity: login, move, chat, zone, combat path, lootmove, reconnect',
    async () => {
        server = await startServer();

        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
        const stream = createActionStream(ws);
        await waitForGoHandshake(ws);

        ws.send(encodeProtocolActionBinary([MSG_HELLO, 'modern-e2e', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));
        const welcome = await waitForNextAction(stream, (action) => action[0] === MSG_WELCOME, 'WELCOME', 120000);
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
            ws.send(encodeProtocolActionBinary([MSG_WHO, ...nearbyEntityIds.slice(0, 30)]));
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

        const movePayload = encodeMoveStepIntentPayload({ x: playerX, y: playerY });
        if (movePayload === null) {
            throw new Error('Failed to encode move.step payload');
        }
        ws.send(encodeProtocolActionBinary([MSG_INTENT, 1, 'move.step', movePayload]));
        await ensureSocketOpen(ws);

        const chatMessage = 'modern-e2e-chat';
        ws.send(encodeProtocolActionBinary([MSG_CHAT, chatMessage]));
        await ensureSocketOpen(ws);

        ws.send(encodeProtocolActionBinary([MSG_ZONE]));
        await ensureSocketOpen(ws);

        if (combatTargetId !== null) {
            ws.send(encodeProtocolActionBinary([MSG_ATTACK, combatTargetId]));
            for (let i = 0; i < 6; i += 1) {
                ws.send(encodeProtocolActionBinary([MSG_ATTACK, combatTargetId]));
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

            ws.send(encodeProtocolActionBinary([MSG_LOOTMOVE, playerX, playerY, combatTargetId]));
            await ensureSocketOpen(ws);
        }

        ws.close();
        await waitForWebSocketClose(ws);

        const reconnect = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
        const reconnectStream = createActionStream(reconnect);
        await waitForGoHandshake(reconnect);
        reconnect.send(encodeProtocolActionBinary([MSG_HELLO, 'modern-e2e-reconnect', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1]));
        await waitForNextAction(
            reconnectStream,
            (action) => action[0] === MSG_WELCOME,
            'WELCOME after reconnect',
            120000
        );
        expect(reconnect.readyState).toBe(WebSocket.OPEN);
        reconnect.close();
        await waitForWebSocketClose(reconnect);
    },
    { timeout: 180_000 }
);
