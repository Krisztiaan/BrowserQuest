import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const reuseExistingServer = !isCI && process.env.PW_REUSE_SERVERS === "1";

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
    baseURL: "http://127.0.0.1:8000",
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
  webServer: {
    command:
      "bun run dev:bun:build-client && bun run dev:bun:build-playwright-config && BQ_STATIC_ROOT=.tmp/dev-client BQ_FIXED_START_AREA_INDEX=0 BQ_FIXED_START_CENTER=1 bun server/entry.ts server/.tmp-config.playwright.json",
    url: "http://127.0.0.1:8000/status",
    timeout: 120_000,
    reuseExistingServer,
  },
});
