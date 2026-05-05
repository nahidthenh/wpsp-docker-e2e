/**
 * 22-post-panel-revamp.spec.ts
 *
 * Verifies that the revamped SchedulePress post panel (branch 73647-new) retains
 * all existing user flows from master:
 *
 * UI structure:
 *  - "Schedule And Share" button opens modal; modal shows Schedule On, Manage Schedule,
 *    Scheduling Options sections plus Unpublish On / Republish On date pickers
 *  - PRO: Advanced Schedule toggle is visible inside Scheduling Options
 *  - Save Changes button (id="wpsp-save-settings") is visible and enabled
 *
 * REST API:
 *  - GET  /wp-scheduled-posts/v1/post-panel/{id} returns success + schedule_date
 *  - POST /wp-scheduled-posts/v1/post-panel/{id} with schedule_date → post becomes "future"
 *  - POST /wp-scheduled-posts/v1/post-panel/{id} with is_scheduled=false → post becomes "draft"
 *  - POST /wp-scheduled-posts/v1/post-panel/{id} with republish_on saves meta (PRO hook)
 *  - POST /wp-scheduled-posts/v1/post-panel/{id} with unpublish_on saves meta (PRO hook)
 *  - Unauthenticated POST returns 403
 */

import { test, expect } from "../../fixtures/base-fixture";
import { runWpCli, dismissWelcomeGuide, dismissStarterPatterns, deletePostsByTitlePrefix } from "../../utils/wp-helpers";

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";
const PREFIX = "E2E-PanelRevamp-";

// ── Helpers ───────────────────────────────────────────────────────────────────

function futureDate(offsetHours = 2): string {
  return new Date(Date.now() + offsetHours * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/** Return a WP REST nonce from an already-authenticated admin page. */
async function getNonce(adminPage: import("@playwright/test").Page): Promise<string> {
  await adminPage.goto("/wp-admin/post-new.php", { waitUntil: "domcontentloaded" });
  await adminPage.waitForTimeout(1500);
  return adminPage.evaluate(() => (window as any).wpApiSettings?.nonce ?? "");
}

/** Wait until the Gutenberg toolbar and the WPSP panel button are both ready. */
async function waitForEditorReady(adminPage: import("@playwright/test").Page): Promise<void> {
  await adminPage
    .locator(".editor-header__toolbar, .edit-post-header-toolbar")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await adminPage
    .locator("#wpsp-post-panel-button")
    .waitFor({ state: "visible", timeout: 20_000 });
}

/** Open the post panel modal if it is not already open. */
async function openPanel(adminPage: import("@playwright/test").Page): Promise<void> {
  const modal = adminPage.locator(".wpsp-post-panel-modal");
  const isActive = await modal.evaluate(
    (el) => el.classList.contains("wpsp-post-panel-active"),
  ).catch(() => false);
  if (!isActive) {
    await adminPage.locator("#wpsp-post-panel-button").click();
    await adminPage.locator(".wpsp-post-panel-modal.wpsp-post-panel-active").waitFor({
      state: "visible",
      timeout: 10_000,
    });
  }
}

// ── Suite 1: UI structure ─────────────────────────────────────────────────────

test.describe("SchedulePress – Revamped Post Panel UI", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/wp-admin/post-new.php?post_type=post", {
      waitUntil: "domcontentloaded",
    });
    await dismissWelcomeGuide(adminPage);
    await dismissStarterPatterns(adminPage);
    await waitForEditorReady(adminPage);
    await openPanel(adminPage);
  });

  // ── Modal open / close ─────────────────────────────────────────────────────

  test("panel modal opens with wpsp-post-panel-active class", async ({ adminPage }) => {
    await expect(
      adminPage.locator(".wpsp-post-panel-modal.wpsp-post-panel-active"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("close button hides the modal", async ({ adminPage }) => {
    await adminPage.locator("button.wpsp-post-panel-close").click();
    await expect(
      adminPage.locator(".wpsp-post-panel-modal.wpsp-post-panel-active"),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Schedule On section ────────────────────────────────────────────────────

  test("modal shows 'Schedule On' section heading (h4)", async ({ adminPage }) => {
    const heading = adminPage
      .locator(".wpsp-post-panel h4.title")
      .filter({ hasText: /^Schedule On$/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Schedule On section has date picker with placeholder 'Select date & time'", async ({ adminPage }) => {
    const input = adminPage
      .locator(".wpsp-post-panel input[placeholder='Select date & time']")
      .first();
    await expect(input).toBeAttached({ timeout: 10_000 });
  });

  // ── Manage Schedule section ────────────────────────────────────────────────

  test("modal shows 'Manage Schedule' section heading (h4)", async ({ adminPage }) => {
    const heading = adminPage
      .locator(".wpsp-post-panel h4.title")
      .filter({ hasText: /^Manage Schedule$/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── Scheduling Options section ─────────────────────────────────────────────

  test("modal shows 'Scheduling Options' section heading (h4)", async ({ adminPage }) => {
    const heading = adminPage
      .locator(".wpsp-post-panel h4.title")
      .filter({ hasText: /^Scheduling Options$/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Scheduling Options shows 'Unpublish On' sub-heading (h5)", async ({ adminPage }) => {
    const heading = adminPage
      .locator(".wpsp-post-panel h5.title")
      .filter({ hasText: /^Unpublish On$/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Scheduling Options shows 'Republish On' sub-heading (h5)", async ({ adminPage }) => {
    const heading = adminPage
      .locator(".wpsp-post-panel h5.title")
      .filter({ hasText: /^Republish On$/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Unpublish On field has date input (placeholder Y/M/D H:M:S)", async ({ adminPage }) => {
    const input = adminPage
      .locator(".wpsp-post-panel input[placeholder='Y/M/D H:M:S']")
      .first();
    await expect(input).toBeAttached({ timeout: 10_000 });
  });

  // ── PRO: Advanced Schedule ─────────────────────────────────────────────────

  test("PRO: Advanced Schedule wrapper is rendered in Scheduling Options", async ({ adminPage }) => {
    await expect(
      adminPage.locator(".wpsp-post-items-advanced-schedule-wrapper"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("PRO: Advanced Schedule shows its section title", async ({ adminPage }) => {
    const title = adminPage
      .locator(".wpsp-post-items-advanced-schedule-wrapper .title")
      .filter({ hasText: /Advanced Schedule/i })
      .first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  // ── Save Changes button ────────────────────────────────────────────────────

  test("Save Changes button (id=wpsp-save-settings) is visible", async ({ adminPage }) => {
    await expect(adminPage.locator("button#wpsp-save-settings")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Save Changes button is enabled", async ({ adminPage }) => {
    await expect(adminPage.locator("button#wpsp-save-settings")).toBeEnabled({
      timeout: 10_000,
    });
  });

  test("Save Changes button has class 'btn primary-btn'", async ({ adminPage }) => {
    const btn = adminPage.locator("button#wpsp-save-settings");
    await expect(btn).toHaveClass(/btn.*primary-btn|primary-btn.*btn/, {
      timeout: 10_000,
    });
  });
});

// ── Suite 2: REST API ─────────────────────────────────────────────────────────

test.describe("SchedulePress – New Post Panel REST API", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── GET endpoint ─────────────────────────────────────────────────────────

  test("GET /post-panel/{id} returns success:true for a draft post", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Draft-GET" --post_status=draft --porcelain`,
    ).trim();

    const nonce = await getNonce(adminPage);
    const result = await adminPage.evaluate(
      async ({ postId, n, base }: { postId: string; n: string; base: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/wp-scheduled-posts/v1/post-panel/${postId}`,
          { headers: { "X-WP-Nonce": n } },
        );
        return { status: r.status, body: await r.json() };
      },
      { postId: id, n: nonce, base: BASE_URL },
    );

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  test("GET /post-panel/{id} returns schedule_date for a scheduled post", async ({ adminPage }) => {
    const date = futureDate(3);
    const id = runWpCli(
      `post create --post_title="${PREFIX}Future-GET" --post_status=future ` +
      `--post_date="${date}" --porcelain`,
    ).trim();

    const nonce = await getNonce(adminPage);
    const result = await adminPage.evaluate(
      async ({ postId, n, base }: { postId: string; n: string; base: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/wp-scheduled-posts/v1/post-panel/${postId}`,
          { headers: { "X-WP-Nonce": n } },
        );
        return r.json();
      },
      { postId: id, n: nonce, base: BASE_URL },
    );

    expect(result.success).toBe(true);
    expect(result.data?.schedule_date).toBeTruthy();
    expect(result.data?.post_status).toBe("future");
  });

  // ── POST endpoint: schedule_date ──────────────────────────────────────────

  test("POST /post-panel/{id} with schedule_date sets post status to 'future'", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Schedule-POST" --post_status=draft --porcelain`,
    ).trim();

    const schedDate = futureDate(4);
    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({ postId, date, n, base }: { postId: string; date: string; n: string; base: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/wp-scheduled-posts/v1/post-panel/${postId}`,
          {
            method: "POST",
            headers: { "X-WP-Nonce": n, "Content-Type": "application/json" },
            body: JSON.stringify({ is_scheduled: true, schedule_date: date }),
          },
        );
        return { status: r.status, body: await r.json() };
      },
      { postId: id, date: schedDate, n: nonce, base: BASE_URL },
    );

    expect(result.status).toBe(200);

    const status = runWpCli(`post get ${id} --field=post_status`).trim();
    expect(status).toBe("future");
  });

  test("POST /post-panel/{id} with is_scheduled=false reverts scheduled post to draft", async ({ adminPage }) => {
    const date = futureDate(5);
    const id = runWpCli(
      `post create --post_title="${PREFIX}Unschedule-POST" ` +
      `--post_status=future --post_date="${date}" --porcelain`,
    ).trim();

    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({ postId, n, base }: { postId: string; n: string; base: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/wp-scheduled-posts/v1/post-panel/${postId}`,
          {
            method: "POST",
            headers: { "X-WP-Nonce": n, "Content-Type": "application/json" },
            body: JSON.stringify({ is_scheduled: false, schedule_date: "" }),
          },
        );
        return { status: r.status, body: await r.json() };
      },
      { postId: id, n: nonce, base: BASE_URL },
    );

    expect(result.status).toBe(200);

    const status = runWpCli(`post get ${id} --field=post_status`).trim();
    expect(status).toBe("draft");
  });

  // ── POST endpoint: republish_on (PRO hook) ────────────────────────────────

  test("POST /post-panel/{id} with republish_on saves _wpscp_schedule_republish_date (PRO)", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Republish-POST" --post_status=draft --porcelain`,
    ).trim();

    const republishDate = futureDate(6);
    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({ postId, rDate, n, base }: { postId: string; rDate: string; n: string; base: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/wp-scheduled-posts/v1/post-panel/${postId}`,
          {
            method: "POST",
            headers: { "X-WP-Nonce": n, "Content-Type": "application/json" },
            body: JSON.stringify({ republish_on: rDate }),
          },
        );
        return { status: r.status, body: await r.json() };
      },
      { postId: id, rDate: republishDate, n: nonce, base: BASE_URL },
    );

    expect(result.status).toBe(200);

    const stored = runWpCli(
      `post meta get ${id} _wpscp_schedule_republish_date`,
    ).trim();
    expect(stored).toBe(republishDate);
  });

  // ── POST endpoint: unpublish_on (PRO hook) ────────────────────────────────

  test("POST /post-panel/{id} with unpublish_on saves _wpscp_schedule_draft_date (PRO)", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Unpublish-POST" --post_status=publish --porcelain`,
    ).trim();

    const unpublishDate = futureDate(7);
    const nonce = await getNonce(adminPage);

    const result = await adminPage.evaluate(
      async ({ postId, uDate, n, base }: { postId: string; uDate: string; n: string; base: string }) => {
        const r = await fetch(
          `${base}/?rest_route=/wp-scheduled-posts/v1/post-panel/${postId}`,
          {
            method: "POST",
            headers: { "X-WP-Nonce": n, "Content-Type": "application/json" },
            body: JSON.stringify({ unpublish_on: uDate }),
          },
        );
        return { status: r.status, body: await r.json() };
      },
      { postId: id, uDate: unpublishDate, n: nonce, base: BASE_URL },
    );

    expect(result.status).toBe(200);

    const stored = runWpCli(
      `post meta get ${id} _wpscp_schedule_draft_date`,
    ).trim();
    expect(stored).toBe(unpublishDate);
  });

  // ── Auth boundary ─────────────────────────────────────────────────────────

  test("unauthenticated POST to /post-panel/{id} returns 401 or 403", async ({ page }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Auth-Check" --post_status=draft --porcelain`,
    ).trim();

    const resp = await page.request.post(
      `${BASE_URL}/?rest_route=/wp-scheduled-posts/v1/post-panel/${id}`,
      {
        data: { is_scheduled: false },
        headers: { "Content-Type": "application/json" },
      },
    );
    expect([401, 403]).toContain(resp.status());
  });
});
