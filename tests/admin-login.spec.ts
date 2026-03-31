/**
 * admin-login.spec.ts
 *
 * Tests:
 *  1. Successful admin login redirects to /wp-admin/
 *  2. Invalid credentials show an error notice
 *  3. Admin bar is present after login (confirms WordPress loaded correctly)
 *  4. Logout works
 */

import { test, expect } from "@playwright/test";

// These tests verify login explicitly, so they do NOT use the shared auth state
test.use({ storageState: { cookies: [], origins: [] } });

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";

test.describe("Admin Login", () => {
  test("should redirect to dashboard after valid login", async ({ page }) => {
    await page.goto("/wp-login.php", { waitUntil: "networkidle" });

    await expect(page.locator("#user_login")).toBeVisible();
    await expect(page.locator("#user_pass")).toBeVisible();

    await page.locator("#user_login").fill("admin");
    await page.locator("#user_pass").fill("admin");
    await page.locator("#wp-submit").click();

    await page.waitForURL("**/wp-admin/**", { timeout: 30_000 });

    // Admin bar indicates a successful WP load
    await expect(page.locator("#wpadminbar")).toBeVisible();
    // Page title includes "Dashboard"
    await expect(page).toHaveTitle(/Dashboard/);
  });

  test("should display error for invalid credentials", async ({ page }) => {
    await page.goto("/wp-login.php", { waitUntil: "networkidle" });

    await page.locator("#user_login").fill("admin");
    await page.locator("#user_pass").fill("wrong_password_xyz");
    await page.locator("#wp-submit").click();

    // WordPress renders an error div with id="login_error"
    await expect(page.locator("#login_error")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#login_error")).toContainText(
      /incorrect|wrong|invalid|password/i
    );

    // Must NOT navigate to /wp-admin/
    expect(page.url()).not.toContain("wp-admin");
  });

  test("should display error for non-existent user", async ({ page }) => {
    await page.goto("/wp-login.php", { waitUntil: "networkidle" });

    await page.locator("#user_login").fill("ghost_user_that_does_not_exist");
    await page.locator("#user_pass").fill("anypassword");
    await page.locator("#wp-submit").click();

    await expect(page.locator("#login_error")).toBeVisible({ timeout: 10_000 });
    expect(page.url()).not.toContain("wp-admin");
  });

  test("should successfully log out", async ({ page }) => {
    // First, log in
    await page.goto("/wp-login.php", { waitUntil: "networkidle" });
    await page.locator("#user_login").fill("admin");
    await page.locator("#user_pass").fill("admin");
    await page.locator("#wp-submit").click();
    await page.waitForURL("**/wp-admin/**", { timeout: 30_000 });

    // Hover over the admin bar to reveal the logout link
    await page.locator("#wp-admin-bar-my-account").hover();
    await page.locator("#wp-admin-bar-logout a").click();

    // Should land back on the login page
    await page.waitForURL("**/wp-login.php**", { timeout: 15_000 });
    await expect(page.locator("#loginform")).toBeVisible();
    await expect(page.locator("#user_login")).toBeVisible();
  });
});
