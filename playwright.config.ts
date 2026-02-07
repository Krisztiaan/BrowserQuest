import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.playwright.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["line"]] : [["list"]],
  outputDir: "dist/playwright/test-results",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: "bun server/js/main.js server/config.json",
      url: "http://127.0.0.1:8000/status",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: "bunx vite --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173/client/modern.html",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
