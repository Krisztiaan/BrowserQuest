import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type LegacySmokeDiagnostics = {
    pageErrors: string[];
    consoleEvents: string[];
};

function attachLegacySmokeDiagnostics(page: Page): LegacySmokeDiagnostics {
    const diagnostics: LegacySmokeDiagnostics = { pageErrors: [], consoleEvents: [] };

    page.on('pageerror', (error) => {
        diagnostics.pageErrors.push(error.message);
    });
    page.on('console', (message: ConsoleMessage) => {
        if (message.type() !== 'error' && message.type() !== 'warning') {
            return;
        }
        diagnostics.consoleEvents.push(`${message.type()}: ${message.text()}`);
    });

    return diagnostics;
}

function buildDiagnosticsSuffix(diagnostics: LegacySmokeDiagnostics): string {
    const pageErrors = diagnostics.pageErrors.length > 0 ? diagnostics.pageErrors.join(' | ') : 'none';
    const consoleEvents = diagnostics.consoleEvents.length > 0 ? diagnostics.consoleEvents.join(' | ') : 'none';
    return `legacy smoke diagnostics => pageErrors=[${pageErrors}] console=[${consoleEvents}]`;
}

test('legacy intro event wiring smoke for keyup + play click-off behavior', async ({ page }) => {
    const diagnostics = attachLegacySmokeDiagnostics(page);

    try {
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
    } catch (error) {
        const message =
            error instanceof Error
                ? `${error.message}\n${buildDiagnosticsSuffix(diagnostics)}`
                : `${String(error)}\n${buildDiagnosticsSuffix(diagnostics)}`;
        throw new Error(message);
    }
});
