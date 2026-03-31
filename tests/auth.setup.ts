/**
 * auth.setup.ts
 *
 * Playwright "setup" project — runs before any test project.
 * Performs the admin login and saves the storage state (cookies / localStorage)
 * so all other tests can load it directly without repeating the login flow.
 *
 * Matched by the `setup` project in playwright.config.ts via testMatch: /.*\.setup\.ts/
 */

import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import * as fs   from "fs";

const AUTH_FILE = path.join(__dirname, "../playwright/.auth/admin.json");

setup("authenticate as admin", async ({ page }) => {
  // Ensure the auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await page.goto("/wp-login.php", { waitUntil: "networkidle" });

  await page.locator("#user_login").fill(
    process.env.WP_ADMIN_USER ?? "admin"
  );
  await page.locator("#user_pass").fill(
    process.env.WP_ADMIN_PASS ?? "admin"
  );
  await page.locator("#rememberme").check();
  await page.locator("#wp-submit").click();

  // Verify login succeeded
  await page.waitForURL("**/wp-admin/**", { timeout: 30_000 });
  await expect(page.locator("#wpadminbar")).toBeVisible();

  // Persist auth state
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[auth.setup] Auth state saved → ${AUTH_FILE}`);
});
