/**
 * 10-admin-bar.spec.ts
 *
 * Verifies the SchedulePress "Scheduled Posts" item in the WordPress admin bar.
 *
 * DOM structure (confirmed by live inspection):
 *   #wp-admin-bar-wpscp.menupop           → top-level admin bar item
 *     .ab-item.ab-empty-item              → "Scheduled Posts (N)" label
 *     .ab-sub-wrapper
 *       #wp-admin-bar-wpscp-default       → sub-menu
 *         #wp-admin-bar-wpscp_1           → pagination / "Powered By SchedulePress"
 *
 * The admin bar is visible on both frontend and /wp-admin/ pages when logged in.
 * Count shows "(0)" when no posts are scheduled.
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";
import { runWpCli } from "../../utils/wp-helpers";

const ADMIN_BAR_ITEM = "#wp-admin-bar-wpscp";
const ADMIN_BAR_LABEL = "#wp-admin-bar-wpscp .ab-item";
const ADMIN_BAR_SUB = "#wp-admin-bar-wpscp-default";
const GENERAL_NAV = 'li.wprf-tab-nav-item[data-key="layout_general"]';

/** Click the first visible Save Changes button on the settings page. */
async function saveSettingsPage(adminPage: import("@playwright/test").Page) {
  await adminPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button.wprf-submit-button"));
    btns.find((b) => b.offsetParent !== null)?.click();
  });
  await adminPage.waitForTimeout(1500);
}

/** Ensure the Admin Bar toggle is ON before running admin bar tests. */
async function enableAdminBar(adminPage: import("@playwright/test").Page) {
  await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
  await adminPage.locator(GENERAL_NAV).waitFor({ state: "visible", timeout: 10_000 });
  await adminPage.locator(GENERAL_NAV).click();
  await adminPage.waitForTimeout(400);
  const wrapper = adminPage.locator(".wprf-control-wrapper")
    .filter({ hasText: /Show Scheduled Posts in Admin Bar/i }).first();
  const isOn = await wrapper.locator("input[type='checkbox']").first().isChecked();
  if (!isOn) {
    await wrapper.locator("label.wprf-switch, label").first().click();
    await adminPage.waitForTimeout(300);
    await saveSettingsPage(adminPage);
  }
}

test.describe("SchedulePress – Admin Bar", () => {

  test.beforeEach(async ({ adminPage }) => {
    // Guarantee admin bar is enabled regardless of prior test state
    await enableAdminBar(adminPage);
  });

  // ── Admin bar presence ────────────────────────────────────────────────

  test("WPSP admin bar item is present on /wp-admin/", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(ADMIN_BAR_ITEM)).toBeAttached({ timeout: 10_000 });
  });

  test("admin bar item contains 'Scheduled Posts' text", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(ADMIN_BAR_LABEL).first()).toContainText(/Scheduled Posts/i, { timeout: 10_000 });
  });

  test("admin bar shows post count in parentheses", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const text = await adminPage.locator(ADMIN_BAR_LABEL).first().textContent() ?? "";
    // Should contain "(N)" format
    expect(text).toMatch(/\(\d+\)/);
  });

  test("admin bar sub-menu element is present in DOM", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(ADMIN_BAR_SUB)).toBeAttached({ timeout: 10_000 });
  });

  // ── Count accuracy ────────────────────────────────────────────────────

  test("admin bar count matches WP-CLI scheduled post count", async ({ adminPage }) => {
    const cliCount = parseInt(
      runWpCli("post list --post_status=future --format=count"),
      10,
    );
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const text = await adminPage.locator(ADMIN_BAR_LABEL).first().textContent() ?? "";
    const match = text.match(/\((\d+)\)/);
    const barCount = match ? parseInt(match[1], 10) : -1;
    expect(barCount).toBe(cliCount);
  });

  test("admin bar count updates after a post is scheduled", async ({ adminPage }) => {
    const before = parseInt(
      runWpCli("post list --post_status=future --format=count"),
      10,
    );

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().slice(0, 16).replace("T", " ");
    const postId = runWpCli(
      `post create --post_title="Admin Bar Count Test" --post_status=future --post_date="${dateStr}" --porcelain`,
    );

    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const text = await adminPage.locator(ADMIN_BAR_LABEL).first().textContent() ?? "";
    const match = text.match(/\((\d+)\)/);
    const afterCount = match ? parseInt(match[1], 10) : -1;
    expect(afterCount).toBe(before + 1);

    // Cleanup
    runWpCli(`post delete ${postId} --force`);
  });

  // ── Admin bar on frontend pages ───────────────────────────────────────

  test("WPSP admin bar item is present on the WordPress homepage (sitewide)", async ({ adminPage }) => {
    // Navigate to the frontend while still logged in
    const baseUrl = process.env.WP_BASE_URL ?? "http://localhost:8080";
    await adminPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    // Admin bar should be rendered on the frontend for logged-in users
    await expect(adminPage.locator("#wpadminbar")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator(ADMIN_BAR_ITEM)).toBeAttached({ timeout: 10_000 });
  });

  // ── Admin bar settings toggle ─────────────────────────────────────────

  test("admin bar item disappears when 'Admin Bar' toggle is disabled in settings", async ({ adminPage }) => {
    // Turn OFF the Admin Bar toggle
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(GENERAL_NAV).click();
    await adminPage.waitForTimeout(400);

    const wrapper = adminPage.locator(".wprf-control-wrapper")
      .filter({ hasText: /Show Scheduled Posts in Admin Bar/i }).first();
    const checkbox = wrapper.locator("input[type='checkbox']").first();
    const wasOn = await checkbox.isChecked();
    if (wasOn) {
      await wrapper.locator("label.wprf-switch, label").first().click();
      await adminPage.waitForTimeout(300);
      await saveSettingsPage(adminPage);
    }

    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(ADMIN_BAR_ITEM)).not.toBeVisible({ timeout: 5_000 });

    // Restore
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(GENERAL_NAV).click();
    await adminPage.waitForTimeout(400);
    const wrapper2 = adminPage.locator(".wprf-control-wrapper")
      .filter({ hasText: /Show Scheduled Posts in Admin Bar/i }).first();
    await wrapper2.locator("label.wprf-switch, label").first().click();
    await adminPage.waitForTimeout(300);
    await saveSettingsPage(adminPage);
  });
});
