import { expect, test, type Page } from '@playwright/test';
import { attachProtocolObserver } from './protocol-observer';

async function startModernSession(page: Page, name: string) {
    await page.addInitScript(() => {
        window.localStorage.clear();
    });

    await page.goto('/client/modern.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#nameinput')).toBeVisible();
    await page.fill('#nameinput', name);
    await page.evaluate((nextName: string) => {
        const input = document.getElementById('nameinput');
        if (input) {
            input.setAttribute('value', nextName);
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        }
    }, name);
    await expect(page.locator('#createcharacter .play')).not.toHaveClass(/disabled/);
    await page.click('#createcharacter .play div');
    try {
        await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
        return;
    } catch (_) {
        // If the intro UI is still visible, one retry click is reasonable. Otherwise, the UI likely transitioned
        // and we're just waiting on slow map/sprite load or websocket handshake.
        const playVisible = await page
            .locator('#createcharacter .play')
            .isVisible()
            .catch(() => false);
        if (playVisible) {
            await page.click('#createcharacter .play');
        }
        await expect(page.locator('body')).toHaveClass(/started/, { timeout: 45_000 });
    }
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
