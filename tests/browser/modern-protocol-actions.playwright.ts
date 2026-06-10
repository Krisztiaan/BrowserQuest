import { expect, test, type Page } from '@playwright/test';
import { attachProtocolObserver } from './protocol-observer';
import {
    MSG_CHAT,
    MSG_HELLO,
    MSG_INTENT,
    MSG_WELCOME,
} from '../support/protocol/contract';

type IntentStatus = { status: 'invalid' | 'pending' | 'acked' | 'rejected'; reason?: string };
type IntentResult = { ok: boolean; reason?: string; seq: number | null };
type ProtocolTestApi = {
    isBootstrapped?: () => boolean;
    startSession?: (name: string) => void;
    isReady?: () => boolean;
    getIntentStatus?: (seq: number) => IntentStatus;
    sendDoorTeleportIntent?: (x: number, y: number) => IntentResult;
    sendResourceHarvestIntent?: (nodeId: string, tool: 'axe' | 'pickaxe' | 'scythe') => IntentResult;
    sendShopSellIntent?: (shopId: string, item: string, quantity: number) => IntentResult;
};

async function startModernSession(page: Page, name: string, options?: { testMode?: boolean }) {
    const testMode = options?.testMode !== false;
    const wsUrl = 'ws://127.0.0.1:8000/ws';

    await page.context().clearCookies();
    await page.addInitScript(
        (enableTestMode: boolean, overrideWsUrl: string) => {
            const testWindow = window as { __BQ_TEST_MODE__?: boolean };
            if (enableTestMode) {
                testWindow.__BQ_TEST_MODE__ = true;
            } else {
                delete testWindow.__BQ_TEST_MODE__;
            }
            (globalThis as { __BQ_WS_URL__?: string }).__BQ_WS_URL__ = overrideWsUrl;
            window.localStorage.clear();
        },
        testMode,
        wsUrl
    );

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();
    if (testMode) {
        await expect
            .poll(
                () =>
                    page.evaluate(() => {
                        const api = (globalThis as {
                            __BQ_TEST_API?: { isBootstrapped?: () => boolean; startSession?: (name: string) => void };
                        }).__BQ_TEST_API;
                        return (
                            typeof api?.isBootstrapped === 'function' &&
                            typeof api.startSession === 'function' &&
                            api.isBootstrapped()
                        );
                    }),
                { timeout: 30_000 }
            )
            .toBe(true);
    }
    await page.evaluate((nextName: string) => {
        const api = (globalThis as { __BQ_TEST_API?: { startSession?: (name: string) => void } }).__BQ_TEST_API;
        api?.startSession?.(nextName);
    }, name);
    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: ProtocolTestApi }).__BQ_TEST_API;
                    return typeof api?.isReady === 'function' && api.isReady();
                }),
            { timeout: 45_000 }
        )
        .toBe(true);
}

async function waitForIntentAck(page: Page, seq: number): Promise<void> {
    await expect
        .poll(
            () =>
                page.evaluate((intentSeq) => {
                    const api = (globalThis as { __BQ_TEST_API?: ProtocolTestApi }).__BQ_TEST_API;
                    return api?.getIntentStatus?.(intentSeq) ?? { status: 'invalid' };
                }, seq),
            { timeout: 20_000 }
        )
        .toMatchObject({ status: 'acked' });
}

async function waitForIntentSettled(page: Page, seq: number): Promise<IntentStatus> {
    let settled: IntentStatus = { status: 'pending' };
    await expect
        .poll(
            async () => {
                settled = await page.evaluate((intentSeq) => {
                    const api = (globalThis as { __BQ_TEST_API?: ProtocolTestApi }).__BQ_TEST_API;
                    return api?.getIntentStatus?.(intentSeq) ?? { status: 'invalid' };
                }, seq);
                return settled.status;
            },
            { timeout: 20_000 }
        )
        .not.toBe('pending');
    return settled;
}

test('modern browser emits HELLO and CHAT protocol actions over live websocket', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes } = observer;

    await startModernSession(page, 'protocol-smoke');
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);

    const message = `pw-chat-${Date.now()}`;
    await page.click('#chatbutton');
    await expect(page.locator('#chatbox')).toHaveClass(/active/);
    await page.fill('#chatinput', message);
    await page.evaluate((chatMessage: string) => {
        const input = document.getElementById('chatinput');
        if (input) {
            input.setAttribute('value', chatMessage);
        }
    }, message);
    await page.locator('#chatinput').press('Enter');

    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_CHAT).length, { timeout: 20_000 })
        .toBeGreaterThan(0);
    await expect(page.locator('#chatbox')).not.toHaveClass(/active/);
});

test('modern browser sends and acks a door teleport intent', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes, sentActions } = observer;

    await startModernSession(page, `door-intent-smoke-${Date.now()}`, { testMode: true });
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);

    const beforeIntentCount = sentActions.filter((action) => action[0] === MSG_INTENT).length;
    const result = await page.evaluate(() => {
        const api = (window as { __BQ_TEST_API?: ProtocolTestApi }).__BQ_TEST_API;
        return api?.sendDoorTeleportIntent?.(5, 8) ?? { ok: false, reason: 'api_unavailable', seq: null };
    });

    expect(result.ok).toBe(true);
    expect(result.seq).not.toBeNull();
    await waitForIntentAck(page, result.seq as number);
    await expect
        .poll(
            () => sentActions.filter((action) => action[0] === MSG_INTENT && action[2] === 'door.teleport').length,
            { timeout: 20_000 }
        )
        .toBeGreaterThan(beforeIntentCount);
});

test('modern browser reconnects and repeats go/HELLO/WELCOME after reload', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes } = observer;

    await startModernSession(page, 'reconnect-one');
    await expect.poll(() => observer.getGoCount(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_HELLO).length, { timeout: 20_000 })
        .toBeGreaterThan(0);
    await expect
        .poll(() => receivedTypes.filter((type) => type === MSG_WELCOME).length, { timeout: 20_000 })
        .toBeGreaterThan(0);

    const beforeGo = observer.getGoCount();
    const beforeHello = sentTypes.filter((type) => type === MSG_HELLO).length;
    const beforeWelcome = receivedTypes.filter((type) => type === MSG_WELCOME).length;

    await startModernSession(page, 'reconnect-two');
    await expect.poll(() => observer.getGoCount(), { timeout: 20_000 }).toBeGreaterThan(beforeGo);
    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_HELLO).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeHello);
    await expect
        .poll(() => receivedTypes.filter((type) => type === MSG_WELCOME).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeWelcome);
});

test('modern browser emits resource and shop intents through deterministic gameplay controls', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes, sentActions } = observer;

    await startModernSession(page, `resource-shop-smoke-${Date.now()}`, { testMode: true });
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);

    const enterMine = await page.evaluate(() => {
        const api = (window as { __BQ_TEST_API?: ProtocolTestApi }).__BQ_TEST_API;
        return api?.sendDoorTeleportIntent?.(5, 8) ?? { ok: false, reason: 'api_unavailable', seq: null };
    });
    expect(enterMine.ok).toBe(true);
    expect(enterMine.seq).not.toBeNull();
    await waitForIntentAck(page, enterMine.seq as number);

    const harvest = await page.evaluate(() => {
        const api = (window as { __BQ_TEST_API?: ProtocolTestApi }).__BQ_TEST_API;
        return api?.sendResourceHarvestIntent?.('mine_ore_001', 'pickaxe') ?? {
            ok: false,
            reason: 'api_unavailable',
            seq: null,
        };
    });
    expect(harvest.ok).toBe(true);
    expect(harvest.seq).not.toBeNull();
    await waitForIntentSettled(page, harvest.seq as number);
    await expect
        .poll(
            () => sentActions.filter((action) => action[0] === MSG_INTENT && action[2] === 'resource.harvest').length,
            { timeout: 20_000 }
        )
        .toBeGreaterThan(0);

    const sell = await page.evaluate(() => {
        const api = (window as { __BQ_TEST_API?: ProtocolTestApi }).__BQ_TEST_API;
        return api?.sendShopSellIntent?.('general_store', 'stone', 1) ?? {
            ok: false,
            reason: 'api_unavailable',
            seq: null,
        };
    });
    expect(sell.ok).toBe(true);
    expect(sell.seq).not.toBeNull();
    await waitForIntentSettled(page, sell.seq as number);
    await expect
        .poll(
            () => sentActions.filter((action) => action[0] === MSG_INTENT && action[2] === 'shop.sell').length,
            { timeout: 20_000 }
        )
        .toBeGreaterThan(0);
});
