import { expect, test, type Page } from '@playwright/test';

type MapDebugTestApi = {
    isBootstrapped?: () => boolean;
    startSession?: (name: string) => void;
    isReady?: () => boolean;
    setMapDebugOverlayMode?: (mode: 'none' | 'passability') => { ok: boolean; reason?: string };
};

type BrowserTestGlobals = typeof globalThis & {
    __BQ_WS_URL__?: string;
    __BQ_TEST_MODE__?: boolean;
    __BQ_TEST_API?: MapDebugTestApi;
};

async function startModernSession(page: Page, name: string): Promise<void> {
    const wsUrl = 'ws://127.0.0.1:8000/ws';

    await page.context().clearCookies();
    await page.addInitScript((overrideWsUrl: string) => {
        const globals = globalThis as BrowserTestGlobals;
        globals.__BQ_WS_URL__ = overrideWsUrl;
        globals.__BQ_TEST_MODE__ = true;
        window.localStorage.clear();
    }, wsUrl);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as BrowserTestGlobals).__BQ_TEST_API;
                    return (
                        typeof api?.isBootstrapped === 'function'
                        && typeof api.startSession === 'function'
                        && api.isBootstrapped()
                    );
                }),
            { timeout: 30_000 }
        )
        .toBe(true);

    await page.evaluate((nextName: string) => {
        const api = (globalThis as BrowserTestGlobals).__BQ_TEST_API;
        api?.startSession?.(nextName);
    }, name);

    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as BrowserTestGlobals).__BQ_TEST_API;
                    return api?.isReady?.() === true;
                }),
            { timeout: 45_000 }
        )
        .toBe(true);
}

test('passability debug overlay renders visible classified tiles', async ({ page }) => {
    await startModernSession(page, 'map-debug-overlay');

    const enabled = await page.evaluate(() => {
        const api = (globalThis as BrowserTestGlobals).__BQ_TEST_API;
        return api?.setMapDebugOverlayMode?.('passability') ?? { ok: false, reason: 'missing_api' };
    });
    expect(enabled).toEqual({ ok: true });
    await expect(page.locator('body')).toHaveClass(/map-debug-passability/);

    const canvas = page.locator('#entities');
    await expect(canvas).toBeVisible();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const translucentPixels = await canvas.evaluate((node: HTMLCanvasElement) => {
        const ctx = node.getContext('2d');
        if (!ctx) {
            return 0;
        }
        const data = ctx.getImageData(0, 0, node.width, node.height).data;
        let visible = 0;
        for (let index = 3; index < data.length; index += 4) {
            const alpha = data[index] ?? 0;
            if (alpha >= 60 && alpha <= 110) {
                visible += 1;
            }
        }
        return visible;
    });

    expect(translucentPixels).toBeGreaterThan(0);
});
