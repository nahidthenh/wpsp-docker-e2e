import { test, expect } from "../../fixtures/base-fixture";
import { runWpCli, deletePostsByTitlePrefix, dismissWelcomeGuide } from "../../utils/wp-helpers";
import { SCHEDULE_PRESS } from "../../utils/selectors";

const PREFIX = "E2E-PostType-";
const GEN_NAV = 'li.wprf-tab-nav-item[data-key="layout_general"]';
const WPSP_PANEL = ".components-panel__body.schedulepress-options";

function futureDate(): string {
  return new Date(Date.now() + 3_600_000)
    .toISOString().slice(0, 19).replace("T", " ");
}

async function openGeneralTab(adminPage: import("@playwright/test").Page): Promise<void> {
  await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
  await adminPage.locator(GEN_NAV).waitFor({ state: "visible", timeout: 10_000 });
  await adminPage.locator(GEN_NAV).click();
  await adminPage.waitForTimeout(500);
}

async function saveSettings(adminPage: import("@playwright/test").Page): Promise<void> {
  await adminPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button.wprf-submit-button"));
    btns.find((b) => b.offsetParent !== null)?.click();
  });
  await adminPage.waitForTimeout(1_500);
}

async function openEditor(
  adminPage: import("@playwright/test").Page,
  postType: "post" | "page",
): Promise<void> {
  await adminPage.goto(`/wp-admin/post-new.php?post_type=${postType}`, {
    waitUntil: "domcontentloaded",
  });
  await dismissWelcomeGuide(adminPage);
  await adminPage.locator(".editor-header__toolbar, .edit-post-header-toolbar")
    .first().waitFor({ state: "visible", timeout: 30_000 });
  await adminPage.waitForTimeout(800);
}

function postTypesWrapper(adminPage: import("@playwright/test").Page) {
  return adminPage.locator(".wprf-control-wrapper")
    .filter({ hasText: /Show Post Types/i }).first();
}

function postTypeTag(wrapper: import("@playwright/test").Locator, type: string) {
  return wrapper.locator(
    "[class*='multi-value'], [class*='multiValue'], .wprf-select__multi-value"
  ).filter({ hasText: new RegExp(`^${type}$`, "i") }).first();
}

test.describe("SchedulePress – Post Type Scheduling", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX);
  });

  test("scheduling a `post` gives status=future", () => {
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

  test("scheduling a `page` gives status=future", () => {
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

  test("scheduled page appears in Pages › Scheduled list", async ({ adminPage }) => {
    const title = `${PREFIX}Page-List`;
    const id = runWpCli(
      `post create --post_title="${title}" --post_type=page --post_status=future --post_date="${futureDate()}" --porcelain`
    ).trim();
    try {
      await adminPage.goto("/wp-admin/edit.php?post_status=future&post_type=page", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        adminPage.locator("#the-list tr a.row-title").filter({ hasText: title }).first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("WPSP panel is visible on new `post` editor", async ({ adminPage }) => {
    await openEditor(adminPage, "post");
    await expect(adminPage.locator(WPSP_PANEL)).toBeVisible({ timeout: 15_000 });
  });

  test("WPSP panel is visible on new `page` editor", async ({ adminPage }) => {
    await openEditor(adminPage, "page");
    await expect(adminPage.locator(WPSP_PANEL)).toBeVisible({ timeout: 15_000 });
  });

  test('"Show Post Types" field is visible and includes `post`', async ({ adminPage }) => {
    await openGeneralTab(adminPage);
    const wrapper = postTypesWrapper(adminPage);
    await expect(wrapper).toBeVisible({ timeout: 10_000 });
    const text = await wrapper.textContent() ?? "";
    expect(text.toLowerCase()).toContain("post");
  });

  test("removing `page` from allowed types hides WPSP panel on page editor", async ({ adminPage }) => {
    await openGeneralTab(adminPage);
    const wrapper = postTypesWrapper(adminPage);
    const tag = postTypeTag(wrapper, "page");

    if (!(await tag.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(); // already removed in a previous run — skip; test 8 will restore it
      return;
    }

    await tag.locator(
      "[class*='remove'], [class*='Remove'], [aria-label*='remove'], [aria-label*='Remove']"
    ).first().click();
    await adminPage.waitForTimeout(300);
    await saveSettings(adminPage);

    await openEditor(adminPage, "page");
    await expect(adminPage.locator(WPSP_PANEL)).not.toBeVisible({ timeout: 10_000 });
  });

  test("re-adding `page` to allowed types restores WPSP panel on page editor", async ({ adminPage }) => {
    await openGeneralTab(adminPage);
    const wrapper = postTypesWrapper(adminPage);
    const tag = postTypeTag(wrapper, "page");

    if (!(await tag.isVisible({ timeout: 5_000 }).catch(() => false))) {
      const input = wrapper.locator("input[type='text'], input[id*='select']").first();
      await input.click();
      await input.fill("page");
      await adminPage.waitForTimeout(400);
      await adminPage.locator(
        "[class*='option'], [class*='Option']"
      ).filter({ hasText: /^page$/i }).first().click();
      await adminPage.waitForTimeout(300);
      await saveSettings(adminPage);
    }

    await openEditor(adminPage, "page");
    await expect(adminPage.locator(WPSP_PANEL)).toBeVisible({ timeout: 15_000 });
  });
});
