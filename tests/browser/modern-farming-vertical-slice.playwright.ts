import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type FarmingIntentStatus = { status: string; reason?: string };
type FarmingTestApi = {
    isBootstrapped?: () => boolean;
    startSession?: (name: string) => void;
    isReady?: () => boolean;
    getPlayerPos?: () => { ok: boolean; x: number; y: number };
    sendClaimCreateIntent?: (payload: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        editors: string[];
    }) => { ok: boolean; seq: number | null };
    sendTileEditIntent?: (x: number, y: number, value: number) => { ok: boolean; seq: number | null };
    getIntentStatus?: (seq: number) => FarmingIntentStatus;
};

async function bootstrapTestPage(page: Page): Promise<void> {
    const wsUrl = 'ws://127.0.0.1:8000/ws';
    await page.context().clearCookies();
    await page.addInitScript(
        (overrideWsUrl: string) => {
            (window as { __BQ_TEST_MODE__?: boolean }).__BQ_TEST_MODE__ = true;
            (globalThis as { __BQ_WS_URL__?: string }).__BQ_WS_URL__ = overrideWsUrl;
            window.localStorage.clear();
        },
        wsUrl
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
                    return typeof api?.isBootstrapped === 'function' && api.isBootstrapped();
                }),
            { timeout: 30_000 }
        )
        .toBe(true);
}

async function startSession(page: Page, name: string): Promise<void> {
    await page.evaluate((nextName: string) => {
        const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
        api?.startSession?.(nextName);
    }, name);
    await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
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

async function waitForIntentStatus(page: Page, seq: number): Promise<FarmingIntentStatus> {
    let latest: FarmingIntentStatus = { status: 'pending' };
    await expect
        .poll(
            async () => {
                latest = await page.evaluate((intentSeq) => {
                    const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
                    return api?.getIntentStatus?.(intentSeq) ?? { status: 'missing' };
                }, seq);
                return latest.status;
            },
            { timeout: 20_000 }
        )
        .not.toBe('pending');
    return latest;
}

async function createFirstAcceptedClaim(
    page: Page,
    origin: { x: number; y: number },
    editors: string[]
): Promise<{ x: number; y: number; seq: number }> {
    const candidates = [
        { x: origin.x, y: origin.y },
        { x: origin.x + 1, y: origin.y },
        { x: origin.x, y: origin.y + 1 },
        { x: origin.x + 1, y: origin.y + 1 },
        { x: origin.x - 1, y: origin.y },
        { x: origin.x, y: origin.y - 1 },
    ];
    const rejected: Array<{ target: { x: number; y: number }; status: FarmingIntentStatus }> = [];

    for (const target of candidates) {
        const claimCreate = await page.evaluate(
            ({ x, y, claimEditors }) => {
                const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
                return (
                    api?.sendClaimCreateIntent?.({ x1: x, y1: y, x2: x + 1, y2: y + 1, editors: claimEditors }) ?? {
                        ok: false,
                        seq: null,
                    }
                );
            },
            { x: target.x, y: target.y, claimEditors: editors }
        );
        expect(claimCreate.ok).toBe(true);
        expect(claimCreate.seq).not.toBeNull();

        const status = await waitForIntentStatus(page, claimCreate.seq as number);
        if (status.status === 'acked') {
            return { ...target, seq: claimCreate.seq as number };
        }
        rejected.push({ target, status });
    }

    throw new Error(`No nearby claim candidate was accepted: ${JSON.stringify(rejected)}`);
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
            const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
            return api?.getPlayerPos?.() ?? { ok: false, x: 0, y: 0 };
        });
        expect(alicePos.ok).toBe(true);
        const target = await createFirstAcceptedClaim(alice.page, alicePos, ['farm-bob']);

        const eveBlocked = await eve.page.evaluate(({ x, y }) => {
            const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
            return api?.sendTileEditIntent?.(x, y, 7701) ?? { ok: false, seq: null };
        }, target);
        expect(eveBlocked.ok).toBe(true);
        expect(eveBlocked.seq).not.toBeNull();

        await expect
            .poll(
                () =>
                    eve.page.evaluate((seq) => {
                        const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
                        return api?.getIntentStatus?.(seq) ?? { status: 'missing' };
                    }, eveBlocked.seq as number),
                { timeout: 20_000 }
            )
            .toMatchObject({ status: 'rejected' });

        const bobEdit = await bob.page.evaluate(({ x, y }) => {
            const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
            return api?.sendTileEditIntent?.(x, y, 7702) ?? { ok: false, seq: null };
        }, target);
        expect(bobEdit.ok).toBe(true);
        expect(bobEdit.seq).not.toBeNull();

        await expect
            .poll(
                () =>
                    bob.page.evaluate((seq) => {
                        const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
                        return api?.getIntentStatus?.(seq).status ?? 'missing';
                    }, bobEdit.seq as number),
                { timeout: 20_000 }
            )
            .toBe('acked');

        await bootstrapTestPage(alice.page);
        await startSession(alice.page, 'farm-alice');

        const eveBlockedAfterReconnect = await eve.page.evaluate(({ x, y }) => {
            const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
            return api?.sendTileEditIntent?.(x, y, 7703) ?? { ok: false, seq: null };
        }, target);
        expect(eveBlockedAfterReconnect.ok).toBe(true);
        expect(eveBlockedAfterReconnect.seq).not.toBeNull();

        await expect
            .poll(
                () =>
                    eve.page.evaluate((seq) => {
                        const api = (globalThis as { __BQ_TEST_API?: FarmingTestApi }).__BQ_TEST_API;
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
