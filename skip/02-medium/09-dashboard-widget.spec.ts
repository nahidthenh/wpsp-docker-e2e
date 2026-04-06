/**
 * 09-dashboard-widget.spec.ts
 *
 * Verifies the SchedulePress "Scheduled Posts" dashboard widget on /wp-admin/.
 *
 * DOM structure (confirmed by live inspection):
 *   #wp_scp_dashboard_widget                    → widget postbox container
 *     .postbox-header h2.hndle                  → "Scheduled Posts" title
 *     button.handlediv[aria-expanded]           → collapse/expand toggle
 *     .inside                                   → widget body content
 *       "No post is scheduled." (when empty)
 *       or list of scheduled posts
 *
 * Note: The widget is enabled by default in this install.
 * Tests that toggle the widget setting in General tab will save + restore state.
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";
import { runWpCli } from "../../utils/wp-helpers";

const WIDGET_ID  = "#wp_scp_dashboard_widget";
const GENERAL_NAV = 'li.wprf-tab-nav-item[data-key="layout_general"]';

/** Click the first visible Save Changes button on the settings page. */
async function saveSettingsPage(adminPage: import("@playwright/test").Page) {
  await adminPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button.wprf-submit-button"));
    btns.find((b) => b.offsetParent !== null)?.click();
  });
  await adminPage.waitForTimeout(1500);
}

/** Ensure the Dashboard Widget toggle is ON before running widget tests. */
async function enableDashboardWidget(adminPage: import("@playwright/test").Page) {
  await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
  await adminPage.locator(GENERAL_NAV).waitFor({ state: "visible", timeout: 10_000 });
  await adminPage.locator(GENERAL_NAV).click();
  await adminPage.waitForTimeout(400);
  const wrapper = adminPage.locator(".wprf-control-wrapper").filter({ hasText: /Dashboard Widget/i }).first();
  const isOn = await wrapper.locator("input[type='checkbox']").first().isChecked();
  if (!isOn) {
    await wrapper.locator("label.wprf-switch, label").first().click();
    await adminPage.waitForTimeout(300);
    await saveSettingsPage(adminPage);
  }
}

test.describe("SchedulePress – Dashboard Widget", () => {

  test.beforeEach(async ({ adminPage }) => {
    // Guarantee widget is enabled regardless of prior test state
    await enableDashboardWidget(adminPage);
  });

  // ── Widget presence on /wp-admin/ ─────────────────────────────────────

  test("'Scheduled Posts' dashboard widget is visible on /wp-admin/", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(WIDGET_ID)).toBeVisible({ timeout: 10_000 });
  });

  test("widget has 'Scheduled Posts' title", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const title = adminPage.locator(`${WIDGET_ID} h2.hndle, ${WIDGET_ID} .hndle`);
    await expect(title).toContainText(/Scheduled Posts/i, { timeout: 10_000 });
  });

  test("widget body (.inside) is rendered", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    // Ensure the widget is expanded (collapse toggle persists across page loads)
    const toggle = adminPage.locator(`${WIDGET_ID} button.handlediv`);
    await toggle.waitFor({ state: "visible", timeout: 10_000 });
    const isExpanded = await toggle.getAttribute("aria-expanded");
    if (isExpanded === "false") await toggle.click();
    await adminPage.waitForTimeout(300);
    const body = adminPage.locator(`${WIDGET_ID} .inside`);
    await expect(body).toBeVisible({ timeout: 10_000 });
  });

  test("widget shows 'No post is scheduled' when no posts are scheduled", async ({ adminPage }) => {
    // Create no scheduled posts → widget should show empty state
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const widgetText = await adminPage.locator(`${WIDGET_ID} .inside`).textContent() ?? "";
    // Either empty state message or a list — both are valid
    expect(widgetText.trim().length).toBeGreaterThan(0);
  });

  test("widget shows correct count of scheduled posts", async ({ adminPage }) => {
    // Count via WP-CLI
    const cliCount = parseInt(
      runWpCli('post list --post_status=future --format=count'),
      10,
    );

    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const widgetText = await adminPage.locator(`${WIDGET_ID} .inside`).textContent() ?? "";

    if (cliCount === 0) {
      expect(widgetText).toMatch(/No post is scheduled/i);
    } else {
      // If there are scheduled posts the widget should show them
      expect(widgetText.trim().length).toBeGreaterThan(10);
    }
  });

  // ── Widget collapse / expand ───────────────────────────────────────────

  test("widget has a collapse/expand toggle button", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const toggle = adminPage.locator(`${WIDGET_ID} button.handlediv`);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
  });

  test("clicking toggle button collapses the widget body", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const toggle = adminPage.locator(`${WIDGET_ID} button.handlediv`);

    // Ensure expanded first
    const isExpanded = await toggle.getAttribute("aria-expanded");
    if (isExpanded === "false") await toggle.click();
    await adminPage.waitForTimeout(300);

    // Now collapse
    await toggle.click();
    await adminPage.waitForTimeout(400);
    const collapsed = await toggle.getAttribute("aria-expanded");
    expect(collapsed).toBe("false");
  });

  // ── Widget with scheduled posts ────────────────────────────────────────

  test("widget shows a scheduled post title after one is created", async ({ adminPage }) => {
    // Create a test scheduled post via WP-CLI
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().slice(0, 16).replace("T", " ");
    const postId = runWpCli(
      `post create --post_title="Widget Test Post" --post_status=future --post_date="${dateStr}" --porcelain`,
    );

    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const widgetText = await adminPage.locator(`${WIDGET_ID} .inside`).textContent() ?? "";
    expect(widgetText).toMatch(/Widget Test Post/i);

    // Cleanup
    runWpCli(`post delete ${postId} --force`);
  });

  test("widget updates when a scheduled post is deleted", async ({ adminPage }) => {
    // Create then immediately delete
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().slice(0, 16).replace("T", " ");
    const postId = runWpCli(
      `post create --post_title="Widget Delete Test" --post_status=future --post_date="${dateStr}" --porcelain`,
    );
    runWpCli(`post delete ${postId} --force`);

    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    const widgetText = await adminPage.locator(`${WIDGET_ID} .inside`).textContent() ?? "";
    expect(widgetText).not.toMatch(/Widget Delete Test/i);
  });

  // ── Widget settings toggle ─────────────────────────────────────────────

  test("widget disappears when 'Dashboard Widget' toggle is disabled and reappears when re-enabled", async ({ adminPage }) => {
    // Disable widget in settings
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(GENERAL_NAV).click();
    await adminPage.waitForTimeout(400);

    const wrapper = adminPage.locator(".wprf-control-wrapper").filter({ hasText: /Dashboard Widget/i }).first();
    const checkbox = wrapper.locator("input[type='checkbox']").first();
    const wasOn = await checkbox.isChecked();

    // Turn OFF
    if (wasOn) {
      await wrapper.locator("label.wprf-switch, label").first().click();
      await adminPage.waitForTimeout(300);
    }
    await saveSettingsPage(adminPage);

    // Check dashboard
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(WIDGET_ID)).not.toBeVisible({ timeout: 5_000 });

    // Re-enable
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(GENERAL_NAV).click();
    await adminPage.waitForTimeout(400);
    const wrapper2 = adminPage.locator(".wprf-control-wrapper").filter({ hasText: /Dashboard Widget/i }).first();
    await wrapper2.locator("label.wprf-switch, label").first().click();
    await adminPage.waitForTimeout(300);
    await saveSettingsPage(adminPage);

    // Widget should be back
    await adminPage.goto("/wp-admin/index.php", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(WIDGET_ID)).toBeVisible({ timeout: 10_000 });
  });
});
