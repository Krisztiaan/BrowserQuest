import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function bootstrapTestPage(page: Page): Promise<void> {
    const wsUrl = 'ws://127.0.0.1:8000/ws';
    await page.context().clearCookies();
    await page.addInitScript(
        (overrideWsUrl: string) => {
            (window as unknown as { __BQ_TEST_MODE__?: boolean }).__BQ_TEST_MODE__ = true;
            (globalThis as unknown as { __BQ_WS_URL__?: string }).__BQ_WS_URL__ = overrideWsUrl;
            window.localStorage.clear();
        },
        wsUrl
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                        | { isBootstrapped?: () => boolean }
                        | undefined;
                    return typeof api?.isBootstrapped === 'function' && api.isBootstrapped();
                }),
            { timeout: 30_000 }
        )
        .toBe(true);
}

async function startSession(page: Page, name: string): Promise<void> {
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
                    return typeof api?.isReady === 'function' && api.isReady();
                }),
            { timeout: 30_000 }
        )
        .toBe(true);
}

async function createClientContext(browserName: string, browser: { newContext: () => Promise<BrowserContext> }): Promise<{
    name: string;
    context: BrowserContext;
    page: Page;
}> {
    const context = await browser.newContext();
    const page = await context.newPage();
    return { name: browserName, context, page };
}

test('modern farming vertical slice: delegated claim edits sync across clients and survive reconnect', async ({ browser }) => {
    const alice = await createClientContext('alice', browser);
    const bob = await createClientContext('bob', browser);
    const eve = await createClientContext('eve', browser);

    try {
        await bootstrapTestPage(alice.page);
        await bootstrapTestPage(bob.page);
        await bootstrapTestPage(eve.page);

        await startSession(alice.page, 'farm-alice');
        await startSession(bob.page, 'farm-bob');
        await startSession(eve.page, 'farm-eve');

        const alicePos = await alice.page.evaluate(() => {
            const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                | { getPlayerPos?: () => { ok: boolean; x: number; y: number } }
                | undefined;
            return api?.getPlayerPos?.() ?? { ok: false, x: 0, y: 0 };
        });
        expect(alicePos.ok).toBe(true);
        const target = { x: alicePos.x, y: alicePos.y };

        const claimCreate = await alice.page.evaluate(({ x, y }) => {
            const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                | {
                      sendClaimCreateIntent?: (payload: {
                          x1: number;
                          y1: number;
                          x2: number;
                          y2: number;
                          editors: string[];
                      }) => { ok: boolean; seq: number | null };
                  }
                | undefined;
            return api?.sendClaimCreateIntent?.({ x1: x, y1: y, x2: x + 1, y2: y + 1, editors: ['farm-bob'] }) ?? { ok: false, seq: null };
        }, target);
        expect(claimCreate.ok).toBe(true);
        expect(claimCreate.seq).not.toBeNull();

        await expect
            .poll(
                () =>
                    alice.page.evaluate((seq) => {
                        const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                            | { getIntentStatus?: (seq: number) => { status: string } }
                            | undefined;
                        return api?.getIntentStatus?.(seq).status ?? 'missing';
                    }, claimCreate.seq as number),
                { timeout: 20_000 }
            )
            .toBe('acked');

        const eveBlocked = await eve.page.evaluate(({ x, y }) => {
            const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                | {
                      sendTileEditIntent?: (x: number, y: number, value: number) => { ok: boolean; seq: number | null };
                  }
                | undefined;
            return api?.sendTileEditIntent?.(x, y, 7701) ?? { ok: false, seq: null };
        }, target);
        expect(eveBlocked.ok).toBe(true);
        expect(eveBlocked.seq).not.toBeNull();

        await expect
            .poll(
                () =>
                    eve.page.evaluate((seq) => {
                        const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                            | { getIntentStatus?: (seq: number) => { status: string; reason?: string } }
                            | undefined;
                        return api?.getIntentStatus?.(seq) ?? { status: 'missing' };
                    }, eveBlocked.seq as number),
                { timeout: 20_000 }
            )
            .toMatchObject({ status: 'rejected' });

        const bobEdit = await bob.page.evaluate(({ x, y }) => {
            const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                | {
                      sendTileEditIntent?: (x: number, y: number, value: number) => { ok: boolean; seq: number | null };
                  }
                | undefined;
            return api?.sendTileEditIntent?.(x, y, 7702) ?? { ok: false, seq: null };
        }, target);
        expect(bobEdit.ok).toBe(true);
        expect(bobEdit.seq).not.toBeNull();

        await expect
            .poll(
                () =>
                    bob.page.evaluate((seq) => {
                        const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                            | { getIntentStatus?: (seq: number) => { status: string } }
                            | undefined;
                        return api?.getIntentStatus?.(seq).status ?? 'missing';
                    }, bobEdit.seq as number),
                { timeout: 20_000 }
            )
            .toBe('acked');

        await expect
            .poll(
                () =>
                    alice.page.evaluate(({ x, y }) => {
                        const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                            | { getOverlayTileValue?: (x: number, y: number) => number | null }
                            | undefined;
                        return api?.getOverlayTileValue?.(x, y) ?? null;
                    }, target),
                { timeout: 20_000 }
            )
            .toBe(7702);

        await bootstrapTestPage(alice.page);
        await startSession(alice.page, 'farm-alice');

        const eveBlockedAfterReconnect = await eve.page.evaluate(({ x, y }) => {
            const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                | {
                      sendTileEditIntent?: (x: number, y: number, value: number) => { ok: boolean; seq: number | null };
                  }
                | undefined;
            return api?.sendTileEditIntent?.(x, y, 7703) ?? { ok: false, seq: null };
        }, target);
        expect(eveBlockedAfterReconnect.ok).toBe(true);
        expect(eveBlockedAfterReconnect.seq).not.toBeNull();

        await expect
            .poll(
                () =>
                    eve.page.evaluate((seq) => {
                        const api = (globalThis as unknown as { __BQ_TEST_API?: unknown }).__BQ_TEST_API as
                            | { getIntentStatus?: (seq: number) => { status: string } }
                            | undefined;
                        return api?.getIntentStatus?.(seq).status ?? 'missing';
                    }, eveBlockedAfterReconnect.seq as number),
                { timeout: 20_000 }
            )
            .toBe('rejected');
    } finally {
        await alice.context.close();
        await bob.context.close();
        await eve.context.close();
    }
});
