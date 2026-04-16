/**
 * calendar-draft-time-preservation.spec.ts
 *
 * Bug verification: When a user creates a post from the SchedulePress calendar
 * "Add New" modal and sets a specific time, the saved post must retain that
 * exact time — NOT a random/default time.
 *
 * Reported issue:
 *   1. Open SchedulePress calendar
 *   2. Click "Add New" on a day cell → modal appears
 *   3. Enter a title and change the time (e.g. 2:30 PM)
 *   4. Click "Save"
 *   Expected → post_date stores 14:30
 *   Actual   → post_date contains a random/incorrect time
 *
 * Modal structure (verified from live DOM):
 *   - [role="dialog"]  — the modal container
 *   - #title           — post title input
 *   - aria-label "Hours"   — number input (12-hour format, 1–12)
 *   - aria-label "Minutes" — number input (0–59)
 *   - aria-label "AM" / "PM" — radio-style toggle buttons
 *   - aria-label "Month" / "Day" / "Year" — date fields (pre-filled)
 *   - button.wpsp-submit-button — Save
 *
 * Verification strategy:
 *   - Playwright drives the exact UI flow the user follows
 *   - WP-CLI reads post_date back from the database (ground truth)
 *   - Assert saved HH:MM equals the intended time
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";
import { runWpCli } from "../../utils/wp-helpers";
import { Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Wait for FullCalendar + WPSP toolbar to be fully ready. */
async function waitForCalendar(page: Page): Promise<void> {
  await page.locator(".fc").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".calender-selected-month").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
}

/** "YYYY-MM-DD" for N days from today (UTC). */
function futureDateStr(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/**
 * Navigate to calendar, click "Add New" on the target day cell, and wait
 * for the create-post modal to appear.
 */
async function openAddNewModal(page: Page, dateStr: string): Promise<void> {
  await page.goto(SCHEDULE_PRESS.urls.calendar, { waitUntil: "domcontentloaded" });
  await waitForCalendar(page);

  const dayCell = page.locator(`.fc-daygrid-day[data-date="${dateStr}"]`).first();
  await expect(dayCell).toBeVisible({ timeout: 10_000 });

  // Click the "Add New" button inside this specific day cell
  await dayCell.getByRole("button", { name: "Add New" }).click();

  // Wait for the WPSP create-post modal
  await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 8_000 });
}

/**
 * Fill in the time fields inside the modal.
 * The modal uses 12-hour format with separate AM/PM toggle buttons.
 *
 * @param page         Playwright page
 * @param hour12       Hour in 12-hour format (1–12)
 * @param minute       Minutes (0–59)
 * @param ampm         "AM" or "PM"
 */
async function setModalTime(
  page: Page,
  hour12: number,
  minute: number,
  ampm: "AM" | "PM"
): Promise<void> {
  const modal = page.locator('[role="dialog"]').first();

  // Hours field — triple-click to select existing value, then type
  const hoursInput = modal.getByLabel("Hours");
  await hoursInput.click({ clickCount: 3 });
  await hoursInput.fill(String(hour12));
  await hoursInput.press("Tab");

  // Minutes field
  const minutesInput = modal.getByLabel("Minutes");
  await minutesInput.click({ clickCount: 3 });
  await minutesInput.fill(String(minute).padStart(2, "0"));
  await minutesInput.press("Tab");

  // AM / PM toggle (radio buttons)
  const ampmBtn = modal.getByRole("radio", { name: ampm });
  if (await ampmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const isSelected = await ampmBtn.getAttribute("aria-checked");
    if (isSelected !== "true") {
      await ampmBtn.click();
    }
  }
}

/**
 * Click the "Save" button in the modal and wait for it to close.
 */
async function saveModal(page: Page): Promise<void> {
  const modal = page.locator('[role="dialog"]').first();
  await modal.locator("button.wpsp-submit-button").click();

  // Wait for modal to dismiss + any AJAX to settle
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}

/**
 * Fetch the persisted post_date via WP-CLI (ground truth).
 * Returns "YYYY-MM-DD HH:MM:SS".
 */
function getPostDate(title: string): string {
  const raw = runWpCli(
    `post list --post_title="${title}" --post_status=any ` +
    `--fields=ID,post_date --format=json`
  );
  const posts: Array<{ ID: string; post_date: string }> = JSON.parse(raw || "[]");
  expect(
    posts.length,
    `WP-CLI found no post titled "${title}" — was it saved?`
  ).toBeGreaterThan(0);
  return posts[0].post_date;
}

/**
 * Convert 12-hour time → "HH:MM" (24-hour) for assertion.
 * e.g. (2, 30, "PM") → "14:30"  |  (12, 0, "AM") → "00:00"
 */
function to24hhmm(hour12: number, minute: number, ampm: "AM" | "PM"): string {
  let h = hour12;
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Calendar – Draft Post Time Preservation (Bug Verification)", () => {

  // ── Primary test: 2:30 PM ─────────────────────────────────────────────────

  test(
    "post created from calendar modal must save with user-set time 2:30 PM (14:30), not a random time",
    async ({ adminPage, trackPost }) => {
      const targetDate   = futureDateStr(5);
      const postTitle    = `E2E-Cal-DraftTime-${Date.now()}`;
      const hour12       = 2;
      const minute       = 30;
      const ampm         = "PM" as const;
      const intendedHHMM = to24hhmm(hour12, minute, ampm); // "14:30"

      trackPost(postTitle);

      // Open "Add New" modal for the target day
      await openAddNewModal(adminPage, targetDate);

      // Fill title + content (both are required fields in the modal)
      await adminPage.locator('[role="dialog"] #title').fill(postTitle);
      await adminPage.locator('[role="dialog"] #content').fill("E2E test post body.");

      // Set time to 2:30 PM
      await setModalTime(adminPage, hour12, minute, ampm);

      // Save
      await saveModal(adminPage);

      // Verify via WP-CLI
      const savedDate  = getPostDate(postTitle);
      const savedHHMM  = savedDate.slice(11, 16); // "HH:MM"

      expect(
        savedHHMM,
        `BUG CONFIRMED: post saved with time "${savedHHMM}" but user set "${intendedHHMM}" (2:30 PM). ` +
        `The calendar modal is NOT preserving the user-provided time.`
      ).toBe(intendedHHMM);
    }
  );

  // ── Secondary test: 9:15 AM — rules out lucky coincidence ────────────────

  test(
    "post created from calendar modal must save with user-set time 9:15 AM (09:15), not a random time",
    async ({ adminPage, trackPost }) => {
      const targetDate   = futureDateStr(7);
      const postTitle    = `E2E-Cal-DraftTime2-${Date.now()}`;
      const hour12       = 9;
      const minute       = 15;
      const ampm         = "AM" as const;
      const intendedHHMM = to24hhmm(hour12, minute, ampm); // "09:15"

      trackPost(postTitle);

      await openAddNewModal(adminPage, targetDate);
      await adminPage.locator('[role="dialog"] #title').fill(postTitle);
      await adminPage.locator('[role="dialog"] #content').fill("E2E test post body.");
      await setModalTime(adminPage, hour12, minute, ampm);
      await saveModal(adminPage);

      const savedDate  = getPostDate(postTitle);
      const savedHHMM  = savedDate.slice(11, 16);

      expect(
        savedHHMM,
        `BUG CONFIRMED: post saved with time "${savedHHMM}" but user set "${intendedHHMM}" (9:15 AM). ` +
        `The calendar modal is NOT preserving the user-provided time.`
      ).toBe(intendedHHMM);
    }
  );

  // ── Tertiary test: date (day) must also be preserved ─────────────────────

  test(
    "post created from calendar must land on the clicked day, not on today",
    async ({ adminPage, trackPost }) => {
      const targetDate   = futureDateStr(10);
      const postTitle    = `E2E-Cal-DraftDate-${Date.now()}`;
      const hour12       = 11;
      const minute       = 0;
      const ampm         = "AM" as const;
      const intendedHHMM = to24hhmm(hour12, minute, ampm); // "11:00"

      trackPost(postTitle);

      await openAddNewModal(adminPage, targetDate);
      await adminPage.locator('[role="dialog"] #title').fill(postTitle);
      await adminPage.locator('[role="dialog"] #content').fill("E2E test post body.");
      await setModalTime(adminPage, hour12, minute, ampm);
      await saveModal(adminPage);

      const savedDate    = getPostDate(postTitle);
      const savedDateStr = savedDate.slice(0, 10);  // "YYYY-MM-DD"
      const savedHHMM    = savedDate.slice(11, 16); // "HH:MM"

      // The day must match the cell that was clicked
      expect(
        savedDateStr,
        `Post was created by clicking "${targetDate}" but stored date is "${savedDateStr}". ` +
        `The calendar did not correctly assign the clicked day to the post.`
      ).toBe(targetDate);

      // The time must also match
      expect(
        savedHHMM,
        `Date was correct but time "${savedHHMM}" does not match user-set time "${intendedHHMM}" (11:00 AM).`
      ).toBe(intendedHHMM);
    }
  );
});
