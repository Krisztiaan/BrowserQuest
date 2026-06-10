import { expect, test, type Page } from '@playwright/test';
import { attachProtocolObserver } from './protocol-observer';
import {
    MSG_ATTACK,
    MSG_CHAT,
    MSG_HEALTH,
    MSG_HELLO,
    MSG_INTENT,
    MSG_LOOTMOVE,
    MSG_AGGRO,
    MSG_WELCOME,
} from '../support/protocol/contract';

type ZoneMoveResult = {
    ok: boolean;
    reason?: string;
    from?: { x: number; y: number; group: string };
    to?: { x: number; y: number; group: string };
};
type ActionTargets = {
    ready: boolean;
    mobId: number | null;
    itemId: number | null;
    mobCount: number;
    itemCount: number;
};
type CombatLootResult = {
    ok: boolean;
    reason?: string;
    mobId?: number;
    itemId?: number;
    itemX?: number;
    itemY?: number;
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
}

test('modern browser emits HELLO and CHAT protocol actions over live websocket', async ({ page }) => {
    const observer = attachProtocolObserver(page, { trackChats: true });
    const { sentTypes, receivedTypes, receivedChats } = observer;

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
    await expect.poll(() => receivedChats.includes(message), { timeout: 20_000 }).toBe(true);
    await expect(page.locator('#chatbox')).not.toHaveClass(/active/);
});

test('modern browser deterministic cross-zone control causes player movement', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes } = observer;

    await startModernSession(page, 'zone-smoke', { testMode: true });
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);
    const result = await page.evaluate(() => {
        type TestApi = {
            isReady?: () => boolean;
            moveToDifferentZone?: () => ZoneMoveResult;
        };
        const api = (window as { __BQ_TEST_API?: TestApi }).__BQ_TEST_API;
        if (!api || typeof api.isReady !== 'function' || typeof api.moveToDifferentZone !== 'function') {
            return { ok: false, reason: 'api_unavailable' };
        }
        if (!api.isReady()) {
            return { ok: false, reason: 'api_not_ready' };
        }
        return api.moveToDifferentZone();
    });

    expect(result.ok).toBe(true);
    expect(result.from?.group).toBeDefined();
    expect(result.to?.group).toBeDefined();
    expect(result.from?.x).toBeDefined();
    expect(result.from?.y).toBeDefined();
    expect(result.to?.x).toBeDefined();
    expect(result.to?.y).toBeDefined();
    expect(result.from?.group).not.toBe(result.to?.group);
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

test('modern browser emits attack intent/LOOTMOVE via deterministic combat-loot test controls', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes, sentActions } = observer;

    await startModernSession(page, 'combat-loot-smoke', { testMode: true });
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);

    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    type TestApi = { getActionTargets?: () => ActionTargets };
                    const api = (window as { __BQ_TEST_API?: TestApi }).__BQ_TEST_API;
                    if (!api || typeof api.getActionTargets !== 'function') {
                        return false;
                    }
                    const targets = api.getActionTargets();
                    return Boolean(targets.ready && targets.mobId && targets.itemId);
                }),
            { timeout: 20_000 }
        )
        .toBe(true);

    const attackIntentCount = () =>
        sentActions.filter((action) => action[0] === MSG_INTENT && action[2] === 'attack.entity').length;
    const beforeAttackIntent = attackIntentCount();
    const beforeLootMove = sentTypes.filter((type) => type === MSG_LOOTMOVE).length;

    const result = await page.evaluate(() => {
        type TestApi = {
            isReady?: () => boolean;
            sendCombatLootProbe?: () => CombatLootResult;
        };
        const api = (window as { __BQ_TEST_API?: TestApi }).__BQ_TEST_API;
        if (!api || typeof api.isReady !== 'function' || typeof api.sendCombatLootProbe !== 'function') {
            return { ok: false, reason: 'api_unavailable' };
        }
        if (!api.isReady()) {
            return { ok: false, reason: 'api_not_ready' };
        }
        return api.sendCombatLootProbe();
    });

    expect(result.ok).toBe(true);
    expect(result.mobId).toBeDefined();
    expect(result.itemId).toBeDefined();

    await expect
        .poll(() => attackIntentCount(), { timeout: 20_000 })
        .toBeGreaterThan(beforeAttackIntent);
    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_LOOTMOVE).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeLootMove);
});

test('modern browser receives HEALTH updates when a mob attacks the player', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes } = observer;

    await startModernSession(page, 'mob-hurt-smoke', { testMode: true });
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);

    const beforeAggroSent = sentTypes.filter((type) => type === MSG_AGGRO).length;
    const beforeAttack = receivedTypes.filter((type) => type === MSG_ATTACK).length;
    const beforeHealth = receivedTypes.filter((type) => type === MSG_HEALTH).length;

    const result = await page.evaluate(() => {
        type TestApi = {
            isReady?: () => boolean;
            sendAggroProbe?: () => { ok: boolean; reason?: string; mobId?: string | number };
        };
        const api = (window as { __BQ_TEST_API?: TestApi }).__BQ_TEST_API;
        if (!api || typeof api.isReady !== 'function' || typeof api.sendAggroProbe !== 'function') {
            return { ok: false, reason: 'api_unavailable' };
        }
        if (!api.isReady()) {
            return { ok: false, reason: 'api_not_ready' };
        }
        return api.sendAggroProbe();
    });

    expect(result.ok).toBe(true);
    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_AGGRO).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeAggroSent);
    await expect
        .poll(() => receivedTypes.filter((type) => type === MSG_HEALTH).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeHealth);
    await expect
        .poll(() => receivedTypes.filter((type) => type === MSG_ATTACK).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeAttack);

    await expect
        .poll(() => receivedTypes.filter((type) => type === MSG_HEALTH).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeHealth);
});
