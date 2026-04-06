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
    // Expand the SchedulePress sidebar panel first — this triggers full React initialization,
    // after which the toolbar "Schedule And Share" button renders with its text label.
    await adminPage.getByRole("button", { name: "SchedulePress", exact: true }).click();
    await expect(adminPage.getByRole("button", { name: "Schedule And Share" })).toBeVisible({ timeout: 10_000 });
  });

  // ── Modal open / close ─────────────────────────────────────────────────

  test("clicking 'Schedule And Share' opens the panel modal", async ({ adminPage }) => {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await expect(adminPage.locator(".wpsp-post-panel-modal")).toBeVisible({ timeout: 10_000 });
  });

});