import { expect, test, type Page } from '@playwright/test';

type DoorTestApi = {
    isBootstrapped?: () => boolean;
    startSession?: (name: string) => void;
    isReady?: () => boolean;
    sendDoorTeleportIntent?: (x: number, y: number) => { ok: boolean; reason?: string; seq: number | null };
    getIntentStatus?: (seq: number) => { status: 'invalid' | 'pending' | 'acked' | 'rejected'; reason?: string };
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

async function sendDoorTeleportIntent(
    page: Page,
    x: number,
    y: number
): Promise<{ ok: boolean; reason?: string; seq: number | null }> {
    return page.evaluate(
        (args: { x: number; y: number }) => {
            const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
            return api?.sendDoorTeleportIntent?.(args.x, args.y) ?? { ok: false, reason: 'missing_api', seq: null };
        },
        { x, y }
    );
}

async function waitForIntentAck(page: Page, seq: number): Promise<void> {
    await expect
        .poll(
            () =>
                page.evaluate((intentSeq) => {
                    const api = (globalThis as { __BQ_TEST_API?: DoorTestApi }).__BQ_TEST_API;
                    return api?.getIntentStatus?.(intentSeq) ?? { status: 'invalid' };
                }, seq),
            { timeout: 20_000 }
        )
        .toMatchObject({ status: 'acked' });
}

test('door traversal supports stable world↔interior roundtrip through teleport intent acks', async ({ page }) => {
    await startModernSession(page, 'modern-door-roundtrip');

    const originDoor = { x: 5, y: 8 };
    const destinationDoor = { x: 18, y: 211 };

    const entered = await sendDoorTeleportIntent(page, originDoor.x, originDoor.y);
    expect(entered.ok).toBe(true);
    expect(entered.seq).not.toBeNull();
    await waitForIntentAck(page, entered.seq as number);

    const exited = await sendDoorTeleportIntent(page, destinationDoor.x, destinationDoor.y);
    expect(exited.ok).toBe(true);
    expect(exited.seq).not.toBeNull();
    await waitForIntentAck(page, exited.seq as number);
});
