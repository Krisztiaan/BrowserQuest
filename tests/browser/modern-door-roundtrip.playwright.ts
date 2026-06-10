import { expect, test, type Page } from '@playwright/test';

type DoorTestApi = {
    isBootstrapped?: () => boolean;
    startSession?: (name: string) => void;
    isReady?: () => boolean;
    getPlayerPos?: () => PlayerPos;
    clickTile?: (x: number, y: number) => { ok: boolean; reason?: string };
    getDoorDestination?: (
        x: number,
        y: number
    ) => {
        ok: boolean;
        reason?: string;
        destination: { x: number; y: number } | null;
    };
};

async function startModernSession(page: Page, name: string) {
    const wsUrl = 'ws://127.0.0.1:8000/ws';

    await page.context().clearCookies();
    await page.addInitScript((overrideWsUrl: string) => {
        (globalThis as { __BQ_WS_URL__?: string }).__BQ_WS_URL__ = overrideWsUrl;
        (globalThis as { __BQ_TEST_MODE__?: boolean }).__BQ_TEST_MODE__ = true;
        window.localStorage.clear();
    }, wsUrl);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
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
        const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
        api?.startSession?.(nextName);
    }, name);

    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
                    return !!api?.isReady?.();
                }),
            { timeout: 45_000 }
        )
        .toBe(true);
}

type PlayerPos = { ok: boolean; x: number | null; y: number | null; reason?: string };

async function getPlayerPos(page: Page): Promise<PlayerPos> {
    return page.evaluate(() => {
        const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
        return api?.getPlayerPos?.() ?? { ok: false, reason: 'missing_api', x: null, y: null };
    });
}

async function clickTile(page: Page, x: number, y: number): Promise<{ ok: boolean; reason?: string }> {
    return page.evaluate(
        (args: { x: number; y: number }) => {
            const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
            return api?.clickTile?.(args.x, args.y) ?? { ok: false, reason: 'missing_api' };
        },
        { x, y }
    );
}

async function getDoorDestination(
    page: Page,
    x: number,
    y: number
): Promise<{ ok: boolean; reason?: string; destination: { x: number; y: number } | null }> {
    return page.evaluate(
        (args: { x: number; y: number }) => {
            const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
            return api?.getDoorDestination?.(args.x, args.y) ?? { ok: false, reason: 'missing_api', destination: null };
        },
        { x, y }
    );
}

async function waitForArrivalDoorThatReturnsToOrigin({
    page,
    originDoor,
    initialPos,
    timeoutMs = 30_000,
}: {
    page: Page;
    originDoor: { x: number; y: number };
    initialPos: PlayerPos;
    timeoutMs?: number;
}): Promise<{ x: number; y: number }> {
    const startedAt = Date.now();
    for (;;) {
        const pos = await getPlayerPos(page);
        if (
            pos.ok &&
            pos.x !== null &&
            pos.y !== null &&
            !(pos.x === initialPos.x && pos.y === initialPos.y) &&
            !(pos.x === originDoor.x && pos.y === originDoor.y)
        ) {
            const returnInfo = await getDoorDestination(page, pos.x, pos.y);
            if (
                returnInfo.ok &&
                returnInfo.destination?.x === originDoor.x &&
                returnInfo.destination.y === originDoor.y
            ) {
                return { x: pos.x, y: pos.y };
            }
        }
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for first arrival door that routes back to origin.');
        }
        await page.waitForTimeout(50);
    }
}

test('door traversal supports stable world↔interior roundtrip on repeated click', async ({ page }) => {
    await startModernSession(page, 'modern-door-roundtrip');

    const originDoor = { x: 27, y: 209 };
    const initialPos = await getPlayerPos(page);
    expect(initialPos.ok).toBe(true);
    expect(initialPos.x).not.toBeNull();
    expect(initialPos.y).not.toBeNull();

    const clicked = await clickTile(page, originDoor.x, originDoor.y);
    expect(clicked.ok).toBe(true);

    const firstArrivalDoor = await waitForArrivalDoorThatReturnsToOrigin({
        page,
        originDoor,
        initialPos,
    });

    const exitClicked = await clickTile(page, firstArrivalDoor.x, firstArrivalDoor.y);
    expect(exitClicked.ok).toBe(true);

    await expect
        .poll(() => getPlayerPos(page), { timeout: 30_000 })
        .toMatchObject({ ok: true, x: originDoor.x, y: originDoor.y });
});
