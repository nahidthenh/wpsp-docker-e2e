import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// Load .env if present (local dev); CI sets env vars directly
dotenv.config();

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  // ── Test discovery ──────────────────────────────────────────────────────────
  testDir: "./tests",
  testMatch: "**/*.spec.ts",

  // ── Run each test file in parallel; tests within a file run serially ───────
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,

  // ── Retry strategy: 2 retries in CI, 0 locally ────────────────────────────
  retries: process.env.CI ? 2 : 0,

  // ── Reporters ────────────────────────────────────────────────────────────────
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
        [
          "./node_modules/playwright-slack-report/dist/src/SlackReporter.js",
          {
            channels: [process.env.SLACK_CHANNEL_ID],
            sendResults: "always",
            maxNumberOfFailuresToShow: 0,
            meta: [
              {
                key: ":wpsp: Automation - Test Results",
                value: `🖥️ <${process.env.PAGES_URL}|View Results!>`,
              },
            ],
          },
        ],
      ]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  // ── Shared settings for all tests ────────────────────────────────────────────
  use: {
    baseURL: BASE_URL,
    storageState: "playwright/.auth/admin.json",

    // Tracing: capture on first retry so failures are diagnosable
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // Generous but not infinite timeouts
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    // Always show browser locale
    locale: "en-US",
    timezoneId: "UTC",
  },

  // ── Output directory for test artifacts ──────────────────────────────────────
  outputDir: "test-results",

  // ── Global timeout per test (120 s to allow cron chain scenarios) ───────────
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },

  // ── Projects / browsers ──────────────────────────────────────────────────────
  projects: [
    // Setup project: performs login and saves auth state.
    // storageState is explicitly unset so Playwright does not try to load
    // the auth file before it has been created by this very project.
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: undefined },
    },

    // Main test suite — depends on setup
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
