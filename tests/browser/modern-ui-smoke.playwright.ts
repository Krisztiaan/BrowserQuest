import { expect, test, type Page } from '@playwright/test';
import { attachProtocolObserver } from './protocol-observer';

type TestApi = {
    isBootstrapped?: () => boolean;
    startSession?: (name: string) => void;
};

type BrowserTestGlobals = typeof globalThis & {
    __BQ_WS_URL__?: string;
    __BQ_TEST_MODE__?: boolean;
    __BQ_TEST_API?: TestApi;
};

async function startModernSession(page: Page, name: string) {
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
                    const globals = globalThis as BrowserTestGlobals;
                    const api = globals.__BQ_TEST_API;
                    return (
                        typeof api?.isBootstrapped === 'function' &&
                        typeof api.startSession === 'function' &&
                        api.isBootstrapped()
                    );
                }),
            { timeout: 30_000 }
        )
        .toBe(true);

    await page.evaluate((nextName: string) => {
        const globals = globalThis as BrowserTestGlobals;
        const api = globals.__BQ_TEST_API;
        api?.startSession?.(nextName);
    }, name);
    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
}

test('modern UI boots and reaches first playable session', async ({ page }) => {
    const observer = attachProtocolObserver(page);
    const pageErrors: string[] = [];

    page.on('pageerror', (err) => {
        pageErrors.push(err.message);
    });

    await startModernSession(page, 'modern-smoke');
    await expect(page.locator('#playercount .count')).toHaveText(/[1-9]\d*/, { timeout: 20_000 });
    await expect.poll(() => observer.getSocketCount(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect.poll(() => observer.getGoCount(), { timeout: 20_000 }).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
});

test('modern jQuery-driven UI controls toggle expected classes in-session', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
        pageErrors.push(err.message);
    });

    await startModernSession(page, 'modern-ui-controls');
    await expect(page.locator('#playercount .count')).toHaveText(/[1-9]\d*/, { timeout: 20_000 });

    await page.click('#chatbutton');
    await expect(page.locator('#chatbutton')).toHaveClass(/active/);
    await expect(page.locator('#chatbox')).toHaveClass(/active/);
    await page.click('#chatbutton');
    await expect(page.locator('#chatbutton')).not.toHaveClass(/active/);
    await expect(page.locator('#chatbox')).not.toHaveClass(/active/);

    await page.click('#playercount');
    await expect(page.locator('#population')).toHaveClass(/visible/);
    await page.click('#playercount');
    await expect(page.locator('#population')).not.toHaveClass(/visible/);

    await page.click('#helpbutton');
    await expect(page.locator('body')).toHaveClass(/about/);
    await expect(page.locator('#parchment')).toHaveClass(/about/);
    await page.click('#helpbutton');
    await expect(page.locator('body')).not.toHaveClass(/about/);
    await expect(page.locator('#parchment')).not.toHaveClass(/about/);

    await page.click('#toggle-legal');
    await expect(page.locator('body')).toHaveClass(/legal/);
    await expect(page.locator('#parchment')).toHaveClass(/legal/);
    await page.click('body', { position: { x: 8, y: 8 } });
    await expect(page.locator('body')).not.toHaveClass(/legal/);
    await expect(page.locator('#parchment')).not.toHaveClass(/legal/);

    await page.click('#toggle-credits');
    await expect(page.locator('body')).toHaveClass(/credits/);
    await expect(page.locator('#parchment')).toHaveClass(/credits/);
    await page.click('body', { position: { x: 8, y: 8 } });
    await expect(page.locator('body')).not.toHaveClass(/credits/);
    await expect(page.locator('#parchment')).not.toHaveClass(/credits/);

    expect(pageErrors).toEqual([]);
});
