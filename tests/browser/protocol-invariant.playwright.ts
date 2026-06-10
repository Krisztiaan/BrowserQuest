import { expect, test, type Page } from '@playwright/test';
import { MSG_CHAT, MSG_HELLO, MSG_INTENT, MSG_WELCOME, MSG_ZONE } from '../support/protocol/contract';
import {
    decodeServerToClientProtocolActionBatchBinary,
    encodeClientToServerProtocolActionBinary,
} from '../../shared/protocol/registry';
import type { ClientToServerProtocolAction } from '../../shared/protocol/types';
import { encodeMoveStepIntentPayload, INTENT_MOVE_STEP } from '../../shared/protocol/intents';

type ReplayMode = 'positive' | 'invalid_move';

type ReplayTranscript = {
    sent: number[];
    received: Array<number | 'go'>;
    goCount: number;
    welcomeCount: number;
    echoedChatCount: number;
    moveCount: number;
    zoneCount: number;
    stayedOpenAfterMoveZone: boolean;
    sentInvalidMove: boolean;
    closedAfterInvalidMove: boolean;
    errors: string[];
};

type ReplayResult = {
    ok: boolean;
    reason?: string;
    transcript: ReplayTranscript;
};

type ReplayActionValue = number | string | boolean | null | number[];
type ReplayAction = [number, ...ReplayActionValue[]];

async function replaySequence(page: Page, entryPath: '/', suffix: string, mode: ReplayMode) {
    const encodeFunctionName = `__BQ_ENCODE_C2S_${mode}_${suffix.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const decodeFunctionName = `__BQ_DECODE_S2C_${mode}_${suffix.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const moveIntentFunctionName = `__BQ_MOVE_INTENT_${mode}_${suffix.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const invalidMoveFunctionName = `__BQ_INVALID_MOVE_${mode}_${suffix.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    await page.exposeFunction(encodeFunctionName, (action: ClientToServerProtocolAction) =>
        Array.from(encodeClientToServerProtocolActionBinary(action))
    );
    await page.exposeFunction(decodeFunctionName, (payload: number[]) =>
        decodeServerToClientProtocolActionBatchBinary(new Uint8Array(payload))
    );
    await page.exposeFunction(moveIntentFunctionName, (seq: number, x: number, y: number) => {
        const payload = encodeMoveStepIntentPayload({ x, y });
        if (payload === null) {
            throw new Error('failed to encode move intent payload');
        }
        return Array.from(encodeClientToServerProtocolActionBinary([MSG_INTENT, seq, INTENT_MOVE_STEP, payload]));
    });
    await page.exposeFunction(invalidMoveFunctionName, () => {
        const payload = encodeMoveStepIntentPayload({ x: 10, y: 7 });
        if (payload === null) {
            throw new Error('failed to encode invalid move intent base payload');
        }
        const valid = encodeClientToServerProtocolActionBinary([MSG_INTENT, 1, INTENT_MOVE_STEP, payload]);
        return Array.from(valid.slice(0, -1));
    });

    await page.addInitScript(() => {
        window.localStorage.clear();
    });
    await page.goto(entryPath, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(
        async ({
            wsUrl,
            helloName,
            chatMessage,
            mode,
            types,
            encodeFunctionName,
            decodeFunctionName,
            moveIntentFunctionName,
            invalidMoveFunctionName,
        }) => {
            const transcript: ReplayTranscript = {
                sent: [],
                received: [],
                goCount: 0,
                welcomeCount: 0,
                echoedChatCount: 0,
                moveCount: 0,
                zoneCount: 0,
                stayedOpenAfterMoveZone: false,
                sentInvalidMove: false,
                closedAfterInvalidMove: false,
                errors: [],
            };

            type ProtocolBridge = Record<string, unknown>;
            const bridge = globalThis as unknown as ProtocolBridge;
            const encodeAction = bridge[encodeFunctionName] as (action: ReplayAction) => Promise<number[]>;
            const decodeActions = bridge[decodeFunctionName] as (payload: number[]) => Promise<ReplayAction[]>;
            const encodeMoveIntent = bridge[moveIntentFunctionName] as (
                seq: number,
                x: number,
                y: number
            ) => Promise<number[]>;
            const createInvalidMoveFrame = bridge[invalidMoveFunctionName] as () => Promise<number[]>;

            const sendAction = async (ws: WebSocket, action: ReplayAction) => {
                const encoded = await encodeAction(action);
                ws.send(new Uint8Array(encoded));
            };
            const sendMoveIntent = async (ws: WebSocket, seq: number, x: number, y: number) => {
                const encoded = await encodeMoveIntent(seq, x, y);
                ws.send(new Uint8Array(encoded));
            };

            const decodeEventData = async (data: unknown): Promise<ReplayAction[]> => {
                if (data instanceof ArrayBuffer) {
                    return decodeActions(Array.from(new Uint8Array(data)));
                }
                if (data instanceof Blob) {
                    return decodeActions(Array.from(new Uint8Array(await data.arrayBuffer())));
                }
                if (ArrayBuffer.isView(data)) {
                    return decodeActions(Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));
                }
                return [];
            };

            return new Promise<ReplayResult>((resolve) => {
                let sentHello = false;
                let sentChat = false;
                let sentMoveIntent = false;
                let sentZone = false;
                let nextIntentSeq = 1;
                let stage: 'await_go' | 'await_welcome' | 'await_chat_echo' | 'await_invalid_close' = 'await_go';
                let done = false;
                const ws = new WebSocket(wsUrl);

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

                const timeout = window.setTimeout(() => {
                    transcript.errors.push(
                        `timeout:${stage}:go=${transcript.goCount}:welcome=${transcript.welcomeCount}:sent=${transcript.sent.join(',')}:received=${transcript.received
                            .slice(-5)
                            .join(',')}`
                    );
                    finalize({ ok: false, reason: `timeout:${stage}`, transcript });
                }, 15000);

                ws.onmessage = (event) => {
                    void (async () => {
                        if (event.data === 'go') {
                            transcript.received.push('go');
                            transcript.goCount += 1;
                            stage = 'await_welcome';
                            if (!sentHello) {
                                await sendAction(ws, [types.MSG_HELLO, helloName, 1, 1]);
                                transcript.sent.push(types.MSG_HELLO);
                                sentHello = true;
                            }
                            return;
                        }

                        const actions = await decodeEventData(event.data);
                        for (const action of actions) {
                            const type = Number(action[0]);
                            transcript.received.push(type);

                            if (type !== types.MSG_WELCOME) {
                                if (mode === 'positive' && type === types.MSG_CHAT && action[2] === chatMessage) {
                                    transcript.echoedChatCount += 1;
                                    window.setTimeout(() => {
                                        transcript.stayedOpenAfterMoveZone = ws.readyState === WebSocket.OPEN;
                                        finalize({ ok: transcript.stayedOpenAfterMoveZone, transcript });
                                    }, 120);
                                }
                                continue;
                            }

                            transcript.welcomeCount += 1;

                            if (mode === 'positive') {
                                const welcomeX = Number(action[3]);
                                const welcomeY = Number(action[4]);

                                if (!sentChat) {
                                    await sendAction(ws, [types.MSG_CHAT, chatMessage]);
                                    transcript.sent.push(types.MSG_CHAT);
                                    sentChat = true;
                                    stage = 'await_chat_echo';
                                }
                                if (!sentMoveIntent && Number.isFinite(welcomeX) && Number.isFinite(welcomeY)) {
                                    await sendMoveIntent(ws, nextIntentSeq, welcomeX, welcomeY);
                                    nextIntentSeq += 1;
                                    transcript.sent.push(types.MSG_INTENT);
                                    transcript.moveCount += 1;
                                    sentMoveIntent = true;
                                }
                                if (sentMoveIntent && !sentZone) {
                                    await sendAction(ws, [types.MSG_ZONE]);
                                    transcript.sent.push(types.MSG_ZONE);
                                    transcript.zoneCount += 1;
                                    sentZone = true;
                                }
                                continue;
                            }

                            if (!transcript.sentInvalidMove) {
                                const encoded = await createInvalidMoveFrame();
                                ws.send(new Uint8Array(encoded));
                                transcript.sent.push(types.MSG_INTENT);
                                transcript.sentInvalidMove = true;
                                stage = 'await_invalid_close';
                            }
                        }
                    })().catch((error: unknown) => {
                        transcript.errors.push(error instanceof Error ? error.message : String(error));
                        finalize({ ok: false, reason: `decode_error:${stage}`, transcript });
                    });
                };

                ws.onclose = () => {
                    if (mode === 'positive') {
                        finalize({ ok: false, reason: `unexpected_close:${stage}`, transcript });
                        return;
                    }
                    transcript.closedAfterInvalidMove = transcript.sentInvalidMove;
                    finalize({
                        ok: transcript.goCount > 0 && transcript.welcomeCount > 0 && transcript.closedAfterInvalidMove,
                        transcript,
                    });
                };

                ws.onerror = () => {
                    transcript.errors.push('ws_error');
                    if (mode === 'invalid_move' && transcript.closedAfterInvalidMove) {
                        return;
                    }
                    finalize({ ok: false, reason: `ws_error:${stage}`, transcript });
                };
            });
        },
        {
            wsUrl: 'ws://127.0.0.1:8000/ws',
            helloName: `pi-${mode}-${suffix}`,
            chatMessage: `pi-chat-${suffix}`,
            mode,
            encodeFunctionName,
            decodeFunctionName,
            moveIntentFunctionName,
            invalidMoveFunctionName,
            types: {
                MSG_HELLO,
                MSG_WELCOME,
                MSG_CHAT,
                MSG_INTENT,
                INTENT_MOVE_STEP,
                MSG_ZONE,
            },
        }
    );

    return result;
}

test('protocol replay invariants hold on modern entry path', async ({ page }) => {
    const modern = await replaySequence(page, '/', `modern-${Date.now()}`, 'positive');
    const modernInvalid = await replaySequence(page, '/', `modern-${Date.now()}`, 'invalid_move');

    expect(modern.ok).toBe(true);
    expect(modernInvalid.ok).toBe(true);

    const modernInvariant = {
        sentHello: modern.transcript.sent.includes(MSG_HELLO),
        sentChat: modern.transcript.sent.includes(MSG_CHAT),
        sentMove: modern.transcript.sent.includes(MSG_INTENT),
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
        sentMove: true,
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
        closedAfterInvalidMove: modernInvalid.transcript.closedAfterInvalidMove,
        sawErrors: modernInvalid.transcript.errors.length > 0,
    };
    expect(modernInvalidInvariant).toEqual({
        sentHello: true,
        sentInvalidMove: true,
        sawGo: true,
        sawWelcome: true,
        closedAfterInvalidMove: true,
        sawErrors: false,
    });
});
