/**
 * global-setup.ts
 *
 * Runs once before all test suites.
 * Performs WordPress admin login and persists the auth cookie/storage state
 * so individual tests can skip the login flow entirely.
 */

import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const AUTH_FILE = path.join(__dirname, "playwright/.auth/admin.json");
const BASE_URL  = process.env.WP_BASE_URL ?? "http://localhost:8080";
const USERNAME  = process.env.WP_ADMIN_USER ?? "admin";
const PASSWORD  = process.env.WP_ADMIN_PASS ?? "admin";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Ensure the auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log(`\n[global-setup] Logging in as "${USERNAME}" at ${BASE_URL} …`);

  await page.goto("/wp-login.php", { waitUntil: "domcontentloaded" });

  // Wait for the form fields to be ready before typing
  await page.locator("#user_login").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("#user_login").fill(USERNAME);
  await page.locator("#user_pass").fill(PASSWORD);

  // "Remember me" is optional — skip if not present
  const rememberMe = page.locator("#rememberme");
  if (await rememberMe.isVisible().catch(() => false)) {
    await rememberMe.check();
  }

  await page.locator("#wp-submit").click();
  await page.waitForSelector("#wpadminbar", { timeout: 45_000 });

  if (!page.url().includes("wp-admin")) {
    await page.screenshot({ path: "test-results/global-setup-failure.png" });
    throw new Error(
      `[global-setup] Login failed — current URL: ${page.url()}`
    );
  }

  // Persist cookies + localStorage so tests can reuse this session
  await context.storageState({ path: AUTH_FILE });
  console.log(`[global-setup] Auth state saved to ${AUTH_FILE}`);

  await browser.close();
}
