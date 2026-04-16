/**
 * 11-calendar-events.spec.ts
 *
 * Checks that scheduled posts appear correctly on the SchedulePress calendar.
 * - Scheduled post appears as a FullCalendar event with the correct title
 * - Event lands in the correct day cell on the grid
 * - Two posts on the same day both show as separate events
 * - Navigating to next month shows an event scheduled there
 * - Deleting a post removes it from the calendar
 * - Calendar grid has 28+ day cells and 7 weekday column headers
 */

import { test, expect } from "../../fixtures/base-fixture";
import { Page } from "@playwright/test";
import { SCHEDULE_PRESS } from "../../utils/selectors";
import { runWpCli } from "../../utils/wp-helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" N days from now (UTC). */
function futureDateStr(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** Returns a WP post_date string "YYYY-MM-DD HH:MM:SS" N days from now (UTC). */
function wpDateStr(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Wait for FullCalendar to finish rendering + AJAX events to load. */
async function waitForCalendar(page: Page): Promise<void> {
  await page.locator(".fc").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".calender-selected-month").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForLoadState("networkidle").catch(() => { });
  await page.waitForTimeout(1_000);
}

/** Navigate to calendar and wait for it to be ready. */
async function gotoCalendar(page: Page): Promise<void> {
  await page.goto(SCHEDULE_PRESS.urls.calendar, { waitUntil: "domcontentloaded" });
  await waitForCalendar(page);
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Calendar – Event Rendering", () => {

  // Each test creates its own post and cleans up after itself
  // so tests are fully independent and events are guaranteed to exist.

  test("scheduled post appears as an FC event on the calendar", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="E2E-Cal-Appear" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`
    );
    try {
      await gotoCalendar(adminPage);
      const event = adminPage.locator(".fc-event").filter({ hasText: /E2E-Cal-Appear/i }).first();
      await expect(event).toBeVisible({ timeout: 15_000 });
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("event appears in the correct day cell", async ({ adminPage }) => {
    const targetDate = futureDateStr(7);
    const id = runWpCli(
      `post create --post_title="E2E-Cal-DayCell" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`
    );
    try {
      await gotoCalendar(adminPage);
      const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${targetDate}"]`);
      await expect(dayCell).toBeVisible({ timeout: 10_000 });
      await expect(dayCell.locator(".fc-event").first()).toBeVisible({ timeout: 10_000 });
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("event title contains the post title", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="E2E-Cal-Title" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`
    );
    try {
      await gotoCalendar(adminPage);
      const event = adminPage.locator(".fc-event").filter({ hasText: /E2E-Cal-Title/i }).first();
      await expect(event).toBeVisible({ timeout: 15_000 });
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("day cell with event has at least one event marker", async ({ adminPage }) => {
    const targetDate = futureDateStr(7);
    const id = runWpCli(
      `post create --post_title="E2E-Cal-Marker" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`
    );
    try {
      await gotoCalendar(adminPage);
      const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${targetDate}"]`);
      await expect(dayCell).toBeVisible({ timeout: 10_000 });
      const count = await dayCell.locator(".fc-event").count();
      expect(count).toBeGreaterThan(0);
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("two posts scheduled on the same day both appear as events", async ({ adminPage }) => {
    const targetDate = futureDateStr(7);
    const id1 = runWpCli(
      `post create --post_title="E2E-Cal-Multi1" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`
    );
    const id2 = runWpCli(
      `post create --post_title="E2E-Cal-Multi2" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`
    );
    try {
      await gotoCalendar(adminPage);
      const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${targetDate}"]`);
      await expect(dayCell).toBeVisible({ timeout: 10_000 });
      const count = await dayCell.locator(".fc-event").count();
      expect(count).toBeGreaterThanOrEqual(2);
    } finally {
      runWpCli(`post delete ${id1} --force`);
      runWpCli(`post delete ${id2} --force`);
    }
  });

  test("event on next month is visible after navigating forward", async ({ adminPage }) => {
    const nextMonthDate = futureDateStr(35);
    const id = runWpCli(
      `post create --post_title="E2E-Cal-NextMonth" --post_status=future --post_date="${wpDateStr(35)}" --porcelain`
    );
    try {
      await gotoCalendar(adminPage);
      await adminPage.locator("button.wpsp-next-button").first().click();
      await waitForCalendar(adminPage);

      const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${nextMonthDate}"]`);
      if (await dayCell.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(dayCell.locator(".fc-event").first()).toBeVisible({ timeout: 10_000 });
      } else {
        await expect(adminPage.locator(".fc-event").first()).toBeVisible({ timeout: 10_000 });
      }
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("event disappears from calendar after post is deleted", async ({ adminPage }) => {
    const targetDate = futureDateStr(7);
    const id = runWpCli(
      `post create --post_title="E2E-Cal-Delete" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`
    );

    // Verify it appears first
    await gotoCalendar(adminPage);
    const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${targetDate}"]`);
    await expect(dayCell).toBeVisible({ timeout: 10_000 });
    await expect(dayCell.locator(".fc-event").first()).toBeVisible({ timeout: 10_000 });
    const countBefore = await dayCell.locator(".fc-event").count();
    expect(countBefore).toBeGreaterThan(0);

    // Delete the post then verify count dropped
    runWpCli(`post delete ${id} --force`);
    await gotoCalendar(adminPage);
    const countAfter = await dayCell.locator(".fc-event").count();
    expect(countAfter).toBeLessThan(countBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Calendar – Structure", () => {

  test.beforeEach(async ({ adminPage }) => {
    await gotoCalendar(adminPage);
  });

  test("calendar renders at least 28 day cells", async ({ adminPage }) => {
    const cells = adminPage.locator(".fc-daygrid-day");
    await expect(cells.first()).toBeVisible({ timeout: 10_000 });
    expect(await cells.count()).toBeGreaterThanOrEqual(28);
  });

  test("calendar grid renders all 7 weekday column headers", async ({ adminPage }) => {
    const headers = adminPage.locator(".fc-col-header-cell");
    expect(await headers.count()).toBe(7);
  });
});
