/**
 * base-fixture.ts
 *
 * Extended Playwright test fixture that:
 *  • injects an authenticated admin page automatically
 *  • exposes wpCli() and cronRun() as typed helpers
 *  • cleans up test-created posts after each test
 */

import { test as base, expect, Page } from "@playwright/test";
import {
  gotoAdminDashboard,
  runWpCli,
  runWpCron,
  deletePostsByTitlePrefix,
} from "../utils/wp-helpers";

// ── Fixture type definitions ──────────────────────────────────────────────────
interface WpFixtures {
  /** Authenticated admin page (storage state already loaded from global setup). */
  adminPage: Page;
  /** Execute an arbitrary WP-CLI sub-command inside the running container. */
  wpCli: (subcommand: string) => string;
  /** Trigger all due WP-Cron events. */
  cronRun: () => void;
  /** Track post titles created during a test; auto-deleted in afterEach. */
  trackPost: (title: string) => void;
}

// ── Extended test object ──────────────────────────────────────────────────────
export const test = base.extend<WpFixtures>({
  // adminPage: authenticated page, lands on /wp-admin/
  adminPage: async ({ page }, use) => {
    // storageState is already set in playwright.config.ts
    await gotoAdminDashboard(page);
    await use(page);
  },

  wpCli: async ({}, use) => {
    await use(runWpCli);
  },

  cronRun: async ({}, use) => {
    await use(runWpCron);
  },

  // Post title tracker — collect titles, delete them in teardown
  trackPost: async ({}, use) => {
    const titles: string[] = [];
    await use((title: string) => titles.push(title));
    // Teardown: clean up all tracked posts
    for (const title of titles) {
      deletePostsByTitlePrefix(title);
    }
  },
});

export { expect };
