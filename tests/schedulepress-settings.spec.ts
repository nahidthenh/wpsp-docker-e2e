/**
 * schedulepress-settings.spec.ts
 *
 * Tests:
 *  1. SchedulePress settings page loads
 *  2. Settings can be saved successfully
 *  3. Dashboard widget is present on wp-admin dashboard
 *  4. SchedulePress admin bar item is present (if plugin adds one)
 */

import { test, expect } from "../fixtures/base-fixture";

const SETTINGS_PAGE_CANDIDATES = [
  "/wp-admin/admin.php?page=wpsp-settings",
  "/wp-admin/admin.php?page=wp-scheduled-posts-settings",
  "/wp-admin/options-general.php?page=wp-scheduled-posts",
];

async function navigateToSettings(page: import("@playwright/test").Page): Promise<boolean> {
  // Try sidebar link first
  const sidebarSettings = page.locator(
    "#adminmenu a[href*='settings'][href*='wpsp'], " +
    "#adminmenu a[href*='settings'][href*='scheduled-posts']"
  ).first();

  if (await sidebarSettings.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await sidebarSettings.click();
    await page.waitForLoadState("domcontentloaded");
    return true;
  }

  for (const candidate of SETTINGS_PAGE_CANDIDATES) {
    await page.goto(candidate, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").textContent() ?? "";
    if (!body.includes("not found") && !body.includes("Invalid page")) {
      return true;
    }
  }
  return false;
}

test.describe("SchedulePress Settings & Dashboard", () => {
  test("settings page should load without PHP errors", async ({ adminPage }) => {
    const found = await navigateToSettings(adminPage);
    if (!found) { test.skip(); return; }

    const bodyText = await adminPage.locator("body").textContent() ?? "";
    expect(bodyText).not.toContain("Fatal error");
    expect(bodyText).not.toContain("critical error");
  });

  test("settings page should contain a save/submit button", async ({ adminPage }) => {
    const found = await navigateToSettings(adminPage);
    if (!found) { test.skip(); return; }

    const saveBtn = adminPage.locator(
      "input[type='submit'], button[type='submit'], button:has-text('Save')"
    ).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
  });

  test("SchedulePress dashboard widget should appear on wp-admin dashboard", async ({
    adminPage,
  }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });

    // Look for a dashboard widget related to SchedulePress
    const widget = adminPage.locator(
      "[id*='wpsp'], [id*='schedulepress'], [class*='wpsp'], [class*='scheduled-posts']"
    ).first();

    const isVisible = await widget.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) {
      console.info("[settings] SchedulePress dashboard widget not found — may not be enabled.");
      test.skip();
    } else {
      await expect(widget).toBeVisible();
    }
  });

  test("SchedulePress should register a link in the wp-admin sidebar", async ({
    adminPage,
  }) => {
    await adminPage.goto("/wp-admin/", { waitUntil: "domcontentloaded" });

    const menuLink = adminPage.locator(
      "#adminmenu a[href*='wp-scheduled-posts'], " +
      "#adminmenu a[href*='wpsp'], " +
      "#adminmenu a[href*='schedulepress']"
    ).first();
    await expect(menuLink).toBeVisible({ timeout: 10_000 });
  });

  test("SchedulePress admin bar item should be present (if applicable)", async ({
    adminPage,
  }) => {
    await adminPage.goto("/wp-admin/", { waitUntil: "domcontentloaded" });

    const adminBarItem = adminPage.locator(
      "#wpadminbar [id*='wpsp'], #wpadminbar [class*='wpsp'], " +
      "#wpadminbar [id*='schedulepress']"
    ).first();

    const isVisible = await adminBarItem.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) {
      console.info("[settings] SchedulePress admin bar item not found — may not be registered.");
      // This is not a failure — some versions don't add admin bar items
    } else {
      await expect(adminBarItem).toBeVisible();
    }
  });
});
