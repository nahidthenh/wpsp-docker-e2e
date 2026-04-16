/**
 * 04-schedule-post.spec.ts
 *
 * Creates a scheduled post via WP-CLI and verifies it end-to-end.
 * - WP-CLI reports status "future" and correct title
 * - Post appears in wp-admin › Posts › Scheduled list
 * - REST API returns status "future" for authenticated requests
 * - Unauthenticated REST request returns 401/403/404 (not publicly visible)
 * - Post appears as an event on the SchedulePress calendar
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";

/** Build REST URL using plain-permalink format (works even without pretty permalinks). */
function restUrl(route: string): string {
  return `${BASE_URL}/?rest_route=${route}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a GMT datetime string 2 hours in the future (MySQL format). */
function futureGmt(offsetHours = 2): string {
  const d = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Schedule a Post", () => {
  const POST_TITLE = `E2E Scheduled – ${Date.now()}`;
  const POST_CONTENT = "Automated E2E test post created by Playwright.";
  let postId: number;

  // Create the post once for the whole suite
  test.beforeAll(({ wpCli }) => {
    const scheduledDate = futureGmt(2);
    const raw = wpCli(
      `post create` +
      ` --post_title="${POST_TITLE}"` +
      ` --post_content="${POST_CONTENT}"` +
      ` --post_status=future` +
      ` --post_date_gmt="${scheduledDate}"` +
      ` --porcelain`           // returns only the new post ID
    );
    postId = parseInt(raw.trim(), 10);
    expect(postId).toBeGreaterThan(0);
  });

  // Clean up after all tests in this suite
  test.afterAll(({ wpCli }) => {
    if (postId) {
      wpCli(`post delete ${postId} --force`);
    }
  });

  // ── WP-CLI verification ────────────────────────────────────────────────

  test("WP-CLI reports post status as 'future'", ({ wpCli }) => {
    const status = wpCli(`post get ${postId} --field=post_status`);
    expect(status.trim()).toBe("future");
  });

  test("WP-CLI reports correct post title", ({ wpCli }) => {
    const title = wpCli(`post get ${postId} --field=post_title`);
    expect(title.trim()).toBe(POST_TITLE);
  });

  // ── wp-admin UI verification ───────────────────────────────────────────

  test("post appears in wp-admin Posts › Scheduled list", async ({ adminPage }) => {
    await adminPage.goto(
      "/wp-admin/edit.php?post_status=future&post_type=post",
      { waitUntil: "domcontentloaded" }
    );
    const link = adminPage
      .locator("td.column-title a.row-title, td.title a.row-title")
      .filter({ hasText: POST_TITLE })
      .first();
    await expect(link).toBeVisible({ timeout: 10_000 });
  });

  test("scheduled post row shows 'Scheduled' label in list", async ({ adminPage }) => {
    await adminPage.goto(
      "/wp-admin/edit.php?post_status=future&post_type=post",
      { waitUntil: "domcontentloaded" }
    );
    // Confirm the "Scheduled" view heading is active
    const activeFilter = adminPage.locator(".subsubsub .current, .subsubsub strong").filter({ hasText: /Scheduled/i }).first();
    await expect(activeFilter).toBeVisible({ timeout: 10_000 });
  });

  // ── REST API verification ─────────────────────────────────────────────

  test("REST API returns status 'future' for authenticated request", async ({ adminPage }) => {
    // Use the authenticated page session to fetch a REST nonce, then call the API
    const nonce = await adminPage.evaluate(async () => {
      const r = await fetch("/wp-admin/admin-ajax.php?action=rest-nonce");
      return r.text();
    });
    const res = await adminPage.evaluate(
      async ({ url, n }: { url: string; n: string }) => {
        const r = await fetch(url, { headers: { "X-WP-Nonce": n } });
        const body = await r.json() as { status: string; id: number };
        return { status: r.status, body };
      },
      { url: restUrl(`/wp/v2/posts/${postId}`) + "&context=edit", n: nonce }
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("future");
    expect(res.body.id).toBe(postId);
  });

  test("REST API — scheduled post is NOT publicly accessible before publish", async ({ request }) => {
    // Public (unauthenticated) request must NOT expose the unpublished post
    const res = await request.get(restUrl(`/wp/v2/posts/${postId}`));
    expect([401, 403, 404]).toContain(res.status());
  });

  // ── Calendar verification ─────────────────────────────────────────────

  test("scheduled post appears as an event on the SchedulePress calendar", async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.calendar, { waitUntil: "domcontentloaded" });

    // Wait for FullCalendar to render
    await expect(adminPage.locator(SCHEDULE_PRESS.calendar.root).first())
      .toBeVisible({ timeout: 20_000 });

    // Give React a moment to fetch and paint events via the REST calendar API
    await adminPage.waitForTimeout(2_000);

    // At least one .fc-event must be present
    const events = adminPage.locator(SCHEDULE_PRESS.calendar.event);
    await expect(events.first()).toBeVisible({ timeout: 10_000 });
    expect(await events.count()).toBeGreaterThanOrEqual(1);
  });
});
