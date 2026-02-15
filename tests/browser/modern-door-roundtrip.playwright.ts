import { expect, test, type Page } from '@playwright/test';

async function startModernSession(page: Page, name: string) {
    const wsUrl = 'ws://127.0.0.1:8000/ws';

    await page.context().clearCookies();
    await page.addInitScript((overrideWsUrl: string) => {
        (globalThis as unknown as { __BQ_WS_URL__?: string }).__BQ_WS_URL__ = overrideWsUrl;
        (globalThis as unknown as { __BQ_TEST_MODE__?: boolean }).__BQ_TEST_MODE__ = true;
        window.localStorage.clear();
    }, wsUrl);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                        | { isBootstrapped?: () => boolean; startSession?: (name: string) => void }
                        | undefined;
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
        const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
            | { startSession?: (name: string) => void }
            | undefined;
        api?.startSession?.(nextName);
    }, name);

    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                        | { isReady?: () => boolean }
                        | undefined;
                    return !!api?.isReady?.();
                }),
            { timeout: 45_000 }
        )
        .toBe(true);
}

type PlayerPos = { ok: boolean; x: number | null; y: number | null; reason?: string };

async function getPlayerPos(page: Page): Promise<PlayerPos> {
    return page.evaluate(() => {
        const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
            | { getPlayerPos?: () => PlayerPos }
            | undefined;
        return api?.getPlayerPos?.() ?? { ok: false, reason: 'missing_api', x: null, y: null };
    });
}

async function clickTile(page: Page, x: number, y: number): Promise<{ ok: boolean; reason?: string }> {
    return page.evaluate(
        (args: { x: number; y: number }) => {
            const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                | { clickTile?: (x: number, y: number) => { ok: boolean; reason?: string } }
                | undefined;
            return api?.clickTile?.(args.x, args.y) ?? { ok: false, reason: 'missing_api' };
        },
        { x, y }
    );
}

test('door traversal teleports to a different tile and stays stable on repeated click', async ({ page }) => {
    await startModernSession(page, 'modern-door-roundtrip');

    const originDoor = { x: 27, y: 209 };

    const clicked = await clickTile(page, originDoor.x, originDoor.y);
    expect(clicked.ok).toBe(true);

    let arrivalDoor: { x: number; y: number } | null = null;
    await expect
        .poll(async () => {
            const pos = await getPlayerPos(page);
            if (!pos.ok || pos.x === null || pos.y === null) {
                return false;
            }
            if (pos.x === originDoor.x && pos.y === originDoor.y) {
                return false;
            }
            arrivalDoor = { x: pos.x, y: pos.y };
            return true;
        }, { timeout: 30_000 })
        .toBe(true);
    expect(arrivalDoor).not.toBeNull();
    if (!arrivalDoor) {
        throw new Error('Expected door arrival position');
    }

    const exitClicked = await clickTile(page, arrivalDoor.x, arrivalDoor.y);
    expect(exitClicked.ok).toBe(true);

    await expect
        .poll(() => getPlayerPos(page), { timeout: 30_000 })
        .toMatchObject({ ok: true, x: arrivalDoor.x, y: arrivalDoor.y });
});
