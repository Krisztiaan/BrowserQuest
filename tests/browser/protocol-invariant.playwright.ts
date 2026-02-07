import { expect, test, type Page } from '@playwright/test';
import { MSG_CHAT, MSG_HELLO, MSG_MOVE, MSG_WELCOME, MSG_ZONE } from '../support/protocol';

type ReplayTranscript = {
    sent: number[];
    received: Array<number | 'go'>;
    goCount: number;
    welcomeCount: number;
    echoedChatCount: number;
    moveCount: number;
    zoneCount: number;
    stayedOpenAfterMoveZone: boolean;
    errors: string[];
};

type ReplayResult = {
    ok: boolean;
    reason?: string;
    transcript: ReplayTranscript;
};

type InvalidMoveTranscript = {
    sent: number[];
    received: Array<number | 'go'>;
    sawGo: boolean;
    sawWelcome: boolean;
    sentInvalidMove: boolean;
    closedAfterInvalidMove: boolean;
    errors: string[];
};

type InvalidMoveResult = {
    ok: boolean;
    reason?: string;
    transcript: InvalidMoveTranscript;
};

async function replayProtocolSequence(
    page: Page,
    entryPath: '/client/modern.html' | '/client/index.html',
    suffix: string
) {
    await page.addInitScript(() => {
        window.localStorage.clear();
    });
    await page.goto(entryPath, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(
        async ({ wsUrl, helloName, chatMessage, types }) => {
            const transcript: ReplayTranscript = {
                sent: [],
                received: [],
                goCount: 0,
                welcomeCount: 0,
                echoedChatCount: 0,
                moveCount: 0,
                zoneCount: 0,
                stayedOpenAfterMoveZone: false,
                errors: [],
            };

            const parseActions = (raw: string): number[][] => {
                try {
                    const parsed = JSON.parse(raw);
                    if (!Array.isArray(parsed)) return [];
                    if (parsed.length > 0 && Array.isArray(parsed[0])) {
                        return parsed.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'number');
                    }
                    if (typeof parsed[0] === 'number') {
                        return [parsed];
                    }
                    return [];
                } catch (_) {
                    return [];
                }
            };

            return await new Promise<ReplayResult>((resolve) => {
                let sentHello = false;
                let sentChat = false;
                let sentMove = false;
                let sentZone = false;
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
                    finalize({ ok: false, reason: 'timeout', transcript });
                }, 15000);

                ws.onmessage = (event) => {
                    const text = typeof event.data === 'string' ? event.data : String(event.data);

                    if (text === 'go') {
                        transcript.received.push('go');
                        transcript.goCount += 1;
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

                        if (type === types.MSG_WELCOME) {
                            transcript.welcomeCount += 1;
                            const welcomeX = Number(action[3]);
                            const welcomeY = Number(action[4]);
                            if (!sentChat) {
                                ws.send(JSON.stringify([types.MSG_CHAT, chatMessage]));
                                transcript.sent.push(types.MSG_CHAT);
                                sentChat = true;
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
                        }

                        if (type === types.MSG_CHAT && action[2] === chatMessage) {
                            transcript.echoedChatCount += 1;
                            window.setTimeout(() => {
                                transcript.stayedOpenAfterMoveZone = ws.readyState === WebSocket.OPEN;
                                finalize({ ok: transcript.stayedOpenAfterMoveZone, transcript });
                            }, 120);
                        }
                    });
                };

                ws.onerror = () => {
                    transcript.errors.push('ws_error');
                    finalize({ ok: false, reason: 'ws_error', transcript });
                };
            });
        },
        {
            wsUrl: 'ws://127.0.0.1:8000/',
            helloName: `pi-${suffix}`,
            chatMessage: `pi-chat-${suffix}`,
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

async function replayInvalidMoveSequence(
    page: Page,
    entryPath: '/client/modern.html' | '/client/index.html',
    suffix: string
) {
    await page.addInitScript(() => {
        window.localStorage.clear();
    });
    await page.goto(entryPath, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(
        async ({ wsUrl, helloName, types }) => {
            const transcript: InvalidMoveTranscript = {
                sent: [],
                received: [],
                sawGo: false,
                sawWelcome: false,
                sentInvalidMove: false,
                closedAfterInvalidMove: false,
                errors: [],
            };

            const parseActions = (raw: string): number[][] => {
                try {
                    const parsed = JSON.parse(raw);
                    if (!Array.isArray(parsed)) return [];
                    if (parsed.length > 0 && Array.isArray(parsed[0])) {
                        return parsed.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'number');
                    }
                    if (typeof parsed[0] === 'number') {
                        return [parsed];
                    }
                    return [];
                } catch (_) {
                    return [];
                }
            };

            return await new Promise<InvalidMoveResult>((resolve) => {
                let sentHello = false;
                let done = false;
                const ws = new WebSocket(wsUrl);

                const finalize = (payload: InvalidMoveResult) => {
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
                    finalize({ ok: false, reason: 'timeout', transcript });
                }, 15000);

                ws.onmessage = (event) => {
                    const text = typeof event.data === 'string' ? event.data : String(event.data);
                    if (text === 'go') {
                        transcript.received.push('go');
                        transcript.sawGo = true;
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
                        if (type === types.MSG_WELCOME && !transcript.sentInvalidMove) {
                            transcript.sawWelcome = true;
                            ws.send(JSON.stringify([types.MSG_MOVE, 10.5, 7]));
                            transcript.sent.push(types.MSG_MOVE);
                            transcript.sentInvalidMove = true;
                        }
                    });
                };

                ws.onclose = () => {
                    transcript.closedAfterInvalidMove = transcript.sentInvalidMove;
                    finalize({
                        ok: transcript.sawGo && transcript.sawWelcome && transcript.closedAfterInvalidMove,
                        transcript,
                    });
                };

                ws.onerror = () => {
                    transcript.errors.push('ws_error');
                    if (!transcript.closedAfterInvalidMove) {
                        finalize({ ok: false, reason: 'ws_error', transcript });
                    }
                };
            });
        },
        {
            wsUrl: 'ws://127.0.0.1:8000/',
            helloName: `pi-invalid-${suffix}`,
            types: {
                MSG_HELLO,
                MSG_WELCOME,
                MSG_MOVE,
            },
        }
    );

    return result;
}

test('protocol replay invariants match between modern and legacy entry paths', async ({ page, context }) => {
    const modern = await replayProtocolSequence(page, '/client/modern.html', `modern-${Date.now()}`);
    const modernInvalid = await replayInvalidMoveSequence(page, '/client/modern.html', `modern-${Date.now()}`);

    const legacyPage = await context.newPage();
    const legacy = await replayProtocolSequence(legacyPage, '/client/index.html', `legacy-${Date.now()}`);
    const legacyInvalid = await replayInvalidMoveSequence(legacyPage, '/client/index.html', `legacy-${Date.now()}`);
    await legacyPage.close();

    expect(modern.ok).toBe(true);
    expect(legacy.ok).toBe(true);
    expect(modernInvalid.ok).toBe(true);
    expect(legacyInvalid.ok).toBe(true);

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
    const legacyInvariant = {
        sentHello: legacy.transcript.sent.includes(MSG_HELLO),
        sentChat: legacy.transcript.sent.includes(MSG_CHAT),
        sentMove: legacy.transcript.sent.includes(MSG_MOVE),
        sentZone: legacy.transcript.sent.includes(MSG_ZONE),
        sawGo: legacy.transcript.goCount > 0,
        sawWelcome: legacy.transcript.welcomeCount > 0,
        sawEchoedChat: legacy.transcript.echoedChatCount > 0,
        stayedOpenAfterMoveZone: legacy.transcript.stayedOpenAfterMoveZone,
        sawErrors: legacy.transcript.errors.length > 0,
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
    expect(legacyInvariant).toEqual(modernInvariant);

    const modernInvalidInvariant = {
        sentHello: modernInvalid.transcript.sent.includes(MSG_HELLO),
        sentInvalidMove: modernInvalid.transcript.sentInvalidMove,
        sawGo: modernInvalid.transcript.sawGo,
        sawWelcome: modernInvalid.transcript.sawWelcome,
        closedAfterInvalidMove: modernInvalid.transcript.closedAfterInvalidMove,
        sawErrors: modernInvalid.transcript.errors.length > 0,
    };
    const legacyInvalidInvariant = {
        sentHello: legacyInvalid.transcript.sent.includes(MSG_HELLO),
        sentInvalidMove: legacyInvalid.transcript.sentInvalidMove,
        sawGo: legacyInvalid.transcript.sawGo,
        sawWelcome: legacyInvalid.transcript.sawWelcome,
        closedAfterInvalidMove: legacyInvalid.transcript.closedAfterInvalidMove,
        sawErrors: legacyInvalid.transcript.errors.length > 0,
    };

    expect(modernInvalidInvariant).toEqual({
        sentHello: true,
        sentInvalidMove: true,
        sawGo: true,
        sawWelcome: true,
        closedAfterInvalidMove: true,
        sawErrors: false,
    });
    expect(legacyInvalidInvariant).toEqual(modernInvalidInvariant);
});
