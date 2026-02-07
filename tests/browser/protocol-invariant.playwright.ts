import { expect, test, type Page } from '@playwright/test';

type ReplayTranscript = {
    sent: number[];
    received: Array<number | 'go'>;
    goCount: number;
    welcomeCount: number;
    echoedChatCount: number;
    errors: string[];
};

type ReplayResult = {
    ok: boolean;
    reason?: string;
    transcript: ReplayTranscript;
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
        async ({ wsUrl, helloName, chatMessage }) => {
            const transcript: ReplayTranscript = {
                sent: [],
                received: [],
                goCount: 0,
                welcomeCount: 0,
                echoedChatCount: 0,
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
                            ws.send(JSON.stringify([0, helloName, 1, 1]));
                            transcript.sent.push(0);
                            sentHello = true;
                        }
                        return;
                    }

                    const actions = parseActions(text);
                    actions.forEach((action) => {
                        const type = Number(action[0]);
                        transcript.received.push(type);

                        if (type === 1) {
                            transcript.welcomeCount += 1;
                            if (!sentChat) {
                                ws.send(JSON.stringify([11, chatMessage]));
                                transcript.sent.push(11);
                                sentChat = true;
                            }
                        }

                        if (type === 11 && action[2] === chatMessage) {
                            transcript.echoedChatCount += 1;
                            finalize({ ok: true, transcript });
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
        }
    );

    return result;
}

test('protocol replay invariants match between modern and legacy entry paths', async ({ page, context }) => {
    const modern = await replayProtocolSequence(page, '/client/modern.html', `modern-${Date.now()}`);

    const legacyPage = await context.newPage();
    const legacy = await replayProtocolSequence(legacyPage, '/client/index.html', `legacy-${Date.now()}`);
    await legacyPage.close();

    expect(modern.ok).toBe(true);
    expect(legacy.ok).toBe(true);

    const modernInvariant = {
        sentHello: modern.transcript.sent.includes(0),
        sentChat: modern.transcript.sent.includes(11),
        sawGo: modern.transcript.goCount > 0,
        sawWelcome: modern.transcript.welcomeCount > 0,
        sawEchoedChat: modern.transcript.echoedChatCount > 0,
        sawErrors: modern.transcript.errors.length > 0,
    };
    const legacyInvariant = {
        sentHello: legacy.transcript.sent.includes(0),
        sentChat: legacy.transcript.sent.includes(11),
        sawGo: legacy.transcript.goCount > 0,
        sawWelcome: legacy.transcript.welcomeCount > 0,
        sawEchoedChat: legacy.transcript.echoedChatCount > 0,
        sawErrors: legacy.transcript.errors.length > 0,
    };

    expect(modernInvariant).toEqual({
        sentHello: true,
        sentChat: true,
        sawGo: true,
        sawWelcome: true,
        sawEchoedChat: true,
        sawErrors: false,
    });
    expect(legacyInvariant).toEqual(modernInvariant);
});
