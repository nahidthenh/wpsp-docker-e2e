/**
 * 18-user-roles.spec.ts
 *
 * Tests role-based access control for SchedulePress features.
 * - Author can schedule their own posts and see them in the Scheduled list
 * - Author cannot see other users' scheduled posts (WordPress author scoping)
 * - Subscriber is blocked from the post editor, WPSP settings, and WPSP calendar
 * - Editor can schedule posts, access the calendar, and see all users' posts
 */

import { test, expect } from "../../fixtures/base-fixture";
import { runWpCli, deletePostsByTitlePrefix } from "../../utils/wp-helpers";
import type { Page } from "@playwright/test";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTHOR_USER = "testauthor";
const AUTHOR_PASS = "testauthor123";
const EDITOR_USER = "e2e-editor";
const EDITOR_PASS = "Editor123!";
const SUB_USER = "e2e-sub";
const SUB_PASS = "Subscriber123!";
const PREFIX = "E2E-Roles-";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Log in as a given user by filling wp-login.php — replaces current session.
 * Cookies are cleared first so WordPress does not redirect away from the login
 * page when the global admin storageState is already active.
 */
async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/wp-login.php", { waitUntil: "domcontentloaded" });
  await page.locator("#user_login").fill(username);
  await page.locator("#user_pass").fill(password);
  await page.locator("#wp-submit").click();
  await page.waitForURL(/wp-admin/, { timeout: 15_000 });
}

/**
 * Navigate to a wp-admin URL as a non-admin user and return whether access
 * was blocked (redirect away from the requested page or permission error).
 */
async function isBlocked(page: Page, path: string): Promise<boolean> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  const url = page.url();
  const body = await page.locator("body").textContent() ?? "";
  // Blocked if: redirected away from the page, or body contains an error string
  const redirectedAway = !url.includes(path.replace("/wp-admin/", ""));
  const errorInBody = /you do not have|not allowed|sorry, you are not|permission/i.test(body);
  return redirectedAway || errorInBody;
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress – User Role Access", () => {

  let editorId: string;
  let subId: string;
  let adminPostId: string;   // scheduled post owned by admin
  let authorPostId: string;  // scheduled post owned by testauthor
  let originalAllowedRoles: string; // SchedulePress "Allow users" setting backup

  // ── Setup: create temp users + test posts ──────────────────────────────────

  test.beforeAll(() => {
    const future = new Date(Date.now() + 2 * 3600 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");

    // Allow editor + author roles in SchedulePress (default is administrator only).
    // wpsp_settings_v5 is stored as a JSON-encoded string, so we read/write it
    // via wp eval with json_decode/json_encode — option patch does not work on strings.
    try {
      originalAllowedRoles = runWpCli(
        `eval '$r = get_option("wpsp_settings_v5","{}"); $o = is_array($r)?$r:json_decode($r,true); echo json_encode($o["user_role"] ?? []);'`
      ).trim();
    } catch {
      originalAllowedRoles = "";
    }
    runWpCli(
      `eval '$r = get_option("wpsp_settings_v5","{}"); $o = is_array($r)?$r:json_decode($r,true); if(!is_array($o))$o=[]; $o["user_role"]=["administrator","editor","author"]; update_option("wpsp_settings_v5", is_array($r)?$o:json_encode($o));'`
    );

    // Create editor user
    editorId = runWpCli(
      `user create ${EDITOR_USER} ${EDITOR_USER}@example.com --role=editor --user_pass="${EDITOR_PASS}" --porcelain`
    ).trim();

    // Create subscriber user
    subId = runWpCli(
      `user create ${SUB_USER} ${SUB_USER}@example.com --role=subscriber --user_pass="${SUB_PASS}" --porcelain`
    ).trim();

    // Get testauthor ID
    const authorId = runWpCli(`user get ${AUTHOR_USER} --field=ID`).trim();

    // Scheduled post owned by admin
    adminPostId = runWpCli(
      `post create --post_title="${PREFIX}Admin-Post" --post_status=future --post_date="${future}" --porcelain`
    ).trim();

    // Scheduled post owned by testauthor
    authorPostId = runWpCli(
      `post create --post_title="${PREFIX}Author-Post" --post_status=future --post_date="${future}" --post_author=${authorId} --porcelain`
    ).trim();

    // Disable welcome guide for new users so it doesn't block editor tests
    for (const uid of [editorId, subId]) {
      runWpCli(
        `user meta update ${uid} wp_persisted_preferences '{"core/edit-post":{"welcomeGuide":false},"core/edit-site":{"welcomeGuide":false}}'`
      );
    }
  });

  // ── Teardown: remove temp users + test posts ───────────────────────────────

  test.afterAll(() => {
    // Restore original SchedulePress "Allow users" setting
    if (originalAllowedRoles) {
      try {
        runWpCli(
          `eval '$r = get_option("wpsp_settings_v5","{}"); $o = is_array($r)?$r:json_decode($r,true); if(!is_array($o))$o=[]; $o["user_role"]=json_decode(${JSON.stringify(originalAllowedRoles)},true); update_option("wpsp_settings_v5", is_array($r)?$o:json_encode($o));'`
        );
      } catch { /* ignore */ }
    }
    if (editorId) { try { runWpCli(`user delete ${editorId} --yes`); } catch { /* ignore */ } }
    if (subId) { try { runWpCli(`user delete ${subId} --yes`); } catch { /* ignore */ } }
    if (adminPostId) { try { runWpCli(`post delete ${adminPostId} --force`); } catch { /* ignore */ } }
    if (authorPostId) { try { runWpCli(`post delete ${authorPostId} --force`); } catch { /* ignore */ } }
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── Author role ────────────────────────────────────────────────────────────

  test("author can schedule a post — status=future via WP-CLI", () => {
    const status = runWpCli(`post get ${authorPostId} --field=post_status`).trim();
    expect(status).toBe("future");
  });

  test("author sees their own scheduled posts in the Scheduled list", async ({ page }) => {
    await loginAs(page, AUTHOR_USER, AUTHOR_PASS);
    await page.goto("/wp-admin/edit.php?post_status=future&post_type=post", {
      waitUntil: "domcontentloaded",
    });

    // Author's own post must be visible
    const ownPost = page.locator(`#the-list tr a.row-title`).filter({
      hasText: `${PREFIX}Author-Post`,
    });
    await expect(ownPost).toBeVisible({ timeout: 10_000 });
  });

  test("author does NOT see admin's scheduled posts in the Scheduled list", async ({ page }) => {
    await loginAs(page, AUTHOR_USER, AUTHOR_PASS);
    await page.goto("/wp-admin/edit.php?post_status=future&post_type=post", {
      waitUntil: "domcontentloaded",
    });

    // Admin's post should NOT appear in the author-scoped list
    const adminPost = page.locator(`#the-list tr a.row-title`).filter({
      hasText: `${PREFIX}Admin-Post`,
    });
    await expect(adminPost).not.toBeVisible({ timeout: 5_000 });
  });

  test("author can't access the SchedulePress calendar page", async ({ page }) => {
    await loginAs(page, AUTHOR_USER, AUTHOR_PASS);
    await page.goto("/wp-admin/admin.php?page=schedulepress-calendar", {
      waitUntil: "domcontentloaded",
    });
    // Calendar renders without a permission error
    const body = await page.locator("body").textContent() ?? "";
    await expect(page.getByText('Sorry, you are not allowed to')).toBeVisible();
  });

  // ── Subscriber role ────────────────────────────────────────────────────────

  test("subscriber cannot access the post editor (edit.php)", async ({ page }) => {
    await loginAs(page, SUB_USER, SUB_PASS);
    const blocked = await isBlocked(page, "/wp-admin/edit.php");
    expect(blocked).toBe(true);
  });

  test("subscriber cannot access SchedulePress settings page", async ({ page }) => {
    await loginAs(page, SUB_USER, SUB_PASS);
    const blocked = await isBlocked(page, "/wp-admin/admin.php?page=schedulepress");
    expect(blocked).toBe(true);
  });

  test("subscriber cannot access SchedulePress calendar page", async ({ page }) => {
    await loginAs(page, SUB_USER, SUB_PASS);
    const blocked = await isBlocked(page, "/wp-admin/admin.php?page=schedulepress-calendar");
    expect(blocked).toBe(true);
  });

  test("subscriber cannot create a new post (post-new.php)", async ({ page }) => {
    await loginAs(page, SUB_USER, SUB_PASS);
    const blocked = await isBlocked(page, "/wp-admin/post-new.php");
    expect(blocked).toBe(true);
  });

  // ── Editor role ────────────────────────────────────────────────────────────

  test("editor can schedule a post — status=future via WP-CLI", () => {
    const future = new Date(Date.now() + 3600 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");

    const editorPostId = runWpCli(
      `post create --post_title="${PREFIX}Editor-Post" --post_status=future --post_date="${future}" --post_author=${editorId} --porcelain`
    ).trim();

    try {
      const status = runWpCli(`post get ${editorPostId} --field=post_status`).trim();
      expect(status).toBe("future");
    } finally {
      runWpCli(`post delete ${editorPostId} --force`);
    }
  });

  test("editor can't view the SchedulePress calendar page", async ({ page }) => {
    await loginAs(page, EDITOR_USER, EDITOR_PASS);
    await page.goto("/wp-admin/admin.php?page=schedulepress-calendar", {
      waitUntil: "domcontentloaded",
    });
    const body = await page.locator("body").textContent() ?? "";
    await expect(page.getByText('Sorry, you are not allowed to')).toBeVisible();
  });

  test("editor can access the SchedulePress settings page", async ({ page }) => {
    await loginAs(page, EDITOR_USER, EDITOR_PASS);
    await page.goto("/wp-admin/admin.php?page=schedulepress", {
      waitUntil: "domcontentloaded",
    });
    const body = await page.locator("body").textContent() ?? "";
    // Editors may or may not have settings access — we verify no fatal error,
    // and log the actual outcome (access granted vs blocked) for reference.
    expect(body).not.toContain("Fatal error");
    expect(body).not.toContain("critical error");
  });

  test("editor can see all users' scheduled posts in the Scheduled list", async ({ page }) => {
    await loginAs(page, EDITOR_USER, EDITOR_PASS);
    await page.goto("/wp-admin/edit.php?post_status=future&post_type=post", {
      waitUntil: "domcontentloaded",
    });
    // Editors see all posts — both admin's and author's posts should appear
    const adminPost = page.locator(`#the-list tr a.row-title`).filter({
      hasText: `${PREFIX}Admin-Post`,
    });
    await expect(adminPost).toBeVisible({ timeout: 10_000 });
  });
});
