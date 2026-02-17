import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

type PhoneTestApi = {
    startSession?: (name: string) => void;
};
type TouchProbe = { touchstart: number; touchend: number; click: number };

const IPHONE_USER_AGENT =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function createPhoneContext(browser: Browser): Promise<BrowserContext> {
    return browser.newContext({
        userAgent: IPHONE_USER_AGENT,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
    });
}

async function bootstrapPhoneSession(page: Page, name: string): Promise<void> {
    const wsUrl = 'ws://127.0.0.1:8000/ws';

    await page.context().clearCookies();
    await page.addInitScript((overrideWsUrl: string) => {
        (globalThis as { __BQ_TEST_MODE__?: boolean }).__BQ_TEST_MODE__ = true;
        (globalThis as { __BQ_WS_URL__?: string }).__BQ_WS_URL__ = overrideWsUrl;
        window.localStorage.clear();

        // Deterministic Fullscreen API polyfill for headless browser tests.
        // This lets us verify that the fullscreen toggle wiring is correct without relying on
        // host/browser fullscreen support.
        let fullscreenElement: Element | null = null;
        Object.defineProperty(document, 'fullscreenEnabled', {
            configurable: true,
            get: () => true,
        });
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => fullscreenElement,
        });
        Object.defineProperty(document, 'exitFullscreen', {
            configurable: true,
            value: () => {
                fullscreenElement = null;
                document.dispatchEvent(new Event('fullscreenchange'));
                return Promise.resolve();
            },
        });
        Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
            configurable: true,
            value: function (this: HTMLElement) {
                fullscreenElement = this;
                document.dispatchEvent(new Event('fullscreenchange'));
                return Promise.resolve();
            },
        });
    }, wsUrl);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();

    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: PhoneTestApi }).__BQ_TEST_API;
                    return typeof api?.startSession === 'function';
                }),
            { timeout: 30_000 }
        )
        .toBe(true);

    await page.evaluate((nextName: string) => {
        const api = (globalThis as { __BQ_TEST_API?: PhoneTestApi }).__BQ_TEST_API;
        api?.startSession?.(nextName);
    }, name);

    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
}

test('modern phone layout: full-viewport, no frame/scroll, and click/fullscreen wiring works', async ({ browser }) => {
    const context = await createPhoneContext(browser);
    const page = await context.newPage();

    await bootstrapPhoneSession(page, 'phone-layout-smoke');
    await expect(page.locator('body')).toHaveClass(/phone/);

    const snapshot = async () =>
        page.evaluate(() => {
            const container = document.getElementById('container');
            const canvasBorder = document.getElementById('canvasborder');
            const foreground = document.getElementById('foreground') as HTMLCanvasElement | null;
            const button = document.getElementById('fullscreen-toggle');
            const scrollingElement = document.scrollingElement ?? document.documentElement;

            const containerRect = container?.getBoundingClientRect() ?? null;
            const borderStyle = canvasBorder ? getComputedStyle(canvasBorder) : null;
            const bodyStyle = getComputedStyle(document.body);

            return {
                winW: window.innerWidth,
                winH: window.innerHeight,
                bodyClasses: Array.from(document.body.classList),
                containerRect,
                scrollW: scrollingElement.scrollWidth,
                scrollH: scrollingElement.scrollHeight,
                clientW: scrollingElement.clientWidth,
                clientH: scrollingElement.clientHeight,
                borderPaddingLeft: borderStyle?.paddingLeft ?? null,
                borderPaddingTop: borderStyle?.paddingTop ?? null,
                gameWidthVar: bodyStyle.getPropertyValue('--game-width').trim(),
                gameHeightVar: bodyStyle.getPropertyValue('--game-height').trim(),
                foregroundW: foreground?.width ?? null,
                foregroundH: foreground?.height ?? null,
                fullscreenButtonDisplay: button ? getComputedStyle(button).display : null,
                fullscreenButtonText: button?.textContent ?? null,
                fullscreenElementPresent: !!document.fullscreenElement,
            };
        });

    await expect
        .poll(() => snapshot(), { timeout: 20_000 })
        .toMatchObject({
            borderPaddingLeft: '0px',
            borderPaddingTop: '0px',
        });

    const portrait = await snapshot();
    expect(portrait.containerRect).not.toBeNull();
    expect(portrait.containerRect?.width).toBeGreaterThanOrEqual(portrait.winW - 2);
    expect(portrait.containerRect?.height).toBeGreaterThanOrEqual(portrait.winH - 2);
    expect(portrait.scrollW).toBeLessThanOrEqual(portrait.clientW + 2);
    expect(portrait.scrollH).toBeLessThanOrEqual(portrait.clientH + 2);
    await expect
        .poll(async () => {
            const next = await snapshot();
            const gameW = Number.parseInt(next.gameWidthVar, 10);
            const gameH = Number.parseInt(next.gameHeightVar, 10);
            return (
                Number.isFinite(gameW) &&
                Number.isFinite(gameH) &&
                next.foregroundW === gameW &&
                next.foregroundH === gameH
            );
        })
        .toBe(true);

    await expect.poll(async () => (await snapshot()).fullscreenButtonDisplay, { timeout: 10_000 }).toBe('block');
    await expect.poll(async () => (await snapshot()).fullscreenButtonText, { timeout: 10_000 }).toBe('Fullscreen');
    expect(portrait.fullscreenElementPresent).toBe(false);

    await expect(page.locator('#fullscreen-toggle')).toBeVisible();
    await page.locator('#fullscreen-toggle').click();
    await expect
        .poll(() => snapshot(), { timeout: 5_000 })
        .toMatchObject({
            fullscreenElementPresent: true,
            fullscreenButtonText: 'Exit fullscreen',
        });
    await page.locator('#fullscreen-toggle').click();
    await expect
        .poll(() => snapshot(), { timeout: 5_000 })
        .toMatchObject({
            fullscreenElementPresent: false,
            fullscreenButtonText: 'Fullscreen',
        });

    await page.evaluate(() => {
        const foreground = document.getElementById('foreground');
        const probe = { touchstart: 0, touchend: 0, click: 0 };
        (globalThis as { __BQ_TOUCH_PROBE__?: TouchProbe }).__BQ_TOUCH_PROBE__ = probe;
        if (!foreground) {
            return;
        }
        foreground.addEventListener('touchstart', () => {
            probe.touchstart += 1;
        });
        foreground.addEventListener('touchend', () => {
            probe.touchend += 1;
        });
        foreground.addEventListener('click', () => {
            probe.click += 1;
        });
    });

    await page.locator('#foreground').tap({ position: { x: 40, y: 40 } });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const probe = (globalThis as { __BQ_TOUCH_PROBE__?: TouchProbe }).__BQ_TOUCH_PROBE__;
                    if (!probe) {
                        return false;
                    }
                    return probe.touchstart > 0 && (probe.touchend > 0 || probe.click > 0);
                }),
            { timeout: 20_000 }
        )
        .toBe(true);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('body')).toHaveClass(/phone/);

    await expect
        .poll(() => snapshot(), { timeout: 20_000 })
        .toMatchObject({
            borderPaddingLeft: '0px',
            borderPaddingTop: '0px',
        });

    const landscapeNow = await snapshot();
    expect(landscapeNow.containerRect).not.toBeNull();
    expect(landscapeNow.containerRect?.width).toBeGreaterThanOrEqual(landscapeNow.winW - 2);
    expect(landscapeNow.containerRect?.height).toBeGreaterThanOrEqual(landscapeNow.winH - 2);
    expect(landscapeNow.scrollW).toBeLessThanOrEqual(landscapeNow.clientW + 2);
    expect(landscapeNow.scrollH).toBeLessThanOrEqual(landscapeNow.clientH + 2);
    await expect
        .poll(async () => {
            const next = await snapshot();
            const gameW = Number.parseInt(next.gameWidthVar, 10);
            const gameH = Number.parseInt(next.gameHeightVar, 10);
            return (
                Number.isFinite(gameW) &&
                Number.isFinite(gameH) &&
                next.foregroundW === gameW &&
                next.foregroundH === gameH
            );
        })
        .toBe(true);

    await context.close();
});
