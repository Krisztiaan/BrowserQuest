import { expect, test, type Page } from '@playwright/test';

type IntentStatus = { status: 'invalid' | 'pending' | 'acked' | 'rejected'; reason?: string };
type MinesTestApi = {
    isBootstrapped?: () => boolean;
    startSession?: (name: string) => void;
    isReady?: () => boolean;
    getActiveMapId?: () => string | null;
    loadMapById?: (mapId: string) => Promise<{ ok: boolean; reason?: string }>;
    getActionTargets?: () => { ready: boolean; mobCount: number };
    getPlayerPos?: () => { ok: boolean; x: number | null; y: number | null };
    clickTile?: (x: number, y: number) => { ok: boolean; reason?: string };
    sendDoorTeleportIntent?: (x: number, y: number) => { ok: boolean; seq: number | null; reason?: string };
    sendResourceHarvestIntent?: (nodeId: string, tool: 'axe' | 'pickaxe' | 'scythe') => { ok: boolean; seq: number | null; reason?: string };
    sendShopSellIntent?: (shopId: string, item: string, quantity: number) => { ok: boolean; seq: number | null; reason?: string };
    getIntentStatus?: (seq: number) => IntentStatus;
};

async function bootstrapTestPage(page: Page, name: string): Promise<void> {
    const wsUrl = 'ws://127.0.0.1:8000/ws';
    await page.context().clearCookies();
    await page.addInitScript((overrideWsUrl: string) => {
        (window as { __BQ_TEST_MODE__?: boolean }).__BQ_TEST_MODE__ = true;
        (globalThis as { __BQ_WS_URL__?: string }).__BQ_WS_URL__ = overrideWsUrl;
        window.localStorage.clear();
    }, wsUrl);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
                    return typeof api?.isBootstrapped === 'function' && api.isBootstrapped();
                }),
            { timeout: 30_000 }
        )
        .toBe(true);

    await page.evaluate((nextName: string) => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        api?.startSession?.(nextName);
    }, name);
    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
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
                    const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
                    return api?.getIntentStatus?.(intentSeq) ?? { status: 'invalid' };
                }, seq),
            { timeout: 20_000 }
        )
        .toMatchObject({ status: 'acked' });
}

test('mines loop: enter mine, harvest ore, and keep inventory after returning', async ({ page }) => {
    await bootstrapTestPage(page, `mines-loop-${Date.now()}`);

    const startPos = await page.evaluate(() => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return api?.getPlayerPos?.() ?? { ok: false, x: null, y: null };
    });
    expect(startPos.ok).toBe(true);
    expect(
        (startPos.x === 18 && startPos.y === 211) || (startPos.x === 5 && startPos.y === 8)
    ).toBe(true);

    const enterMine = await page.evaluate(() => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return api?.sendDoorTeleportIntent?.(5, 8) ?? { ok: false, seq: null, reason: 'missing_api' };
    });
    expect(enterMine.ok).toBe(true);
    expect(enterMine.seq).not.toBeNull();
    await waitForIntentAck(page, enterMine.seq as number);

    const harvest = await page.evaluate(() => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return api?.sendResourceHarvestIntent?.('mine_ore_001', 'pickaxe') ?? { ok: false, seq: null, reason: 'missing_api' };
    });
    expect(harvest.ok).toBe(true);
    expect(harvest.seq).not.toBeNull();
    await waitForIntentAck(page, harvest.seq as number);

    const loadMine = await page.evaluate(async () => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return (await api?.loadMapById?.('mine_floor_001')) ?? { ok: false, reason: 'missing_api' };
    });
    expect(loadMine.ok).toBe(true);
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
                    return api?.getActiveMapId?.() ?? null;
                }),
            { timeout: 10_000 }
        )
        .toBe('mine_floor_001');

    const firstSell = await page.evaluate(() => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return api?.sendShopSellIntent?.('general_store', 'stone', 1) ?? { ok: false, seq: null, reason: 'missing_api' };
    });
    expect(firstSell.ok).toBe(true);
    expect(firstSell.seq).not.toBeNull();
    await waitForIntentAck(page, firstSell.seq as number);

    const exitMine = await page.evaluate(() => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return api?.sendDoorTeleportIntent?.(18, 211) ?? { ok: false, seq: null, reason: 'missing_api' };
    });
    expect(exitMine.ok).toBe(true);
    expect(exitMine.seq).not.toBeNull();
    await waitForIntentAck(page, exitMine.seq as number);

    const loadWorld = await page.evaluate(async () => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return (await api?.loadMapById?.('world_01')) ?? { ok: false, reason: 'missing_api' };
    });
    expect(loadWorld.ok).toBe(true);

    const secondSell = await page.evaluate(() => {
        const api = (globalThis as { __BQ_TEST_API?: MinesTestApi }).__BQ_TEST_API;
        return api?.sendShopSellIntent?.('general_store', 'stone', 1) ?? { ok: false, seq: null, reason: 'missing_api' };
    });
    expect(secondSell.ok).toBe(true);
    expect(secondSell.seq).not.toBeNull();
    await waitForIntentAck(page, secondSell.seq as number);
});
