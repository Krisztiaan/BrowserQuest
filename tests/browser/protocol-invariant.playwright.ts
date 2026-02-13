import { expect, test, type Page } from '@playwright/test';
import { MSG_CHAT, MSG_HELLO, MSG_MOVE, MSG_WELCOME, MSG_ZONE } from '../support/protocol/contract';

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

type ReplayActionValue = number | string | boolean | null;
type ReplayAction = [number, ...ReplayActionValue[]];

async function replaySequence(page: Page, entryPath: '/', suffix: string, mode: ReplayMode) {
    await page.addInitScript(() => {
        window.localStorage.clear();
    });
    await page.goto(entryPath, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(
        async ({ wsUrl, helloName, chatMessage, mode, types }) => {
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

            const parseActions = (raw: string): ReplayAction[] => {
                try {
                    const parsed: unknown = JSON.parse(raw) as unknown;
                    if (!Array.isArray(parsed)) return [];
                    if (parsed.length > 0 && Array.isArray(parsed[0])) {
                        return parsed.filter(
                            (entry): entry is ReplayAction => Array.isArray(entry) && typeof entry[0] === 'number'
                        );
                    }
                    if (typeof parsed[0] === 'number') {
                        return [parsed as ReplayAction];
                    }
                    return [];
                } catch (_) {
                    return [];
                }
            };

            return new Promise<ReplayResult>((resolve) => {
                let sentHello = false;
                let sentChat = false;
                let sentMove = false;
                let sentZone = false;
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
                    const text = typeof event.data === 'string' ? event.data : String(event.data);

                    if (text === 'go') {
                        transcript.received.push('go');
                        transcript.goCount += 1;
                        stage = 'await_welcome';
                        if (!sentHello) {
                            ws.send(JSON.stringify([types.MSG_HELLO, helloName, 1, 1]));
                            transcript.sent.push(types.MSG_HELLO);
                            sentHello = true;
                        }
                        return;
                    }

                    const actions = parseActions(text);
                    actions.forEach((action) => {
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
                            return;
                        }

                        transcript.welcomeCount += 1;

                        if (mode === 'positive') {
                            const welcomeX = Number(action[3]);
                            const welcomeY = Number(action[4]);

                            if (!sentChat) {
                                ws.send(JSON.stringify([types.MSG_CHAT, chatMessage]));
                                transcript.sent.push(types.MSG_CHAT);
                                sentChat = true;
                                stage = 'await_chat_echo';
                            }
                            if (!sentMove && Number.isFinite(welcomeX) && Number.isFinite(welcomeY)) {
                                ws.send(JSON.stringify([types.MSG_MOVE, welcomeX, welcomeY]));
                                transcript.sent.push(types.MSG_MOVE);
                                transcript.moveCount += 1;
                                sentMove = true;
                            }
                            if (sentMove && !sentZone) {
                                ws.send(JSON.stringify([types.MSG_ZONE]));
                                transcript.sent.push(types.MSG_ZONE);
                                transcript.zoneCount += 1;
                                sentZone = true;
                            }
                            return;
                        }

                        if (!transcript.sentInvalidMove) {
                            ws.send(JSON.stringify([types.MSG_MOVE, 10.5, 7]));
                            transcript.sent.push(types.MSG_MOVE);
                            transcript.sentInvalidMove = true;
                            stage = 'await_invalid_close';
                        }
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
            types: {
                MSG_HELLO,
                MSG_WELCOME,
                MSG_CHAT,
                MSG_MOVE,
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
        sentMove: modern.transcript.sent.includes(MSG_MOVE),
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
