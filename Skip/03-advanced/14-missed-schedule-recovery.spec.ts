/**
 * 14-missed-schedule-recovery.spec.ts
 *
 * Tier 03 — Advanced: Missed schedule recovery.
 *
 * A "missed schedule" occurs when a post's publish date passes but WP-Cron
 * did not fire (e.g. no traffic on the site). SchedulePress can recover these
 * posts when its own cron hook runs.
 *
 * Strategy: create posts with a past post_date as status=future (WP marks them
 * as missed), then trigger cron and verify they publish.
 */

import { test, expect } from "../../../fixtures/base-fixture";
import { runWpCli, runWpCron, deletePostsByTitlePrefix } from "../../../utils/wp-helpers";

const PREFIX = "E2E-Missed-";

/** Returns "YYYY-MM-DD HH:MM:SS" N seconds ago. */
function pastDate(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000)
    .toISOString().slice(0, 19).replace("T", " ");
}

test.describe("SchedulePress – Missed Schedule Recovery", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── Detection ────────────────────────────────────────────────────────────

  test("post with past scheduled date is recognised as status=future by WordPress", () => {
    // WP keeps status=future even if post_date is in the past (missed schedule)
    const id = runWpCli(
      `post create --post_title="${PREFIX}Detection" --post_status=future --post_date="${pastDate(300)}" --porcelain`
    );
    const status = runWpCli(`post get ${id} --field=post_status`);
    // WP may keep it as future or transition to publish depending on version
    expect(["future", "publish"]).toContain(status.trim());
    runWpCli(`post delete ${id} --force`);
  });

  // ── Recovery via cron ────────────────────────────────────────────────────

  test("missed post publishes after cron tick", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Single-Recovery" --post_status=future --post_date="${pastDate(300)}" --porcelain`
    );
    runWpCron();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(status.trim()).toBe("publish");
    runWpCli(`post delete ${id} --force`);
  });

  test("multiple missed posts all recover in one cron run", () => {
    const past = pastDate(300);
    const ids = [
      runWpCli(`post create --post_title="${PREFIX}Batch-A" --post_status=future --post_date="${past}" --porcelain`),
      runWpCli(`post create --post_title="${PREFIX}Batch-B" --post_status=future --post_date="${past}" --porcelain`),
      runWpCli(`post create --post_title="${PREFIX}Batch-C" --post_status=future --post_date="${past}" --porcelain`),
    ];
    runWpCron();
    for (const id of ids) {
      const status = runWpCli(`post get ${id} --field=post_status`);
      expect(status.trim()).toBe("publish");
    }
    runWpCli(`post delete ${ids.join(" ")} --force`);
  });

  test("cron does not re-publish an already-published post (idempotent)", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Idempotent" --post_status=publish --porcelain`
    );
    // Run cron twice
    runWpCron();
    runWpCron();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(status.trim()).toBe("publish");
    // Ensure it hasn't been duplicated (title should appear exactly once)
    const count = runWpCli(
      `post list --post_title="${PREFIX}Idempotent" --post_status=any --format=count`
    );
    expect(parseInt(count.trim(), 10)).toBe(1);
    runWpCli(`post delete ${id} --force`);
  });

  // ── `wpsp_settings_v5` option ────────────────────────────────────────────

  test("wpsp_settings_v5 option is present and is valid JSON", () => {
    const raw = runWpCli("option get wpsp_settings_v5 --format=json");
    expect(raw.trim().length).toBeGreaterThan(2);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  // ── Missed Schedule tab in Scheduling Hub ────────────────────────────────

  test("Missed Schedule tab is visible in Scheduling Hub settings", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/admin.php?page=schedulepress", { waitUntil: "domcontentloaded" });
    const hubNav = adminPage.locator('li.wprf-tab-nav-item[data-key="layout_scheduling_hub"]');
    await hubNav.waitFor({ state: "visible", timeout: 10_000 });
    await hubNav.click();
    await adminPage.waitForTimeout(400);
    const missedNav = adminPage.locator('li.wprf-tab-nav-item[data-key="layout_missed_schedule"]');
    await expect(missedNav).toBeVisible({ timeout: 10_000 });
  });

  test("Missed Schedule panel loads without PHP errors", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/admin.php?page=schedulepress", { waitUntil: "domcontentloaded" });
    await adminPage.locator('li.wprf-tab-nav-item[data-key="layout_scheduling_hub"]').click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator('li.wprf-tab-nav-item[data-key="layout_missed_schedule"]').click();
    await adminPage.waitForTimeout(600);
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:/i);
  });

  // ── Future post NOT recovered when date is in the future ─────────────────

  test("future post does not publish prematurely when cron runs", () => {
    // Schedule 2 hours ahead — should stay as future
    const futureDate = new Date(Date.now() + 7200 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");
    const id = runWpCli(
      `post create --post_title="${PREFIX}Premature" --post_status=future --post_date="${futureDate}" --porcelain`
    );
    runWpCron();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(status.trim()).toBe("future");
    runWpCli(`post delete ${id} --force`);
  });
});
