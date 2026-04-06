/**
 * 16-advanced-schedule.spec.ts
 *
 * Tier 03 — Advanced: PRO multi-date "Advance Schedule" feature.
 *
 * SchedulePress PRO stores an advance schedule as JSON in the post meta key:
 *   _wpscppro_advance_schedule  →  JSON array of { date, status } objects
 *
 * UI lives in the Gutenberg sidebar under the SchedulePress panel.
 * This file tests meta storage via WP-CLI and the settings UI for the
 * Advanced Schedule tab inside the Scheduling Hub.
 */

import { test, expect } from "../../fixtures/base-fixture";
import { runWpCli, runWpCron, deletePostsByTitlePrefix, dismissWelcomeGuide } from "../../utils/wp-helpers";

const PREFIX = "E2E-AdvSched-";

function wpDate(offsetSeconds: number): string {
  return new Date(Date.now() + offsetSeconds * 1000)
    .toISOString().slice(0, 19).replace("T", " ");
}

test.describe("SchedulePress PRO – Advanced Schedule", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── Meta storage ─────────────────────────────────────────────────────────

  test("_wpscppro_advance_schedule meta can be set and read via WP-CLI", () => {

    const id = runWpCli(
      `post create --post_title="${PREFIX}Meta-RW" --post_status=draft --porcelain`
    );
    const schedule = JSON.stringify([
      { date: wpDate(3600), status: "publish" },
      { date: wpDate(7200), status: "draft" },
    ]);
    runWpCli(`post meta set ${id} _wpscppro_advance_schedule '${schedule}'`);
    const stored = runWpCli(`post meta get ${id} _wpscppro_advance_schedule`);
    expect(() => JSON.parse(stored)).not.toThrow();
    const parsed = JSON.parse(stored);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    runWpCli(`post delete ${id} --force`);
  });

  test("advance schedule meta survives a post update", () => {

    const id = runWpCli(
      `post create --post_title="${PREFIX}Meta-Persist" --post_status=draft --porcelain`
    );
    const schedule = JSON.stringify([{ date: wpDate(3600), status: "publish" }]);
    runWpCli(`post meta set ${id} _wpscppro_advance_schedule '${schedule}'`);
    // Update the post title (simulates an edit-save)
    runWpCli(`post update ${id} --post_title="${PREFIX}Meta-Persist-Updated"`);
    const stored = runWpCli(`post meta get ${id} _wpscppro_advance_schedule`);
    const parsed = JSON.parse(stored);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    runWpCli(`post delete ${id} --force`);
  });

  test("advance schedule meta can be deleted", () => {

    const id = runWpCli(
      `post create --post_title="${PREFIX}Meta-Delete" --post_status=draft --porcelain`
    );
    runWpCli(`post meta set ${id} _wpscppro_advance_schedule '[]'`);
    runWpCli(`post meta delete ${id} _wpscppro_advance_schedule`);
    let threw = false;
    try {
      runWpCli(`post meta get ${id} _wpscppro_advance_schedule`);
    } catch {
      threw = true;
    }
    // Either throws (key gone) or returns empty string — both are acceptable
    if (!threw) {
      const val = runWpCli(`post meta get ${id} _wpscppro_advance_schedule`);
      expect(val.trim()).toBe("");
    }
    runWpCli(`post delete ${id} --force`);
  });

  // ── Cron processing ───────────────────────────────────────────────────────

  // PRO registers per-post cron events via its save_post hook — setting meta
  // directly via WP-CLI does not trigger PRO's scheduling handler.
  test.skip("post transitions to publish on first advance schedule date (cron) — requires PRO UI save flow", () => { });

  // ── Settings UI ───────────────────────────────────────────────────────────

  test("Advanced Schedule sub-tab is visible in Scheduling Hub", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/admin.php?page=schedulepress", { waitUntil: "domcontentloaded" });
    const hubNav = adminPage.locator('li.wprf-tab-nav-item[data-key="layout_scheduling_hub"]');
    await hubNav.waitFor({ state: "visible", timeout: 10_000 });
    await hubNav.click();
    await adminPage.waitForTimeout(400);
    const advNav = adminPage.locator('li.wprf-tab-nav-item[data-key="layout_advance_schedule"]');
    await expect(advNav).toBeVisible({ timeout: 10_000 });
  });

  test("Advanced Schedule panel loads without PHP errors", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/admin.php?page=schedulepress", { waitUntil: "domcontentloaded" });
    await adminPage.locator('li.wprf-tab-nav-item[data-key="layout_scheduling_hub"]').click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator('li.wprf-tab-nav-item[data-key="layout_advance_schedule"]').click();
    await adminPage.waitForTimeout(600);
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:/i);
  });

  test("Advanced Schedule panel has at least one settings control", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/admin.php?page=schedulepress", { waitUntil: "domcontentloaded" });
    await adminPage.locator('li.wprf-tab-nav-item[data-key="layout_scheduling_hub"]').click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator('li.wprf-tab-nav-item[data-key="layout_advance_schedule"]').click();
    await adminPage.waitForTimeout(600);
    const controls = adminPage.locator(
      ".wprf-tab-content.wprf-active .wprf-control-wrapper, .wprf-tab-content.wprf-active input, .wprf-tab-content.wprf-active select"
    );
    expect(await controls.count()).toBeGreaterThan(0);
  });

  // ── Gutenberg sidebar ─────────────────────────────────────────────────────

  test.describe("Block editor integration", () => {
    test.beforeEach(async ({ adminPage }) => {
      await adminPage.goto("/wp-admin/post-new.php?post_type=post", { waitUntil: "domcontentloaded" });
      await adminPage.waitForTimeout(2000);
      await dismissWelcomeGuide(adminPage);
    });

    test("SchedulePress sidebar panel is visible in the block editor", async ({ adminPage }) => {
      const panel = adminPage.locator(".components-panel__body.schedulepress-options");
      await expect(panel).toBeVisible({ timeout: 15_000 });
    });

    test("SchedulePress 'Schedule And Share' button is present in block editor", async ({ adminPage }) => {
      await expect(adminPage.locator("#wpsp-post-panel-button")).toBeVisible({ timeout: 10_000 });
    });
  });
});
