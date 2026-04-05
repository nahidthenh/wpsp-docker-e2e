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
import * as fs from "fs";

const AUTH_FILE = path.join(__dirname, "../playwright/.auth/admin.json");

setup("authenticate as admin", async ({ page }) => {
  // Ensure the auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await page.goto("/wp-login.php", { waitUntil: "domcontentloaded" });

  // Wait for the form to be interactive before filling
  const userLoginField = page.locator("#user_login");
  await userLoginField.waitFor({ state: "visible", timeout: 30_000 });
  await userLoginField.fill(process.env.WP_ADMIN_USER ?? "admin");

  const userPassField = page.locator("#user_pass");
  await userPassField.waitFor({ state: "visible", timeout: 10_000 });
  await userPassField.fill(process.env.WP_ADMIN_PASS ?? "admin");

  const submitBtn = page.locator("#wp-submit");
  await submitBtn.waitFor({ state: "visible", timeout: 10_000 });
  await submitBtn.click();

  // Dismiss "Remind me later" prompt if WordPress shows it (not always present)
  const remindLater = page.getByRole("link", { name: "Remind me later" });
  if (await remindLater.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await remindLater.click();
  }

  // Wait for redirect to wp-admin (regex handles trailing-slash and sub-paths)
  await page.waitForURL(/wp-admin/, { timeout: 45_000 });
  await expect(page.locator("#wpadminbar")).toBeVisible({ timeout: 15_000 });

  // Persist auth state
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[auth.setup] Auth state saved → ${AUTH_FILE}`);
});
