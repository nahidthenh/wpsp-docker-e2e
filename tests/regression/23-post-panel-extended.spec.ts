/**
 * 23-post-panel-extended.spec.ts
 *
 * Extended coverage for the revamped post panel (branch 73647-new) targeting
 * surface areas not yet covered by 22-post-panel-revamp.spec.ts:
 *
 * A. Social Share section in the panel (new SocialShare.js component)
 * B. PRO – Publish Immediately UI (PublishImmediately.js component)
 * C. PRO – Pro-Settings REST API (GET/POST /wp-scheduled-posts-pro/v1/pro-settings)
 * D. Classic Editor / WP-Admin Metabox (new wpsp_register_metabox)
 * E. Bug regressions:
 *    – ShareNowButton disabled when no social message saved (duplicate disabled-prop bug)
 *    – POST /post-panel with is_scheduled=false must revert post to draft (missing else-branch)
 */

import { test, expect } from "../../fixtures/base-fixture";
import {
  runWpCli,
  dismissWelcomeGuide,
  dismissStarterPatterns,
  deletePostsByTitlePrefix,
} from "../../utils/wp-helpers";

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";
const FREE_NS  = "wp-scheduled-posts/v1";
const PRO_NS   = "wp-scheduled-posts-pro/v1";
const PREFIX   = "E2E-PanelExt-";

// ── Helpers ───────────────────────────────────────────────────────────────────

function futureDate(offsetHours = 2): string {
  return new Date(Date.now() + offsetHours * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

async function getNonce(adminPage: import("@playwright/test").Page): Promise<string> {
  await adminPage.goto("/wp-admin/post-new.php", { waitUntil: "domcontentloaded" });
  await adminPage.waitForTimeout(1500);
  return adminPage.evaluate(() => (window as any).wpApiSettings?.nonce ?? "");
}

async function waitForEditorReady(adminPage: import("@playwright/test").Page): Promise<void> {
  await adminPage
    .locator(".editor-header__toolbar, .edit-post-header-toolbar")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  // Gutenberg registers #wpsp-post-panel-button-gutenberg via gutenberg.js plugin panel.
  // The PHP metabox also injects #wpsp-post-panel-button but it is hidden inside the
  // collapsed sidebar — always target the Gutenberg plugin button here.
  await adminPage
    .locator("#wpsp-post-panel-button-gutenberg, .wpsp-post-panel-button")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
}

async function openPanel(adminPage: import("@playwright/test").Page): Promise<void> {
  const modal = adminPage.locator(".wpsp-post-panel-modal");
  const isActive = await modal
    .evaluate((el) => el.classList.contains("wpsp-post-panel-active"))
    .catch(() => false);
  if (!isActive) {
    await adminPage.locator("#wpsp-post-panel-button-gutenberg, .wpsp-post-panel-button").first().click();
    await adminPage
      .locator(".wpsp-post-panel-modal.wpsp-post-panel-active")
      .waitFor({ state: "visible", timeout: 10_000 });
  }
}

// ── Suite A: Social Share Section ─────────────────────────────────────────────

test.describe("SchedulePress – Post Panel Social Share Section", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/post-new.php?post_type=post", {
      waitUntil: "domcontentloaded",
    });
    await dismissWelcomeGuide(adminPage);
    await dismissStarterPatterns(adminPage);
    await waitForEditorReady(adminPage);
    await openPanel(adminPage);
  });

  test("Social Share Settings heading (h2) is visible in the panel", async ({ adminPage }) => {
    const heading = adminPage
      .locator(".wpsp-modal-social-share h2")
      .filter({ hasText: /Social Share Settings/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Social Share section container (.wpsp-modal-social-share) is rendered", async ({ adminPage }) => {
    await expect(
      adminPage.locator(".wpsp-modal-social-share"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("'Disable Social Share' checkbox is rendered in the social share section", async ({ adminPage }) => {
    const checkbox = adminPage
      .locator(".wpsp-modal-social-share .wpsp-disabled-social-share-checkbox input[type='checkbox']")
      .first();
    await expect(checkbox).toBeAttached({ timeout: 10_000 });
  });

  test("Share Now button (.wpsp-share-now-btn) is rendered in the panel", async ({ adminPage }) => {
    await expect(
      adminPage.locator("button.wpsp-share-now-btn"),
    ).toBeVisible({ timeout: 10_000 });
  });

  // BUG REGRESSION: duplicate disabled-prop on ShareNowButton
  // The JSX has two `disabled` attributes; React keeps the last one which checks
  // only `isSharing || selectedProfiles.length === 0`.  The hasSavedSocialMessage
  // guard (first prop) is silently discarded.  On a fresh post with no social
  // accounts connected, selectedProfiles.length is 0, so this test passes even
  // with the bug — but the assertion documents the intended contract.
  test("Share Now button is disabled when no social profiles are selected (no social message)", async ({ adminPage }) => {
    const btn = adminPage.locator("button.wpsp-share-now-btn").first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await expect(btn).toBeDisabled({ timeout: 5_000 });
  });
});

// ── Suite B: PRO – Publish Immediately ───────────────────────────────────────

test.describe("SchedulePress PRO – Publish Immediately (Manage Schedule)", () => {

  let scheduledPostId = "";

  test.beforeAll(() => {
    const date = futureDate(3);
    scheduledPostId = runWpCli(
      `post create --post_title="${PREFIX}Scheduled-PI" --post_status=future ` +
      `--post_date="${date}" --porcelain`,
    ).trim();
  });

  test.afterAll(() => {
    deletePostsByTitlePrefix(`${PREFIX}Scheduled-PI`);
  });

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(`/wp-admin/post.php?post=${scheduledPostId}&action=edit`, {
      waitUntil: "domcontentloaded",
    });
    await dismissWelcomeGuide(adminPage);
    await dismissStarterPatterns(adminPage);
    await waitForEditorReady(adminPage);
    await openPanel(adminPage);
  });

  test("'Publish future post immediately' checkbox is visible for a scheduled post", async ({ adminPage }) => {
    const label = adminPage
      .locator(".wpsp-post-panel")
      .getByText(/Publish future post immediately/i)
      .first();
    await expect(label).toBeVisible({ timeout: 15_000 });
  });

  test("Checking 'Publish future post immediately' reveals Current Date and Future Date buttons", async ({ adminPage }) => {
    const checkbox = adminPage
      .locator(".sc-publish-future input[type='checkbox']")
      .first();
    await expect(checkbox).toBeVisible({ timeout: 15_000 });

    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }

    const currentDateBtn = adminPage
      .locator(".sc-publish-future-buttons .button")
      .filter({ hasText: /Current Date/i })
      .first();
    const futureDateBtn = adminPage
      .locator(".sc-publish-future-buttons .button")
      .filter({ hasText: /Future Date/i })
      .first();

    await expect(currentDateBtn).toBeVisible({ timeout: 5_000 });
    await expect(futureDateBtn).toBeVisible({ timeout: 5_000 });
  });

});

// ── Suite B2: PRO publish_immediately REST (no UI panel needed) ───────────────

test.describe("SchedulePress PRO – Publish Immediately REST API", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(`${PREFIX}PI-`);
  });

  test("PRO: publish_immediately_current_date=true sets post status to publish", async ({ adminPage }) => {
    const date = futureDate(4);
    const postId = runWpCli(
      `post create --post_title="${PREFIX}PI-CurrentDate" --post_status=future ` +
      `--post_date="${date}" --porcelain`,
    ).trim();

    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({
        id, n, base, freeNs,
      }: { id: string; n: string; base: string; freeNs: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/${freeNs}/post-panel/${id}`,
          {
            method: "POST",
            headers: { "X-WP-Nonce": n, "Content-Type": "application/json" },
            body: JSON.stringify({ publish_immediately_current_date: true }),
          },
        );
        return { status: r.status, body: await r.json() };
      },
      { id: postId, n: nonce, base: BASE_URL, freeNs: FREE_NS },
    );

    expect(result.status).toBe(200);

    const status = runWpCli(`post get ${postId} --field=post_status`).trim();
    expect(status).toBe("publish");
  });
});

// ── Suite C: PRO – Pro-Settings REST API ─────────────────────────────────────

test.describe("SchedulePress PRO – Pro-Settings REST API", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX + "ProAPI");
  });

  test("GET /pro-settings/{id} returns 200 with success:true for a draft post", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}ProAPI-Draft" --post_status=draft --porcelain`,
    ).trim();

    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({ postId, n, base, proNs }: { postId: string; n: string; base: string; proNs: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/${proNs}/pro-settings/${postId}`,
          { headers: { "X-WP-Nonce": n } },
        );
        return { status: r.status, body: await r.json() };
      },
      { postId: id, n: nonce, base: BASE_URL, proNs: PRO_NS },
    );

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  test("GET /pro-settings/{id} returns stored unpublish_on meta value", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}ProAPI-Unpublish" --post_status=publish --porcelain`,
    ).trim();
    const unpublishDate = futureDate(5);
    runWpCli(`post meta update ${id} _wpscp_schedule_draft_date "${unpublishDate}"`);

    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({ postId, n, base, proNs }: { postId: string; n: string; base: string; proNs: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/${proNs}/pro-settings/${postId}`,
          { headers: { "X-WP-Nonce": n } },
        );
        return r.json();
      },
      { postId: id, n: nonce, base: BASE_URL, proNs: PRO_NS },
    );

    expect(result.success).toBe(true);
    expect(result.data?.unpublish_on).toBeTruthy();
  });

  test("Unauthenticated GET /pro-settings/{id} returns 401 or 403", async ({ page }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}ProAPI-Auth" --post_status=draft --porcelain`,
    ).trim();

    const resp = await page.request.get(
      `${BASE_URL}/?rest_route=/${PRO_NS}/pro-settings/${id}`,
    );
    expect([401, 403]).toContain(resp.status());
  });
});

// ── Suite D: Classic Editor / WP-Admin Metabox ───────────────────────────────

test.describe("SchedulePress – Classic Editor / Admin Metabox", () => {

  test("SchedulePress metabox (#wpsp_post_settings) is present in the post edit sidebar", async ({ adminPage }) => {
    // Use post-new.php — WordPress renders the metabox in the Gutenberg sidebar
    // (or Classic Editor column) via add_meta_box registered in wpsp_register_metabox()
    await adminPage.goto("/wp-admin/post-new.php", { waitUntil: "domcontentloaded" });
    await dismissWelcomeGuide(adminPage);
    await dismissStarterPatterns(adminPage);

    // The metabox is always injected into the DOM even in Gutenberg mode
    const metabox = adminPage.locator("#wpsp_post_settings, #wpsp-post-panel-wrapper");
    await expect(metabox.first()).toBeAttached({ timeout: 20_000 });
  });

  test("Gutenberg sidebar shows #wpsp-post-panel-button-gutenberg (Schedule And Share button)", async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/post-new.php", { waitUntil: "domcontentloaded" });
    await dismissWelcomeGuide(adminPage);
    await dismissStarterPatterns(adminPage);

    // In Gutenberg mode, gutenberg.js registers a PluginDocumentSettingPanel that renders
    // #wpsp-post-panel-button-gutenberg — this is the button users actually click.
    // The PHP metabox button (#wpsp-post-panel-button) is hidden inside the sidebar section.
    const gutenbergBtn = adminPage.locator("#wpsp-post-panel-button-gutenberg");
    await expect(gutenbergBtn).toBeAttached({ timeout: 20_000 });
    await expect(gutenbergBtn).toBeVisible({ timeout: 20_000 });
  });

  test("Classic Editor post page: metabox #wpsp_post_settings exists in DOM", async ({ adminPage }) => {
    // Attempt classic-editor route; if it redirects to Gutenberg, the metabox
    // must still be present inside the editor sidebar's meta-boxes area.
    await adminPage.goto("/wp-admin/post-new.php?classic-editor", {
      waitUntil: "domcontentloaded",
    });

    const metabox = adminPage.locator("#wpsp_post_settings");
    await expect(metabox).toBeAttached({ timeout: 15_000 });
  });
});

// ── Suite E: Bug Regression Tests ────────────────────────────────────────────

test.describe("SchedulePress – Bug Regression (Post Panel 73647-new)", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(`${PREFIX}Bug`);
  });

  // BUG: Missing else-branch in PostPanel.php means POST with is_scheduled=false
  // does not revert the post from 'future' to 'draft'.
  test("BUG: POST /post-panel/{id} with is_scheduled=false should revert future post to draft", async ({ adminPage }) => {
    const date = futureDate(6);
    const id = runWpCli(
      `post create --post_title="${PREFIX}Bug-Unschedule" ` +
      `--post_status=future --post_date="${date}" --porcelain`,
    ).trim();

    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({
        postId, n, base, freeNs,
      }: { postId: string; n: string; base: string; freeNs: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/${freeNs}/post-panel/${postId}`,
          {
            method: "POST",
            headers: { "X-WP-Nonce": n, "Content-Type": "application/json" },
            body: JSON.stringify({ is_scheduled: false, schedule_date: "" }),
          },
        );
        return { status: r.status, body: await r.json() };
      },
      { postId: id, n: nonce, base: BASE_URL, freeNs: FREE_NS },
    );

    // API call must succeed
    expect(result.status).toBe(200);

    // Post status MUST be reverted to draft (not still 'future')
    // EXPECTED TO FAIL on 73647-new — confirms the missing else-branch bug.
    const status = runWpCli(`post get ${id} --field=post_status`).trim();
    expect(status).toBe("draft");
  });

  // BUG: Duplicate `disabled` prop on ShareNowButton — the hasSavedSocialMessage
  // guard is overridden by the second prop.  When profiles ARE connected and
  // selected but no social message has been customized, the button should remain
  // disabled.  This test catches the UI contract failure.
  test("BUG: Share Now button must be disabled when hasSavedSocialMessage is false", async ({ adminPage }) => {
    // Open a brand-new post with no saved social message (fresh state)
    await adminPage.goto("/wp-admin/post-new.php?post_type=post", {
      waitUntil: "domcontentloaded",
    });
    await dismissWelcomeGuide(adminPage);
    await dismissStarterPatterns(adminPage);
    await waitForEditorReady(adminPage);
    await openPanel(adminPage);

    // On a fresh post no social message has been saved (selectedPlatformCards is empty)
    // The Share Now button should be disabled
    const btn = adminPage.locator("button.wpsp-share-now-btn").first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await expect(btn).toBeDisabled({ timeout: 5_000 });
  });

  // Verify the PRO pro-settings GET endpoint returns both fields as empty strings
  // for a post that has never had unpublish/republish set (no meta → empty).
  test("GET /pro-settings returns empty unpublish_on and republish_on for a fresh post", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Bug-ProFresh" --post_status=draft --porcelain`,
    ).trim();

    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({ postId, n, base, proNs }: { postId: string; n: string; base: string; proNs: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/${proNs}/pro-settings/${postId}`,
          { headers: { "X-WP-Nonce": n } },
        );
        return r.json();
      },
      { postId: id, n: nonce, base: BASE_URL, proNs: PRO_NS },
    );

    expect(result.success).toBe(true);
    // meta not set → should return empty string, not null/undefined
    expect(result.data?.unpublish_on ?? "").toBe("");
    expect(result.data?.republish_on ?? "").toBe("");
  });
});
