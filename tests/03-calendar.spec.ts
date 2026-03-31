/**
 * 03-calendar.spec.ts
 *
 * Verifies the SchedulePress Calendar page (admin.php?page=schedulepress-calendar).
 *
 * The calendar is built with FullCalendar v6 (@fullcalendar/react 6.1.8).
 * Key DOM landmarks verified against the plugin source:
 *   .fc                  — FullCalendar root
 *   .fc-toolbar          — Toolbar (prev / title / next / today)
 *   .fc-toolbar-title    — "March 2026" style heading
 *   button.fc-prev-button
 *   button.fc-next-button
 *   button.fc-today-button
 *   .fc-event            — Individual calendar events
 */

import { test, expect } from "../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../utils/selectors";

test.describe("SchedulePress Calendar", () => {

  test.beforeEach(async ({ adminPage }) => {
    // Navigate directly — sidebar link is in a collapsed sub-menu and unreliable to click
    await adminPage.goto(SCHEDULE_PRESS.urls.calendar, { waitUntil: "domcontentloaded" });
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
    const fc = adminPage.locator(SCHEDULE_PRESS.calendar.root).first();
    await expect(fc).toBeVisible({ timeout: 20_000 });
  });

  test("calendar toolbar is visible", async ({ adminPage }) => {
    const toolbar = adminPage.locator(SCHEDULE_PRESS.calendar.toolbar).first();
    await expect(toolbar).toBeVisible({ timeout: 20_000 });
  });

  test("calendar title shows a 4-digit year", async ({ adminPage }) => {
    const title = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    await expect(title).toBeVisible({ timeout: 20_000 });
    const text = await title.textContent() ?? "";
    expect(text).toMatch(/\d{4}/);
  });

  test("prev-month button is visible and enabled", async ({ adminPage }) => {
    const btn = adminPage.locator(SCHEDULE_PRESS.calendar.prevBtn).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await expect(btn).toBeEnabled();
  });

  test("next-month button is visible and enabled", async ({ adminPage }) => {
    const btn = adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await expect(btn).toBeEnabled();
  });

  test("today button is visible", async ({ adminPage }) => {
    const btn = adminPage.locator(SCHEDULE_PRESS.calendar.todayBtn).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
  });

  test("day-grid cells are rendered (days of the month)", async ({ adminPage }) => {
    const dayGrid = adminPage.locator(SCHEDULE_PRESS.calendar.dayGrid).first();
    await expect(dayGrid).toBeVisible({ timeout: 20_000 });
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  test("clicking next-month changes the calendar title", async ({ adminPage }) => {
    const title  = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    await expect(title).toBeVisible({ timeout: 20_000 });

    const before = await title.textContent();

    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(600); // allow React re-render

    const after = await title.textContent();
    expect(after).not.toBe(before);
  });

  test("clicking prev-month after next restores original title", async ({ adminPage }) => {
    const title = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    await expect(title).toBeVisible({ timeout: 20_000 });

    const original = await title.textContent();

    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(600);

    await adminPage.locator(SCHEDULE_PRESS.calendar.prevBtn).first().click();
    await adminPage.waitForTimeout(600);

    const restored = await title.textContent();
    expect(restored).toBe(original);
  });

  test("clicking today button keeps current month visible", async ({ adminPage }) => {
    const title = adminPage.locator(SCHEDULE_PRESS.calendar.title).first();
    await expect(title).toBeVisible({ timeout: 20_000 });
    const original = await title.textContent();

    // Go forward 2 months, then hit Today
    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator(SCHEDULE_PRESS.calendar.nextBtn).first().click();
    await adminPage.waitForTimeout(400);
    await adminPage.locator(SCHEDULE_PRESS.calendar.todayBtn).first().click();
    await adminPage.waitForTimeout(600);

    const backToToday = await title.textContent();
    expect(backToToday).toBe(original);
  });
});
