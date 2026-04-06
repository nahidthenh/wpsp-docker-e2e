/**
 * 03-calendar.spec.ts
 *
 * Verifies the SchedulePress Calendar page (admin.php?page=schedulepress-calendar).
 *
 * DOM reality (confirmed by live inspection):
 *  - SchedulePress sets FullCalendar's headerToolbar to display:none
 *  - It renders its OWN navigation toolbar inside .wpsp-calender-content > .toolbar
 *  - The custom toolbar structure (verified from DOM):
 *      .toolbar
 *        .left   → post-type filter (checkbox-select)
 *        .middle → .calender-selected-month  ("April 2026" + dropdown)
 *        .right  → button.wpsp-prev-button | button.wpsp-next-button | button.today-btn
 *
 * FullCalendar selectors that ARE visible: .fc, .fc-daygrid, .fc-event
 * FullCalendar selectors that are HIDDEN:  .fc-header-toolbar, .fc-toolbar-title,
 *                                           button.fc-prev-button, button.fc-today-button
 */

import { test, expect } from "../../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../../utils/selectors";

test.describe("SchedulePress Calendar", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.calendar, { waitUntil: "domcontentloaded" });
    // Wait for the FullCalendar root and the custom toolbar to both be ready
    await adminPage.locator(SCHEDULE_PRESS.calendar.root).first()
      .waitFor({ state: "visible", timeout: 20_000 });
    await adminPage.locator(SCHEDULE_PRESS.calendar.title).first()
      .waitFor({ state: "visible", timeout: 20_000 });
  });

  // ── Page-level checks ────────────────────────────────────────────────────

  test("calendar page returns HTTP 200", async ({ adminPage }) => {
    const res = await adminPage.goto(SCHEDULE_PRESS.urls.calendar);
    expect(res?.status()).toBe(200);
  });

  test("calendar page loads without PHP fatal errors", async ({ adminPage }) => {
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toContain("Fatal error");
    expect(body).not.toContain("critical error");
    expect(body).not.toContain("Plugin file does not exist");
  });

  test("wp-admin chrome is intact on calendar page", async ({ adminPage }) => {
    await expect(adminPage.locator("#wpadminbar")).toBeVisible();
    await expect(adminPage.locator("#adminmenu")).toBeVisible();
  });

  // ── FullCalendar rendering ───────────────────────────────────────────────

  test("FullCalendar root (.fc) renders", async ({ adminPage }) => {
    await expect(adminPage.locator(SCHEDULE_PRESS.calendar.root).first()).toBeVisible();
  });

  test("calendar day-grid cells are rendered", async ({ adminPage }) => {
    await expect(adminPage.locator(SCHEDULE_PRESS.calendar.dayGrid).first()).toBeVisible();
  });

  // ── Custom SchedulePress toolbar ─────────────────────────────────────────
  // NOTE: FullCalendar's .fc-header-toolbar is display:none — WPSP replaces it

  test("custom toolbar is visible", async ({ adminPage }) => {
    const toolbar = adminPage.locator(".wpsp-calender-content .toolbar").first();
    await expect(toolbar).toBeVisible();
  });

  test("month/year title shows a 4-digit year", async ({ adminPage }) => {
    const title = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    await expect(title).toBeVisible();
    const text = await title.textContent() ?? "";
    expect(text).toMatch(/\d{4}/);
  });

  test("prev-month button is visible and enabled", async ({ adminPage }) => {
    const btn = adminPage.locator(SCHEDULE_PRESS.calendar.prevBtn).first();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("next-month button is visible and enabled", async ({ adminPage }) => {
    const btn = adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("today button is visible", async ({ adminPage }) => {
    const btn = adminPage.locator(SCHEDULE_PRESS.calendar.todayBtn).first();
    await expect(btn).toBeVisible();
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  test("clicking next-month changes the month/year title", async ({ adminPage }) => {
    const title = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    const before = await title.textContent();

    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(600);

    const after = await title.textContent();
    expect(after).not.toBe(before);
  });

  test("clicking prev-month after next restores original title", async ({ adminPage }) => {
    const title = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    const original = await title.textContent();

    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(600);
    await adminPage.locator(SCHEDULE_PRESS.calendar.prevBtn).first().click();
    await adminPage.waitForTimeout(600);

    expect(await title.textContent()).toBe(original);
  });

  test("clicking today button restores current month", async ({ adminPage }) => {
    const title = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    const original = await title.textContent();

    // Navigate away 2 months then back
    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator(SCHEDULE_PRESS.calendar.todayBtn).first().click();
    await adminPage.waitForTimeout(600);

    expect(await title.textContent()).toBe(original);
  });
});
