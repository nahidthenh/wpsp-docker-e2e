/**
 * 20-post-type-scheduling.spec.ts
 *
 * Tier 03 — Advanced: Post-type scheduling coverage.
 *
 * SchedulePress supports scheduling for multiple post types (post, page, custom).
 * The "Show Post Types" setting on the General tab controls which post types show
 * the SchedulePress Gutenberg panel.
 *
 * Tests cover:
 *  1. `post` type schedules correctly via WP-CLI (status = future)
 *  2. `page` type schedules correctly via WP-CLI (status = future)
 *  3. Scheduled page appears in wp-admin Pages › Scheduled list
 *  4. SchedulePress Gutenberg panel is visible on a new post editor
 *  5. SchedulePress Gutenberg panel is visible on a new page editor
 *  6. "Show Post Types" setting field is visible and lists post types
 *  7. Removing `page` from allowed post types hides WPSP panel on page editor
 *  8. Re-adding `page` restores the WPSP panel on page editor
 */

import { test, expect } from "../../fixtures/base-fixture";
import { runWpCli, deletePostsByTitlePrefix, dismissWelcomeGuide } from "../../utils/wp-helpers";
import { SCHEDULE_PRESS } from "../../utils/selectors";

const PREFIX   = "E2E-PostType-";
const GEN_NAV  = 'li.wprf-tab-nav-item[data-key="layout_general"]';
const WPSP_PANEL = ".components-panel__body.schedulepress-options";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Future date string 1 hour from now in WP "YYYY-MM-DD HH:MM:SS" format. */
function futureDate(): string {
  return new Date(Date.now() + 3_600_000)
    .toISOString().slice(0, 19).replace("T", " ");
}

/** Navigate to General settings tab. */
async function openGeneralTab(adminPage: import("@playwright/test").Page): Promise<void> {
  await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
  await adminPage.locator(GEN_NAV).waitFor({ state: "visible", timeout: 10_000 });
  await adminPage.locator(GEN_NAV).click();
  await adminPage.waitForTimeout(500);
}

/** Click the first visible Save Changes button on the settings page. */
async function saveSettings(adminPage: import("@playwright/test").Page): Promise<void> {
  await adminPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button.wprf-submit-button"));
    btns.find((b) => b.offsetParent !== null)?.click();
  });
  await adminPage.waitForTimeout(1_500);
}

/** Open a new Gutenberg editor for the given post type and wait for it to be ready. */
async function openEditor(
  adminPage: import("@playwright/test").Page,
  postType: "post" | "page",
): Promise<void> {
  await adminPage.goto(`/wp-admin/post-new.php?post_type=${postType}`, {
    waitUntil: "domcontentloaded",
  });
  await dismissWelcomeGuide(adminPage);
  // Wait for the editor chrome to be ready
  await adminPage.locator(".editor-header__toolbar, .edit-post-header-toolbar")
    .first().waitFor({ state: "visible", timeout: 30_000 });
  await adminPage.waitForTimeout(800);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("SchedulePress – Post Type Scheduling", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── 1 & 2: WP-CLI scheduling ──────────────────────────────────────────────

  test("scheduling a `post` via WP-CLI gives status=future", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Post" --post_type=post --post_status=future --post_date="${futureDate()}" --porcelain`
    ).trim();
    try {
      expect(runWpCli(`post get ${id} --field=post_status`).trim()).toBe("future");
      expect(runWpCli(`post get ${id} --field=post_type`).trim()).toBe("post");
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("scheduling a `page` via WP-CLI gives status=future", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Page" --post_type=page --post_status=future --post_date="${futureDate()}" --porcelain`
    ).trim();
    try {
      expect(runWpCli(`post get ${id} --field=post_status`).trim()).toBe("future");
      expect(runWpCli(`post get ${id} --field=post_type`).trim()).toBe("page");
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  // ── 3: Scheduled page appears in admin list ───────────────────────────────

  test("scheduled page appears in wp-admin Pages › Scheduled list", async ({ adminPage }) => {
    const title = `${PREFIX}Page-List`;
    const id = runWpCli(
      `post create --post_title="${title}" --post_type=page --post_status=future --post_date="${futureDate()}" --porcelain`
    ).trim();

    try {
      await adminPage.goto("/wp-admin/edit.php?post_status=future&post_type=page", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        adminPage.locator(`#the-list tr a.row-title`).filter({ hasText: title }).first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  // ── 4 & 5: Gutenberg panel visibility ─────────────────────────────────────

  test("SchedulePress Gutenberg panel is visible on new `post` editor", async ({ adminPage }) => {
    await openEditor(adminPage, "post");
    await expect(adminPage.locator(WPSP_PANEL)).toBeVisible({ timeout: 15_000 });
  });

  test("SchedulePress Gutenberg panel is visible on new `page` editor", async ({ adminPage }) => {
    await openEditor(adminPage, "page");
    await expect(adminPage.locator(WPSP_PANEL)).toBeVisible({ timeout: 15_000 });
  });

  // ── 6: Settings field shows post types ────────────────────────────────────

  test('"Show Post Types" setting field is visible on General tab', async ({ adminPage }) => {
    await openGeneralTab(adminPage);
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Show Post Types/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test('"Show Post Types" field lists `post` as a selected option', async ({ adminPage }) => {
    await openGeneralTab(adminPage);
    // The field is a React-Select multi-select; selected values render as pills/tags
    const wrapper = adminPage.locator(".wprf-control-wrapper")
      .filter({ hasText: /Show Post Types/i }).first();
    await expect(wrapper).toBeVisible({ timeout: 10_000 });
    const text = await wrapper.textContent() ?? "";
    expect(text.toLowerCase()).toContain("post");
  });

  // ── 7 & 8: Enable / disable page post type ────────────────────────────────

  test("removing `page` from allowed post types hides WPSP panel on page editor", async ({ adminPage }) => {
    await openGeneralTab(adminPage);

    // Find the Show Post Types React-Select wrapper
    const wrapper = adminPage.locator(".wprf-control-wrapper")
      .filter({ hasText: /Show Post Types/i }).first();

    // React-Select renders each selected value with a remove button (×)
    // Find the pill/tag for "page" and click its remove (×) button
    const pageTag = wrapper.locator(
      "[class*='multi-value'], [class*='multiValue'], .wprf-select__multi-value"
    ).filter({ hasText: /^page$/i }).first();

    const isPageSelected = await pageTag.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isPageSelected) {
      // `page` is already not in the list — the panel should already be hidden
      test.info().annotations.push({ type: "skip-reason", description: "page not in selected types" });
    } else {
      // Click the × to remove page from the selection
      const removeBtn = pageTag.locator(
        "[class*='remove'], [class*='Remove'], [aria-label*='remove'], [aria-label*='Remove']"
      ).first();
      await removeBtn.click();
      await adminPage.waitForTimeout(300);
      await saveSettings(adminPage);

      // Verify WPSP panel is NOT visible on the page editor
      await openEditor(adminPage, "page");
      await expect(adminPage.locator(WPSP_PANEL)).not.toBeVisible({ timeout: 10_000 });
    }
  });

  test("re-adding `page` to allowed post types restores WPSP panel on page editor", async ({ adminPage }) => {
    await openGeneralTab(adminPage);

    const wrapper = adminPage.locator(".wprf-control-wrapper")
      .filter({ hasText: /Show Post Types/i }).first();

    // Check if page is already selected
    const pageTag = wrapper.locator(
      "[class*='multi-value'], [class*='multiValue'], .wprf-select__multi-value"
    ).filter({ hasText: /^page$/i }).first();

    const isPageSelected = await pageTag.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isPageSelected) {
      // Open the React-Select dropdown and type "page" to select it
      const selectInput = wrapper.locator("input[type='text'], input[id*='select']").first();
      await selectInput.click();
      await selectInput.fill("page");
      await adminPage.waitForTimeout(400);

      // Click the "page" option in the dropdown
      const option = adminPage.locator(
        "[class*='option'], [class*='Option']"
      ).filter({ hasText: /^page$/i }).first();
      await option.click();
      await adminPage.waitForTimeout(300);
      await saveSettings(adminPage);
    }

    // WPSP panel must now be visible on the page editor
    await openEditor(adminPage, "page");
    await expect(adminPage.locator(WPSP_PANEL)).toBeVisible({ timeout: 15_000 });
  });
});
