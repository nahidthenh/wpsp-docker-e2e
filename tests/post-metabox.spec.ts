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
    // Button may render as full text ("Schedule And Share") or icon-only depending on environment.
    // Check accessible name (covers aria-label, title, and text content).
    await expect(btn).toHaveAccessibleName(/schedule and share|wpsp/i, { timeout: 10_000 });
  });

  // ── Modal open / close ─────────────────────────────────────────────────

  test("clicking 'Schedule And Share' opens the panel modal", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator(".wpsp-post-panel-modal")).toBeVisible({ timeout: 10_000 });
  });

});