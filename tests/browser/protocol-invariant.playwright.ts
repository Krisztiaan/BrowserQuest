import { expect, test, type Page } from '@playwright/test';
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { MSG_CHAT, MSG_HELLO, MSG_WELCOME, MSG_ZONE } from '../support/protocol/contract';
import SharedProtocol from '../../shared/protocol/contract';
import Types from '../../shared/gametypes-browser';
import {
    createChatAction,
    createHelloAction,
    createIntentAction,
    createZoneAction,
} from '../../client/gameclient-outbound-actions';
import { encodeClientToServerBinaryActionBatchPayload } from '../../shared/protocol/binary-action-codec';
import { decodeServerToClientProtocolActionBatchBinary } from '../../shared/protocol/registry';
import { encodeMoveStepIntentPayload, INTENT_MOVE_STEP } from '../../shared/protocol/intents';
import { gridPos } from '../../shared/domain/positions';

const MSG_REJECT = SharedProtocol.MSG_REJECT;

type ReplayMode = 'positive' | 'invalid_move';

type ReplayTranscript = {
    sent: number[];
    received: Array<number | 'go'>;
    goCount: number;
    welcomeCount: number;
    echoedChatCount: number;
    rejectCount: number;
    stayedOpenAfterMoveZone: boolean;
    sentInvalidMove: boolean;
    stayedOpenAfterInvalidMove: boolean;
    errors: string[];
};

type ReplayResult = {
    ok: boolean;
    reason?: string;
    transcript: ReplayTranscript;
};

type MapCollisions = { width: number; blocked: Set<number> };

let cachedCollisions: MapCollisions | null = null;

function loadWorldCollisions(): MapCollisions {
    if (cachedCollisions) {
        return cachedCollisions;
    }
    const packPath = path.resolve(process.cwd(), 'assets/maps/runtime/map-pack.json');
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf8')) as {
        maps: Array<{ server: { width: number; collisions: number[] } }>;
    };
    const server = pack.maps[0]?.server;
    if (!server) {
        throw new Error('map-pack.json has no maps');
    }
    cachedCollisions = { width: server.width, blocked: new Set(server.collisions) };
    return cachedCollisions;
}

function pickFreeAdjacentTile(x: number, y: number): { x: number; y: number } | null {
    const { width, blocked } = loadWorldCollisions();
    const candidates = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
    ];
    for (const tile of candidates) {
        if (tile.x >= 0 && tile.y >= 0 && !blocked.has(tile.y * width + tile.x)) {
            return tile;
        }
    }
    return null;
}

/**
 * Replays the canonical session bootstrap over the live binary wire:
 * go -> HELLO -> WELCOME -> CHAT/move.step/ZONE -> chat echo, asserting the
 * socket survives. The invalid_move mode streams a teleport-sized move.step,
 * which the modern protocol answers with REJECT while keeping the session
 * open (legacy servers dropped the connection; the resilient-session
 * behavior is the invariant now).
 */
async function replaySequence(page: Page, entryPath: '/', suffix: string, mode: ReplayMode): Promise<ReplayResult> {
    // Entry path must serve the modern client shell before the wire replay.
    await page.goto(entryPath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();

    const helloName = `pi-${mode}-${suffix}`;
    const chatMessage = `pi-chat-${suffix}`;

    return new Promise<ReplayResult>((resolve) => {
        const transcript: ReplayTranscript = {
            sent: [],
            received: [],
            goCount: 0,
            welcomeCount: 0,
            echoedChatCount: 0,
            rejectCount: 0,
            stayedOpenAfterMoveZone: false,
            sentInvalidMove: false,
            stayedOpenAfterInvalidMove: false,
            errors: [],
        };

        let sentHello = false;
        let sentChat = false;
        let stage: 'await_go' | 'await_welcome' | 'await_chat_echo' | 'await_invalid_reject' = 'await_go';
        let done = false;
        const ws = new WebSocket('ws://127.0.0.1:8000/ws');

        const finalize = (payload: ReplayResult) => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            try {
                ws.close();
            } catch (_) {
                // ignore
            }
            resolve(payload);
        };

        const timeout = setTimeout(() => {
            transcript.errors.push(
                `timeout:${stage}:go=${transcript.goCount}:welcome=${transcript.welcomeCount}:sent=${transcript.sent.join(',')}:received=${transcript.received
                    .slice(-5)
                    .join(',')}`
            );
            finalize({ ok: false, reason: `timeout:${stage}`, transcript });
        }, 15_000);

        const send = (action: unknown[], opcode: number) => {
            ws.send(encodeClientToServerBinaryActionBatchPayload([action]));
            transcript.sent.push(opcode);
        };

        ws.on('message', (data: Buffer | string, isBinary: boolean) => {
            if (!isBinary && String(data) === 'go') {
                transcript.received.push('go');
                transcript.goCount += 1;
                stage = 'await_welcome';
                if (!sentHello) {
                    send(createHelloAction(helloName, Types.Entities.CLOTHARMOR, Types.Entities.SWORD1), MSG_HELLO);
                    sentHello = true;
                }
                return;
            }
            if (!isBinary) {
                return;
            }

            const bytes = new Uint8Array(data as Buffer);
            for (const action of decodeServerToClientProtocolActionBatchBinary(bytes)) {
                const type = Number(action[0]);
                transcript.received.push(type);

                if (type === MSG_REJECT) {
                    transcript.rejectCount += 1;
                    if (mode === 'invalid_move' && transcript.sentInvalidMove) {
                        // Modern invariant: protocol violations are answered with
                        // REJECT, not a dropped session.
                        setTimeout(() => {
                            transcript.stayedOpenAfterInvalidMove = ws.readyState === WebSocket.OPEN;
                            finalize({ ok: transcript.stayedOpenAfterInvalidMove, transcript });
                        }, 120);
                    }
                    continue;
                }

                if (mode === 'positive' && type === MSG_CHAT && action[2] === chatMessage) {
                    transcript.echoedChatCount += 1;
                    setTimeout(() => {
                        transcript.stayedOpenAfterMoveZone = ws.readyState === WebSocket.OPEN;
                        finalize({ ok: transcript.stayedOpenAfterMoveZone, transcript });
                    }, 120);
                    continue;
                }

                if (type !== MSG_WELCOME) {
                    continue;
                }
                transcript.welcomeCount += 1;
                const welcomeX = Number(action[3]);
                const welcomeY = Number(action[4]);

                if (mode === 'positive') {
                    if (!sentChat) {
                        send(createChatAction(chatMessage), MSG_CHAT);
                        sentChat = true;
                        stage = 'await_chat_echo';
                    }
                    const step = pickFreeAdjacentTile(welcomeX, welcomeY);
                    const payload = step ? encodeMoveStepIntentPayload(gridPos(step.x, step.y)) : null;
                    if (payload) {
                        send(createIntentAction(1, INTENT_MOVE_STEP, payload), SharedProtocol.MSG_INTENT);
                    }
                    send(createZoneAction(), MSG_ZONE);
                    continue;
                }

                if (!transcript.sentInvalidMove) {
                    // Teleport-sized step: 10 tiles in one move.step.
                    const payload = encodeMoveStepIntentPayload(gridPos(welcomeX + 10, welcomeY));
                    if (!payload) {
                        transcript.errors.push('invalid_move_encode_failed');
                        finalize({ ok: false, reason: 'invalid_move_encode_failed', transcript });
                        return;
                    }
                    send(createIntentAction(1, INTENT_MOVE_STEP, payload), SharedProtocol.MSG_INTENT);
                    transcript.sentInvalidMove = true;
                    stage = 'await_invalid_reject';
                }
            }
        });

        ws.on('close', () => {
            finalize({ ok: false, reason: `unexpected_close:${stage}`, transcript });
        });

        ws.on('error', () => {
            transcript.errors.push('ws_error');
            finalize({ ok: false, reason: `ws_error:${stage}`, transcript });
        });
    });
}

test('protocol replay invariants hold on modern entry path', async ({ page }) => {
    const modern = await replaySequence(page, '/', `modern-${Date.now()}`, 'positive');
    const modernInvalid = await replaySequence(page, '/', `modern-${Date.now()}`, 'invalid_move');

    expect(modern.ok, modern.reason ?? '').toBe(true);
    expect(modernInvalid.ok, modernInvalid.reason ?? '').toBe(true);

    const modernInvariant = {
        sentHello: modern.transcript.sent.includes(MSG_HELLO),
        sentChat: modern.transcript.sent.includes(MSG_CHAT),
        sentMoveIntent: modern.transcript.sent.includes(SharedProtocol.MSG_INTENT),
        sentZone: modern.transcript.sent.includes(MSG_ZONE),
        sawGo: modern.transcript.goCount > 0,
        sawWelcome: modern.transcript.welcomeCount > 0,
        sawEchoedChat: modern.transcript.echoedChatCount > 0,
        stayedOpenAfterMoveZone: modern.transcript.stayedOpenAfterMoveZone,
        sawErrors: modern.transcript.errors.length > 0,
    };
    expect(modernInvariant).toEqual({
        sentHello: true,
        sentChat: true,
        sentMoveIntent: true,
        sentZone: true,
        sawGo: true,
        sawWelcome: true,
        sawEchoedChat: true,
        stayedOpenAfterMoveZone: true,
        sawErrors: false,
    });

    const modernInvalidInvariant = {
        sentHello: modernInvalid.transcript.sent.includes(MSG_HELLO),
        sentInvalidMove: modernInvalid.transcript.sentInvalidMove,
        sawGo: modernInvalid.transcript.goCount > 0,
        sawWelcome: modernInvalid.transcript.welcomeCount > 0,
        sawReject: modernInvalid.transcript.rejectCount > 0,
        stayedOpenAfterInvalidMove: modernInvalid.transcript.stayedOpenAfterInvalidMove,
        sawErrors: modernInvalid.transcript.errors.length > 0,
    };
    expect(modernInvalidInvariant).toEqual({
        sentHello: true,
        sentInvalidMove: true,
        sawGo: true,
        sawWelcome: true,
        sawReject: true,
        stayedOpenAfterInvalidMove: true,
        sawErrors: false,
    });
});
