import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the bilingual (he/en) i18n work.
 *
 * Locale contract under test (next-intl v4, localePrefix "as-needed"):
 *   - Hebrew (default) is prefix-less: `/`, `/login`, `/dashboard`.
 *   - English is prefixed:            `/en`, `/en/login`, `/en/dashboard`.
 *
 * The dev server is expected to already be running on http://localhost:3000.
 * `webServer.reuseExistingServer` reuses it instead of spawning a second one;
 * if nothing is listening, Playwright starts `npm run dev` itself.
 *
 * This config is fully separate from the project's custom unit-test runner
 * (`tests/run-tests.ts` / `npm test`). E2E runs via `npm run test:e2e`.
 */

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Fail the build on CI if a `test.only` is committed by accident.
  forbidOnly: !!process.env.CI,
  // Retry once on CI to absorb transient flakiness; never locally (so flakes surface).
  retries: process.env.CI ? 1 : 0,
  // Single worker keeps locale-cookie / redirect assertions deterministic.
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "playwright-report/junit.xml" }],
  ],
  // Generous timeouts: the Next.js dev server compiles routes on first hit.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    // Pin the browser to Hebrew so the default (prefix-less) context behaves
    // like the app's defaultLocale visitor. Without this, Chromium's built-in
    // `Accept-Language: en-US` makes next-intl resolve prefix-less paths to
    // English, which would make the "Hebrew default" assertions environment-
    // dependent. English is always exercised via explicit `/en/...` routes or
    // the NEXT_LOCALE cookie.
    locale: "he-IL",
    extraHTTPHeaders: {
      "Accept-Language": "he-IL,he;q=0.9",
    },
    // Artifacts only when something fails — keeps the happy path fast.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    // First-time dev-server compile can be slow; give it room.
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
