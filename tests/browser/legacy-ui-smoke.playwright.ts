import { expect, test } from '@playwright/test';

test('legacy intro event wiring smoke for keyup + play click-off behavior', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.clear();
    });

    await page.goto('/client/index.html', { waitUntil: 'domcontentloaded' });

    const nameInput = page.locator('#nameinput');
    const playButton = page.locator('#createcharacter .play');
    const chatButton = page.locator('#chatbutton');

    await expect(nameInput).toBeVisible();
    await expect(playButton).toHaveClass(/disabled/);

    await page.evaluate(() => {
        const button = document.getElementById('chatbutton');
        if (button) {
            button.click();
        }
    });
    await expect(chatButton).toHaveClass(/active/);
    await page.evaluate(() => {
        const button = document.getElementById('chatbutton');
        if (button) {
            button.click();
        }
    });
    await expect(chatButton).not.toHaveClass(/active/);

    await page.evaluate(() => {
        const input = document.getElementById('nameinput');
        if (input) {
            input.setAttribute('value', 'legacy-ui-smoke');
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        }
    });
    await expect(playButton).not.toHaveClass(/disabled/);
});
