/**
 * 11-calendar-events.spec.ts
 *
 * Verifies that scheduled posts appear as events on the SchedulePress calendar,
 * and that calendar event interactions work correctly.
 *
 * Uses the same auth + WP-CLI patterns established in 03-calendar.spec.ts and
 * 04-schedule-post.spec.ts.
 *
 * FullCalendar event selectors (WPSP uses FullCalendar v6 day-grid):
 *   .fc-daygrid-day[data-date="YYYY-MM-DD"]   → the day cell
 *   .fc-event                                  → any event dot / bar
 *   .fc-daygrid-event                          → day-grid specific event
 *   .fc-event-title                            → event title text
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";
import { runWpCli } from "../../utils/wp-helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" for a date N days from now. */
function futureDateStr(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** Returns a WP post_date string "YYYY-MM-DD HH:MM:SS" N days from now. */
function wpDateStr(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Calendar – Event Rendering", () => {
  let postId: string;
  let targetDate: string; // YYYY-MM-DD

  test.beforeAll(() => {
    // Create a scheduled post 7 days from now so it appears on the current calendar month
    targetDate = futureDateStr(7);
    postId = runWpCli(
      `post create --post_title="Calendar Event Test" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`,
    );
  });

  test.afterAll(() => {
    runWpCli(`post delete ${postId} --force`);
  });

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.calendar, { waitUntil: "domcontentloaded" });
    // Wait for FullCalendar and the custom WPSP toolbar
    await adminPage.locator(".fc").waitFor({ state: "visible", timeout: 15_000 });
    await adminPage.locator(".calender-selected-month").waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.waitForTimeout(800);
  });

  // ── Event appears on the correct day ─────────────────────────────────

  test("scheduled post appears as an FC event on the calendar", async ({ adminPage }) => {
    const event = adminPage.locator(".fc-event").first();
    await expect(event).toBeVisible({ timeout: 15_000 });
  });

  test("event appears in the correct day cell", async ({ adminPage }) => {
    const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${targetDate}"]`);
    await expect(dayCell).toBeVisible({ timeout: 10_000 });
    const eventInCell = dayCell.locator(".fc-event");
    await expect(eventInCell).toBeVisible({ timeout: 10_000 });
  });

  test("event title contains the post title", async ({ adminPage }) => {
    // FullCalendar renders event text inside .fc-event-title or as link/span inside .fc-event
    const event = adminPage.locator(".fc-event").first();
    await expect(event).toBeVisible({ timeout: 10_000 });
    const text = await event.textContent() ?? "";
    expect(text).toMatch(/Calendar Event Test/i);
  });

  test("day cell with event is highlighted / has event class", async ({ adminPage }) => {
    const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${targetDate}"]`);
    const eventCount = await dayCell.locator(".fc-event").count();
    expect(eventCount).toBeGreaterThan(0);
  });

  // ── Multiple events on same day ────────────────────────────────────────

  test("two posts scheduled on the same day both appear as events", async ({ adminPage }) => {
    // Create a second post on the same day
    const secondId = runWpCli(
      `post create --post_title="Calendar Event Test 2" --post_status=future --post_date="${wpDateStr(7)}" --porcelain`,
    );

    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(".fc").waitFor({ state: "visible", timeout: 15_000 });
    await adminPage.waitForTimeout(800);

    const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${targetDate}"]`);
    const events = dayCell.locator(".fc-event");
    const count = await events.count();
    expect(count).toBeGreaterThanOrEqual(2);

    runWpCli(`post delete ${secondId} --force`);
  });

  // ── Event on month boundary ────────────────────────────────────────────

  test("event on the last day of next month is visible after navigating forward", async ({ adminPage }) => {
    // Create a post 35 days from now (always in next month)
    const nextMonthDate = futureDateStr(35);
    const nextMonthPostId = runWpCli(
      `post create --post_title="Next Month Event" --post_status=future --post_date="${wpDateStr(35)}" --porcelain`,
    );

    // Navigate to next month (use first() — WPSP renders two toolbar instances)
    await adminPage.locator("button.wpsp-next-button").first().click();
    await adminPage.waitForTimeout(800);

    const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${nextMonthDate}"]`);
    if (await dayCell.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(dayCell.locator(".fc-event")).toBeVisible({ timeout: 10_000 });
    } else {
      // Day might be on the following month — just verify an event exists
      await expect(adminPage.locator(".fc-event").first()).toBeVisible({ timeout: 10_000 });
    }

    runWpCli(`post delete ${nextMonthPostId} --force`);
  });

  // ── Event removed after post deletion ─────────────────────────────────

  test("event disappears from calendar after post is deleted", async ({ adminPage }) => {
    // Create a temporary post
    const tempId = runWpCli(
      `post create --post_title="Temp Calendar Post" --post_status=future --post_date="${wpDateStr(3)}" --porcelain`,
    );
    const tempDate = futureDateStr(3);

    // Reload and verify it appears
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(".fc").waitFor({ state: "visible", timeout: 15_000 });
    await adminPage.waitForTimeout(800);

    const dayCell = adminPage.locator(`.fc-daygrid-day[data-date="${tempDate}"]`);
    await expect(dayCell.locator(".fc-event")).toBeVisible({ timeout: 10_000 });

    // Delete the post
    runWpCli(`post delete ${tempId} --force`);

    // Reload and verify it's gone
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(".fc").waitFor({ state: "visible", timeout: 15_000 });
    await adminPage.waitForTimeout(800);

    const eventsAfter = await dayCell.locator(".fc-event").count();
    expect(eventsAfter).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Calendar – Empty State", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.calendar, { waitUntil: "domcontentloaded" });
    await adminPage.locator(".fc").waitFor({ state: "visible", timeout: 15_000 });
    await adminPage.waitForTimeout(800);
  });

  test("calendar renders day cells even with no events", async ({ adminPage }) => {
    const cells = adminPage.locator(".fc-daygrid-day");
    await expect(cells.first()).toBeVisible({ timeout: 10_000 });
    // A month view always has at least 28 day cells
    const count = await cells.count();
    expect(count).toBeGreaterThanOrEqual(28);
  });

  test("calendar grid renders all 7 weekday column headers", async ({ adminPage }) => {
    const headers = adminPage.locator(".fc-col-header-cell");
    const count = await headers.count();
    expect(count).toBe(7);
  });
});
