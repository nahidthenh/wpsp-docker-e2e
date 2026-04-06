/**
 * 07-settings-save.spec.ts
 *
 * Verifies that SchedulePress settings persist after saving via the React
 * settings UI. Each test:
 *   1. Navigates to the relevant settings tab
 *   2. Changes a toggle / field value
 *   3. Clicks "Save Changes"
 *   4. Waits for the success response
 *   5. Reloads the page
 *   6. Confirms the value is still persisted
 *
 * Save button: button.components-button.wprf-submit-button
 * Toggle pattern: .wprf-control-wrapper[class*="wprf-name-{field}"] input[type="checkbox"]
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Click Save Changes and wait for the network request to settle. */
async function saveSettings(adminPage: import("@playwright/test").Page) {
  // Multiple "Save Changes" buttons exist (one per settings section).
  // Use evaluate() to click the first actually-visible one in the DOM.
  // Multiple Save Changes buttons exist — click the first visible one via JS
  await adminPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button.wprf-submit-button"));
    const visible = btns.find((b) => b.offsetParent !== null);
    visible?.click();
  });
  await adminPage.waitForTimeout(1500);
}

/** Returns the checked state of a toggle scoped to the text label. */
async function getToggleState(
  adminPage: import("@playwright/test").Page,
  labelText: string | RegExp,
): Promise<boolean> {
  const wrapper = adminPage.locator(".wprf-control-wrapper").filter({ hasText: labelText }).first();
  const checkbox = wrapper.locator("input[type='checkbox']").first();
  return checkbox.isChecked();
}

/** Click the toggle for the given label text and return new state. */
async function clickToggle(
  adminPage: import("@playwright/test").Page,
  labelText: string | RegExp,
) {
  const wrapper = adminPage.locator(".wprf-control-wrapper").filter({ hasText: labelText }).first();
  const label = wrapper.locator("label.wprf-switch, label").first();
  await label.click();
  await adminPage.waitForTimeout(300);
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Settings – Save & Persist (General Tab)", () => {
  const NAV = 'li.wprf-tab-nav-item[data-key="layout_general"]';

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);
  });

  test("Save Changes button is visible on General tab", async ({ adminPage }) => {
    const btn = adminPage.locator("button.components-button.wprf-submit-button, button.wprf-submit-button").first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  test("Save Changes button is enabled", async ({ adminPage }) => {
    const btn = adminPage.locator("button.components-button.wprf-submit-button, button.wprf-submit-button").first();
    await expect(btn).toBeEnabled({ timeout: 10_000 });
  });

  test("'Dashboard Widget' toggle can be turned ON and persists after reload", async ({ adminPage }) => {
    const wasPreviouslyOn = await getToggleState(adminPage, /Dashboard Widget/i);

    // Ensure it is ON
    if (!wasPreviouslyOn) await clickToggle(adminPage, /Dashboard Widget/i);
    await saveSettings(adminPage);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);

    expect(await getToggleState(adminPage, /Dashboard Widget/i)).toBe(true);
  });

  test("'Dashboard Widget' toggle can be turned OFF and persists after reload", async ({ adminPage }) => {
    // Ensure it is OFF
    const isOn = await getToggleState(adminPage, /Dashboard Widget/i);
    if (isOn) await clickToggle(adminPage, /Dashboard Widget/i);
    await saveSettings(adminPage);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);

    expect(await getToggleState(adminPage, /Dashboard Widget/i)).toBe(false);
  });

  test("'Show Scheduled Posts in Admin Bar' toggle state persists", async ({ adminPage }) => {
    const initial = await getToggleState(adminPage, /Show Scheduled Posts in Admin Bar/i);
    // Toggle it
    await clickToggle(adminPage, /Show Scheduled Posts in Admin Bar/i);
    await saveSettings(adminPage);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);

    const after = await getToggleState(adminPage, /Show Scheduled Posts in Admin Bar/i);
    expect(after).toBe(!initial);

    // Restore
    await clickToggle(adminPage, /Show Scheduled Posts in Admin Bar/i);
    await saveSettings(adminPage);
  });

  test("'Show Publish Post Immediately Button' toggle state persists", async ({ adminPage }) => {
    const initial = await getToggleState(adminPage, /Show Publish Post Immediately Button/i);
    await clickToggle(adminPage, /Show Publish Post Immediately Button/i);
    await saveSettings(adminPage);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);

    const after = await getToggleState(adminPage, /Show Publish Post Immediately Button/i);
    expect(after).toBe(!initial);

    // Restore
    await clickToggle(adminPage, /Show Publish Post Immediately Button/i);
    await saveSettings(adminPage);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Settings – Save & Persist (Email Notify Tab)", () => {
  const NAV = 'li.wprf-tab-nav-item[data-key="layout_email_notify"]';

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);
  });

  test("'Under Review' notify toggle state persists after save", async ({ adminPage }) => {
    const initial = await getToggleState(adminPage, /Under Review/i);
    await clickToggle(adminPage, /Under Review/i);
    await saveSettings(adminPage);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);

    expect(await getToggleState(adminPage, /Under Review/i)).toBe(!initial);

    // Restore
    await clickToggle(adminPage, /Under Review/i);
    await saveSettings(adminPage);
  });

  test("'Notify User when post is Scheduled' toggle state persists", async ({ adminPage }) => {
    const initial = await getToggleState(adminPage, /post is.*Scheduled/i);
    await clickToggle(adminPage, /post is.*Scheduled/i);
    await saveSettings(adminPage);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(500);

    expect(await getToggleState(adminPage, /post is.*Scheduled/i)).toBe(!initial);

    // Restore
    await clickToggle(adminPage, /post is.*Scheduled/i);
    await saveSettings(adminPage);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Settings – Save & Persist (Social Templates Tab)", () => {
  const NAV = 'li.wprf-tab-nav-item[data-key="layout_social_template"]';
  const FACEBOOK_NAV = 'li.wprf-tab-nav-item[data-key="layouts_facebook"]';

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(600);
    await adminPage.locator(FACEBOOK_NAV).click();
    await adminPage.waitForTimeout(400);
  });

  test("Facebook template structure value persists after save", async ({ adminPage }) => {
    const templateInput = adminPage.locator("input[name='template_structure'][parent*='facebook']").first();
    await expect(templateInput).toBeVisible({ timeout: 10_000 });

    const original = await templateInput.inputValue();
    const testValue = original + " #test";

    await templateInput.fill(testValue);
    await saveSettings(adminPage);

    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV).click();
    await adminPage.waitForTimeout(600);
    await adminPage.locator(FACEBOOK_NAV).click();
    await adminPage.waitForTimeout(400);

    const persisted = await adminPage.locator("input[name='template_structure'][parent*='facebook']").first().inputValue();
    expect(persisted).toBe(testValue);

    // Restore original value
    await adminPage.locator("input[name='template_structure'][parent*='facebook']").first().fill(original);
    await saveSettings(adminPage);
  });
});
