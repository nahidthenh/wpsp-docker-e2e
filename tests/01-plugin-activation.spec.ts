/**
 * 01-plugin-activation.spec.ts
 *
 * Verifies both SchedulePress (free) and SchedulePress PRO are correctly
 * installed, active, and registered in the WordPress admin.
 *
 * Source-verified facts:
 *  - Free plugin slug : wp-scheduled-posts
 *  - PRO  plugin slug : wp-scheduled-posts-pro
 *  - Main menu slug   : schedulepress   (admin.php?page=schedulepress)
 *  - Calendar slug    : schedulepress-calendar
 */

import { test, expect } from "../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../utils/selectors";

test.describe("Plugin Activation", () => {

  // ── Free plugin ──────────────────────────────────────────────────────────

  test("free plugin row is present in Plugins list", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/plugins.php", { waitUntil: "domcontentloaded" });
    const row = adminPage.locator("tr[data-slug='wp-scheduled-posts']");
    await expect(row).toBeVisible({ timeout: 10_000 });
  });

  test("free plugin shows as Active in Plugins list", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/plugins.php", { waitUntil: "domcontentloaded" });
    const row = adminPage.locator("tr[data-slug='wp-scheduled-posts']");
    await expect(row).toHaveClass(/active/, { timeout: 10_000 });
  });

  // ── PRO plugin ───────────────────────────────────────────────────────────

  test("PRO plugin row is present in Plugins list", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/plugins.php", { waitUntil: "domcontentloaded" });
    const row = adminPage.locator("tr[data-slug='wp-scheduled-posts-pro']");
    await expect(row).toBeVisible({ timeout: 10_000 });
  });

  test("PRO plugin shows as Active in Plugins list", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/plugins.php", { waitUntil: "domcontentloaded" });
    const row = adminPage.locator("tr[data-slug='wp-scheduled-posts-pro']");
    await expect(row).toHaveClass(/active/, { timeout: 10_000 });
  });

  // ── Admin sidebar ────────────────────────────────────────────────────────

  test("SchedulePress top-level menu appears in wp-admin sidebar", async ({ adminPage }) => {
    // The menu item href contains "page=schedulepress"
    const menuItem = adminPage.locator(SCHEDULE_PRESS.adminMenuLink).first();
    await expect(menuItem).toBeVisible({ timeout: 10_000 });
  });

  test("SchedulePress Calendar sub-menu appears in sidebar", async ({ adminPage }) => {
    const calendarLink = adminPage.locator(
      "#adminmenu a[href*='page=schedulepress-calendar']"
    ).first();
    await expect(calendarLink).toBeVisible({ timeout: 10_000 });
  });

  // ── Settings page smoke test ─────────────────────────────────────────────

  test("SchedulePress settings page loads without fatal PHP errors", async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toContain("Fatal error");
    expect(body).not.toContain("critical error");
    expect(body).not.toContain("Plugin file does not exist");
    // Main WP admin chrome must be present
    await expect(adminPage.locator("#wpbody")).toBeVisible();
  });

  // ── WP-CLI verification ──────────────────────────────────────────────────

  test("free plugin is active via WP-CLI", ({ wpCli }) => {
    const status = wpCli("plugin get wp-scheduled-posts --field=status");
    expect(status.trim()).toBe("active");
  });

  test("PRO plugin is active via WP-CLI", ({ wpCli }) => {
    const status = wpCli("plugin get wp-scheduled-posts-pro --field=status");
    expect(status.trim()).toBe("active");
  });
});
