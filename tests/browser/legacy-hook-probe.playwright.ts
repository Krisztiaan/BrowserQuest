import { expect, test } from '@playwright/test';

test('optional: legacy test hook installs and exposes callable start API', async ({ page }) => {
    test.skip(process.env.BQ_TEST_LEGACY_HOOK !== '1', 'Set BQ_TEST_LEGACY_HOOK=1 to run optional legacy hook probe.');

    await page.addInitScript(() => {
        (window as unknown as { __BQ_LEGACY_TEST_MODE__?: boolean }).__BQ_LEGACY_TEST_MODE__ = true;
        window.localStorage.clear();
    });

    await page.goto('/client/index.html', { waitUntil: 'domcontentloaded' });

    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    type LegacyApi = {
                        isReady?: () => boolean;
                        getState?: () => { appReady?: boolean; canStartGame?: boolean; gameStarted?: boolean };
                        startSession?: (name?: string) => { ok?: boolean; reason?: string };
                    };
                    const api = (window as unknown as { __BQ_LEGACY_TEST_API?: LegacyApi }).__BQ_LEGACY_TEST_API;
                    return (
                        !!api &&
                        typeof api.isReady === 'function' &&
                        typeof api.getState === 'function' &&
                        typeof api.startSession === 'function'
                    );
                }),
            { timeout: 30_000 }
        )
        .toBe(true);

    const startResult = await page.evaluate(() => {
        type LegacyApi = {
            startSession?: (name?: string) => { ok?: boolean; reason?: string };
        };
        const api = (window as unknown as { __BQ_LEGACY_TEST_API?: LegacyApi }).__BQ_LEGACY_TEST_API;
        if (!api || typeof api.startSession !== 'function') {
            return { ok: false, reason: 'api_unavailable' };
        }
        return api.startSession('legacy-hook-probe');
    });
    expect(startResult.ok).toBe(true);
});
