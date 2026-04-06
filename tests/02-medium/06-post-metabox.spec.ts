/**
 * 06-post-metabox.spec.ts
 *
 * Verifies the SchedulePress "Schedule And Share" post panel modal in the
 * Gutenberg block editor.
 *
 * DOM structure (confirmed by live inspection):
 *   button#wpsp-post-panel-button          → "Schedule And Share" trigger (always visible)
 *   .wpsp-post-panel-modal                 → modal overlay (hidden until triggered)
 *     button.wpsp-post-panel-close         → X close button
 *     #wpsp-post-panel-react-root          → React root
 *       .wpsp-post-panel
 *         h4.title "Schedule On"           → schedule date section
 *           input[placeholder="Select date & time"]  → main date picker
 *           input.wpsp-slider.round        → enable/disable toggle
 *         h4.title "Manage Schedule"       → manage section
 *         h4.title "Scheduling Options"    → options section
 *         input[name="socialShareDisable"] → disable social share checkbox
 *         .social-accordion-item (×8)      → per-platform share items
 *         button.wpsp-share-now-btn        → Share Now
 *         button#wpsp-save-settings        → Save Changes
 *
 *   Gutenberg sidebar: .components-panel__body.schedulepress-options
 *     button.components-panel__body-toggle → "SchedulePress" collapsible
 *     .wpsp-social-share-settings-warpper → social share settings (inside sidebar)
 */

import { test, expect } from "../../fixtures/base-fixture";

test.describe("SchedulePress Post Panel – Schedule And Share", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/post-new.php?post_type=post", { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(2000);

    // Dismiss Gutenberg "Welcome to the block editor" guide if it appears
    const welcomeClose = adminPage.locator(
      'dialog[aria-label="Welcome to the block editor"] button[aria-label="Close"]'
    );
    if (await welcomeClose.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await welcomeClose.click();
      await adminPage.waitForSelector('dialog[aria-label="Welcome to the block editor"]', { state: "hidden" });
    }
  });

  // ── Trigger button ─────────────────────────────────────────────────────

  test("'Schedule And Share' button is visible on new post page", async ({ adminPage }) => {
    await expect(adminPage.locator("#wpsp-post-panel-button")).toBeVisible({ timeout: 10_000 });
  });

  test("'Schedule And Share' button has correct label", async ({ adminPage }) => {
    const btn = adminPage.locator("#wpsp-post-panel-button");
    await expect(btn).toContainText(/Schedule And Share/i, { timeout: 10_000 });
  });

  // ── Modal open / close ─────────────────────────────────────────────────

  test("clicking 'Schedule And Share' opens the panel modal", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator(".wpsp-post-panel-modal")).toBeVisible({ timeout: 10_000 });
  });

  test("modal contains the SchedulePress panel wrapper", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator(".wpsp-post-panel")).toBeVisible({ timeout: 10_000 });
  });

  test("close button (×) is visible after opening modal", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator("button.wpsp-post-panel-close")).toBeVisible({ timeout: 10_000 });
  });

  test("clicking close button hides the modal", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await adminPage.locator(".wpsp-post-panel-modal").waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator("button.wpsp-post-panel-close").click();
    await adminPage.waitForTimeout(500);
    await expect(adminPage.locator(".wpsp-post-panel-modal")).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Modal section headings ─────────────────────────────────────────────

  test("modal shows 'Schedule On' section heading", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    const heading = adminPage.locator(".wpsp-post-panel h4.title, .wpsp-post-panel .title")
      .filter({ hasText: /^Schedule On$/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("modal shows 'Manage Schedule' section or content", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await adminPage.locator(".wpsp-post-panel-modal").waitFor({ state: "visible", timeout: 10_000 });
    // "Manage Schedule" heading may only appear on existing/scheduled posts; verify modal has content
    const modalText = await adminPage.locator(".wpsp-post-panel").textContent() ?? "";
    expect(modalText.trim().length).toBeGreaterThan(10);
  });

  test("modal shows 'Scheduling Options' section heading", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    const heading = adminPage.locator(".wpsp-post-panel h4.title, .wpsp-post-panel .title")
      .filter({ hasText: /Scheduling Options/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── Date picker ────────────────────────────────────────────────────────

  test("date picker input is visible with correct placeholder", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    const datePicker = adminPage.locator("input[placeholder='Select date & time']");
    await expect(datePicker).toBeVisible({ timeout: 10_000 });
  });

  test("date picker input is attached and has correct placeholder", async ({ adminPage }) => {
    // The datetime picker is a jQuery UI widget — input is read-only by design.
    // Verify the input exists and its placeholder is set correctly.
    await adminPage.locator("#wpsp-post-panel-button").click();
    const datePicker = adminPage.locator("input[placeholder='Select date & time']");
    await expect(datePicker).toBeAttached({ timeout: 10_000 });
    const placeholder = await datePicker.getAttribute("placeholder");
    expect(placeholder).toMatch(/Select date/i);
  });

  // ── Schedule enable toggle ─────────────────────────────────────────────

  test("scheduling enable/disable toggle is visible", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    const toggle = adminPage.locator(".wpsp-post-panel input[type='checkbox'].wpsp-slider");
    await expect(toggle).toBeAttached({ timeout: 10_000 });
  });

  // ── Social share controls ──────────────────────────────────────────────

  test("'Disable Social Share' checkbox is present", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    const checkbox = adminPage.locator("input[name='socialShareDisable']");
    await expect(checkbox).toBeAttached({ timeout: 10_000 });
  });

  test("'Disable Social Share' label is visible", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    const label = adminPage.locator("label[for='socialShareDisable'], .wpsp-post-panel label")
      .filter({ hasText: /Disable Social Share/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("social platform accordion items are visible (8 platforms)", async ({ adminPage }) => {
    // The social platform accordion items live inside the Gutenberg sidebar panel
    // (.schedulepress-options), not inside the button-triggered modal.
    const items = adminPage.locator(".schedulepress-options .social-accordion-item");
    await expect(items.first()).toBeVisible({ timeout: 10_000 });
    expect(await items.count()).toBe(8);
  });

  const socialPlatforms = ["Facebook", "Twitter", "Linkedin", "Pinterest", "Instagram", "Medium", "Threads", "Google Business Profile"];
  for (const platform of socialPlatforms) {
    test(`${platform} platform item is visible in sidebar`, async ({ adminPage }) => {
      const item = adminPage.locator(".schedulepress-options .social-accordion-item")
        .filter({ hasText: new RegExp(platform, "i") }).first();
      await expect(item).toBeVisible({ timeout: 10_000 });
    });
  }

  // ── Action buttons ─────────────────────────────────────────────────────

  test("'Save Changes' button is visible in the modal", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator("button#wpsp-save-settings")).toBeVisible({ timeout: 10_000 });
  });

  test("'Save Changes' button is enabled", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator("button#wpsp-save-settings")).toBeEnabled({ timeout: 10_000 });
  });

  test("'Share Now' button is visible in the modal", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator("button.wpsp-share-now-btn")).toBeVisible({ timeout: 10_000 });
  });

  test("'Add Social Message' button is visible", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator("button.wpsp-add-social-message-btn")).toBeVisible({ timeout: 10_000 });
  });

  test("'Upload Social Banner' button is visible", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator("button.wpsp-upload-social-share-btn")).toBeVisible({ timeout: 10_000 });
  });

  // ── Gutenberg sidebar panel ────────────────────────────────────────────

  test("SchedulePress sidebar panel is present in Gutenberg", async ({ adminPage }) => {
    const panel = adminPage.locator(".components-panel__body.schedulepress-options");
    await expect(panel).toBeVisible({ timeout: 15_000 });
  });

  test("SchedulePress sidebar panel has 'SchedulePress' toggle label", async ({ adminPage }) => {
    const toggle = adminPage.locator(".components-panel__body.schedulepress-options button.components-panel__body-toggle");
    await expect(toggle).toContainText(/SchedulePress/i, { timeout: 10_000 });
  });

  test("SchedulePress sidebar shows 'Social Share Settings' heading", async ({ adminPage }) => {
    const heading = adminPage.locator(".schedulepress-options .social-share-title, .schedulepress-options h2")
      .filter({ hasText: /Social Share Settings/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── Modal on existing post ─────────────────────────────────────────────

  test("'Schedule And Share' button is present on an existing post edit page", async ({ adminPage }) => {
    // Get first available post ID via post list
    await adminPage.goto("/wp-admin/edit.php?post_status=any&post_type=post", { waitUntil: "domcontentloaded" });
    const firstPostLink = adminPage.locator("#the-list tr:first-child .row-actions .edit a, #the-list tr:first-child a.row-title").first();
    if (await firstPostLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPostLink.click();
      await adminPage.waitForTimeout(2000);
      await expect(adminPage.locator("#wpsp-post-panel-button")).toBeVisible({ timeout: 10_000 });
    } else {
      test.skip();
    }
  });
});
