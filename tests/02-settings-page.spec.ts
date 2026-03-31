/**
 * 02-settings-page.spec.ts
 *
 * Verifies the SchedulePress Settings page (admin.php?page=schedulepress).
 *
 * The settings page is a React SPA with the following tabs registered
 * by the free plugin:
 *   Social Profiles | Settings | Calendar | Auto Scheduler | Manual Scheduler
 *
 * PRO adds two more tabs:
 *   License | Manage Schedule
 */

import { test, expect } from "../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../utils/selectors";

test.describe("SchedulePress Settings Page", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
  });

  // ── Page-level checks ────────────────────────────────────────────────────

  test("settings page returns HTTP 200", async ({ adminPage }) => {
    const res = await adminPage.goto(SCHEDULE_PRESS.urls.settings);
    expect(res?.status()).toBe(200);
  });

  test("settings page contains SchedulePress branding", async ({ adminPage }) => {
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body.toLowerCase()).toContain("schedulepress");
  });

  test("wp-admin chrome renders correctly on settings page", async ({ adminPage }) => {
    await expect(adminPage.locator("#wpadminbar")).toBeVisible();
    await expect(adminPage.locator("#adminmenu")).toBeVisible();
    await expect(adminPage.locator("#wpbody")).toBeVisible();
  });

  // ── Free-plugin tabs (registered in free plugin Menu.php) ───────────────

  test("Social Profiles tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Social Profiles$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Settings tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Settings$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Calendar tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Calendar$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Auto Scheduler tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /Auto.?Scheduler/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Manual Scheduler tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /Manual.?Scheduler/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  // ── PRO-only tabs ────────────────────────────────────────────────────────

  test("License tab is visible (PRO)", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^License$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Manage Schedule tab is visible (PRO)", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /Manage.?Schedule/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  // ── Social platform icons / labels ──────────────────────────────────────

  test("Social Profiles tab shows social platform options", async ({ adminPage }) => {
    // Click the Social Profiles tab
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Social Profiles$/i }).first();
    if (await tab.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await tab.click();
    }
    // At least one social platform should appear (Facebook, Twitter, etc.)
    const body = await adminPage.locator("#wpbody").textContent() ?? "";
    const hasSocial = /facebook|twitter|linkedin|instagram/i.test(body);
    expect(hasSocial).toBe(true);
  });
});
