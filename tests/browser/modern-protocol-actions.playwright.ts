import { expect, test, type Page } from '@playwright/test';
import { attachProtocolObserver } from './protocol-observer';
import {
    MSG_ATTACK,
    MSG_CHAT,
    MSG_HELLO,
    MSG_HIT,
    MSG_LIST,
    MSG_LOOTMOVE,
    MSG_MOVE,
    MSG_WELCOME,
    MSG_ZONE,
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
    const testMode = options?.testMode === true;

    await page.addInitScript((enableTestMode: boolean) => {
        const testWindow = window as unknown as { __BQ_TEST_MODE__?: boolean };
        if (enableTestMode) {
            testWindow.__BQ_TEST_MODE__ = true;
        } else {
            delete testWindow.__BQ_TEST_MODE__;
        }
        window.localStorage.clear();
    }, testMode);

    await page.goto('/client/modern.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();
    await page.fill('#nameinput', name);
    await page.evaluate((nextName: string) => {
        const input = document.getElementById('nameinput');
        if (input) {
            input.setAttribute('value', nextName);
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        }
    }, name);
    await expect(page.locator('#createcharacter .play')).not.toHaveClass(/disabled/);
    await page.click('#createcharacter .play div');
    try {
        await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
        return;
    } catch (_) {
        const playVisible = await page.locator('#createcharacter .play').isVisible().catch(() => false);
        if (playVisible) {
            await page.click('#createcharacter .play');
        }
        await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    }
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
});

test('modern browser emits MOVE and ZONE actions for deterministic cross-zone control', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes } = observer;

    await startModernSession(page, 'zone-smoke', { testMode: true });
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);

    const beforeMove = sentTypes.filter((type) => type === MSG_MOVE).length;
    const beforeZone = sentTypes.filter((type) => type === MSG_ZONE).length;
    const beforeList = receivedTypes.filter((type) => type === MSG_LIST).length;

    const result = await page.evaluate(() => {
        type TestApi = {
            isReady?: () => boolean;
            moveToDifferentZone?: () => ZoneMoveResult;
        };
        const api = (window as unknown as { __BQ_TEST_API?: TestApi }).__BQ_TEST_API;
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
    expect(result.from?.group).not.toBe(result.to?.group);

    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_MOVE).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeMove);
    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_ZONE).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeZone);
    await expect
        .poll(() => receivedTypes.filter((type) => type === MSG_LIST).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeList);
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

test('modern browser emits ATTACK/HIT/LOOTMOVE via deterministic combat-loot test controls', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const { sentTypes, receivedTypes } = observer;

    await startModernSession(page, 'combat-loot-smoke', { testMode: true });
    await expect.poll(() => sentTypes.includes(MSG_HELLO), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => receivedTypes.includes(MSG_WELCOME), { timeout: 20_000 }).toBe(true);

    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    type TestApi = { getActionTargets?: () => ActionTargets };
                    const api = (window as unknown as { __BQ_TEST_API?: TestApi }).__BQ_TEST_API;
                    if (!api || typeof api.getActionTargets !== 'function') {
                        return false;
                    }
                    const targets = api.getActionTargets();
                    return Boolean(targets.ready && targets.mobId && targets.itemId);
                }),
            { timeout: 20_000 }
        )
        .toBe(true);

    const beforeAttack = sentTypes.filter((type) => type === MSG_ATTACK).length;
    const beforeHit = sentTypes.filter((type) => type === MSG_HIT).length;
    const beforeLootMove = sentTypes.filter((type) => type === MSG_LOOTMOVE).length;

    const result = await page.evaluate(() => {
        type TestApi = {
            isReady?: () => boolean;
            sendCombatLootProbe?: () => CombatLootResult;
        };
        const api = (window as unknown as { __BQ_TEST_API?: TestApi }).__BQ_TEST_API;
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
        .poll(() => sentTypes.filter((type) => type === MSG_ATTACK).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeAttack);
    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_HIT).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeHit);
    await expect
        .poll(() => sentTypes.filter((type) => type === MSG_LOOTMOVE).length, { timeout: 20_000 })
        .toBeGreaterThan(beforeLootMove);
});
