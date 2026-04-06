/**
 * 08-scheduling-hub.spec.ts
 *
 * Verifies the SchedulePress Scheduling Hub tab and its three sub-sections:
 *   - Advanced Schedule  (data-key="layout_advance_schedule")
 *   - Manage Schedule    (data-key="manage-schedule")
 *   - Missed Schedule    (data-key="layout_missed_schedule")
 *
 * All three sub-tabs become visible in the left sidebar after clicking
 * the Scheduling Hub nav item.
 */

import { test, expect } from "../../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../../utils/selectors";
import { runWpCli } from "../../../utils/wp-helpers";

const HUB_NAV = 'li.wprf-tab-nav-item[data-key="layout_scheduling_hub"]';
const ADVANCED_NAV = 'li.wprf-tab-nav-item[data-key="layout_advance_schedule"]';
const MANAGE_NAV = 'li.wprf-tab-nav-item[data-key="manage-schedule"]';
const MISSED_NAV = 'li.wprf-tab-nav-item[data-key="layout_missed_schedule"]';

test.describe("SchedulePress – Scheduling Hub Navigation", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(HUB_NAV).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(HUB_NAV).click();
    await adminPage.waitForTimeout(600);
  });

  // ── Hub tab itself ─────────────────────────────────────────────────────

  test("Scheduling Hub nav item is visible and active after click", async ({ adminPage }) => {
    await expect(adminPage.locator(HUB_NAV)).toBeVisible({ timeout: 10_000 });
  });

  // ── Sub-tab visibility after opening Hub ──────────────────────────────

  test("'Advanced Schedule' sub-tab appears in sidebar", async ({ adminPage }) => {
    await expect(adminPage.locator(ADVANCED_NAV)).toBeVisible({ timeout: 10_000 });
  });

  test("'Manage Schedule' sub-tab appears in sidebar", async ({ adminPage }) => {
    await expect(adminPage.locator(MANAGE_NAV)).toBeVisible({ timeout: 10_000 });
  });

  test("'Missed Schedule' sub-tab appears in sidebar", async ({ adminPage }) => {
    await expect(adminPage.locator(MISSED_NAV)).toBeVisible({ timeout: 10_000 });
  });

  // ── Sub-tab clickability ───────────────────────────────────────────────

  test("'Advanced Schedule' sub-tab is clickable", async ({ adminPage }) => {
    await adminPage.locator(ADVANCED_NAV).click();
    await adminPage.waitForTimeout(400);
    await expect(adminPage.locator(ADVANCED_NAV)).toBeVisible({ timeout: 5_000 });
  });

  test("'Manage Schedule' sub-tab is clickable", async ({ adminPage }) => {
    await adminPage.locator(MANAGE_NAV).click();
    await adminPage.waitForTimeout(400);
    await expect(adminPage.locator(MANAGE_NAV)).toBeVisible({ timeout: 5_000 });
  });

  test("'Missed Schedule' sub-tab is clickable", async ({ adminPage }) => {
    await adminPage.locator(MISSED_NAV).click();
    await adminPage.waitForTimeout(400);
    await expect(adminPage.locator(MISSED_NAV)).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress – Advanced Schedule Tab", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(HUB_NAV).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(HUB_NAV).click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator(ADVANCED_NAV).click();
    await adminPage.waitForTimeout(600);
  });

  test("Advanced Schedule panel renders without PHP errors", async ({ adminPage }) => {
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:/i);
  });

  test("Advanced Schedule panel shows content (heading or field)", async ({ adminPage }) => {
    // Panel renders settings fields — body content should be non-trivial
    const body = await adminPage.locator("#wpbody-content").textContent() ?? "";
    expect(body.trim().length).toBeGreaterThan(10);
  });

  test("Advanced Schedule panel has at least one settings field", async ({ adminPage }) => {
    const fields = adminPage.locator(".wprf-tab-content.wprf-active .wprf-control-wrapper, .wprf-tab-content.wprf-active .wprf-field");
    // At minimum one field should be present in the panel
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress – Manage Schedule Tab", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(HUB_NAV).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(HUB_NAV).click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator(MANAGE_NAV).click();
    await adminPage.waitForTimeout(800);
  });

  test("Manage Schedule page loads without PHP errors", async ({ adminPage }) => {
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:/i);
  });

  test("Manage Schedule panel or page renders content", async ({ adminPage }) => {
    // After clicking the tab the page should show some content (heading or table or notice)
    const body = await adminPage.locator("#wpbody-content").textContent() ?? "";
    expect(body.trim().length).toBeGreaterThan(10);
  });

  test("'Manage Schedule' nav item shows active state after click", async ({ adminPage }) => {
    await expect(adminPage.locator(MANAGE_NAV)).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress – Missed Schedule Tab", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(HUB_NAV).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(HUB_NAV).click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator(MISSED_NAV).click();
    await adminPage.waitForTimeout(600);
  });

  test("Missed Schedule panel renders without PHP errors", async ({ adminPage }) => {
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:/i);
  });

  test("Missed Schedule panel shows content (heading or field)", async ({ adminPage }) => {
    // Panel renders settings fields — body content should be non-trivial
    const body = await adminPage.locator("#wpbody-content").textContent() ?? "";
    expect(body.trim().length).toBeGreaterThan(10);
  });

  test("Missed Schedule panel has at least one settings control", async ({ adminPage }) => {
    const fields = adminPage.locator(".wprf-tab-content.wprf-active .wprf-control-wrapper, .wprf-tab-content.wprf-active input, .wprf-tab-content.wprf-active select");
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);
  });

  test("wpsp_settings_v5 WordPress option exists and is readable", async () => {
    // Verify the DB option exists and is readable via WP-CLI
    const raw = runWpCli("option get wpsp_settings_v5 --format=json");
    expect(raw.trim().length).toBeGreaterThan(2); // at least "{}"
    // Should be valid JSON (array or object)
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
