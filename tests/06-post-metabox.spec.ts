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

import { test, expect } from "../fixtures/base-fixture";
import { dismissWelcomeGuide } from "../utils/wp-helpers";

/** Wait for Gutenberg toolbar and the plugin button — replaces fixed timeouts. */
async function waitForEditorReady(adminPage: import("@playwright/test").Page): Promise<void> {
  await adminPage.locator(".editor-header__toolbar, .edit-post-header-toolbar").first().waitFor({ state: "visible", timeout: 30_000 });
  await adminPage.locator("#wpsp-post-panel-button").waitFor({ state: "visible", timeout: 20_000 });
}

/** Open the Gutenberg sidebar if it is currently closed. */
async function ensureSidebarOpen(adminPage: import("@playwright/test").Page): Promise<void> {
  const sidebar = adminPage.locator(".interface-interface-skeleton__sidebar");
  if (!(await sidebar.isVisible({ timeout: 3_000 }).catch(() => false))) {
    const settingsBtn = adminPage.locator('button[aria-label="Settings"]').first();
    if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsBtn.click();
      await sidebar.waitFor({ state: "visible", timeout: 5_000 });
    }
  }
}

test.describe("SchedulePress Post Panel – Schedule And Share", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/post-new.php?post_type=post", { waitUntil: "domcontentloaded" });

    // Dismiss Welcome Guide first — on CI (fresh install) it always appears
    await dismissWelcomeGuide(adminPage);

    // Wait for editor + plugin React app to be fully ready (no fixed timeouts)
    await waitForEditorReady(adminPage);

    // Ensure sidebar is visible for sidebar-dependent tests
    await ensureSidebarOpen(adminPage);
  });

  // ── Trigger button ─────────────────────────────────────────────────────

  test("'Schedule And Share' button is visible on new post page", async ({ adminPage }) => {
    await expect(adminPage.locator("#wpsp-post-panel-button")).toBeVisible({ timeout: 10_000 });
  });

  test("'Schedule And Share' button has correct label", async ({ adminPage }) => {
    const btn = adminPage.locator("#wpsp-post-panel-button");
    await expect(btn).toContainText(/Schedule And Share/i, { timeout: 10_000 });
  });
})