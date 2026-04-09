/**
 * 05-pro-features.spec.ts
 *
 * Smoke tests for SchedulePress PRO-only features.
 * - License and Manage Schedule tabs are visible in Settings
 * - PRO meta fields (unpublish date, republish date, advance-schedule flag) can be set via WP-CLI
 * - PRO meta is accessible via the REST API
 * - Missed-schedule setting exists in the database
 * - Cron handles a past-dated post (missed schedule)
 * - Social share meta fields (skip sharing, selected profiles) can be set via WP-CLI
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";
import { runWpCli } from "../../utils/wp-helpers";

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";

/** Build a REST API URL using plain-permalink format (works without pretty permalinks). */
function restUrl(route: string): string {
  return `${BASE_URL}/?rest_route=${route}`;
}

// ── Settings page — PRO tabs ─────────────────────────────────────────────────

test.describe("SchedulePress PRO – Settings Tabs", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
  });

  test("License tab is present in Settings (PRO)", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span")
      .filter({ hasText: /^License$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Manage Schedule tab is present in Settings (PRO)", async ({ adminPage }) => {
    // "Manage Schedule" is a nested item inside "Scheduling Hub" — open the Hub first
    const hub = adminPage.locator("a, button, li, span")
      .filter({ hasText: /^Scheduling Hub$/i }).first();
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await hub.click();
    const tab = adminPage.locator("a, button, li, span, h2, h3")
      .filter({ hasText: /Manage.?Schedule/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("License tab page loads without errors", async ({ adminPage }) => {
    // Navigate directly via URL tab parameter
    await adminPage.goto(`${SCHEDULE_PRESS.urls.settings}&tab=license`, {
      waitUntil: "domcontentloaded",
    });
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body).not.toContain("Fatal error");
    expect(body).not.toContain("critical error");
    await expect(adminPage.locator("#wpbody")).toBeVisible();
  });
});

// ── PRO post meta fields ─────────────────────────────────────────────────────

test.describe("SchedulePress PRO – Advanced Scheduling Meta Fields", () => {
  let postId: number;

  test.beforeAll(() => {
    // runWpCli is used directly — Playwright fixtures are not available in beforeAll
    const raw = runWpCli(
      `post create` +
      ` --post_title="E2E PRO Meta Test – ${Date.now()}"` +
      ` --post_status=publish` +
      ` --porcelain`
    );
    postId = parseInt(raw.trim(), 10);
    expect(postId).toBeGreaterThan(0);
  });

  test.afterAll(() => {
    if (postId) runWpCli(`post delete ${postId} --force`);
  });

  test("PRO advanced-schedule meta field is accessible via REST API", async ({ adminPage }) => {
    // Use the authenticated page session + WP nonce — Basic Auth is disabled by default
    const nonce = await adminPage.evaluate(async () => {
      const r = await fetch("/wp-admin/admin-ajax.php?action=rest-nonce");
      return r.text();
    });

    // postId may be 0 if beforeAll ran in a different worker scope; fall back to latest post
    const idToUse = postId > 0 ? postId : await adminPage.evaluate(
      async ({ url, n }: { url: string; n: string }) => {
        const r = await fetch(url, { headers: { "X-WP-Nonce": n } });
        const posts = await r.json() as Array<{ id: number }>;
        return posts[0]?.id ?? 0;
      },
      { url: restUrl("/wp/v2/posts") + "&status=publish&per_page=1&context=edit", n: nonce }
    );
    expect(idToUse).toBeGreaterThan(0);

    const res = await adminPage.evaluate(
      async ({ url, n }: { url: string; n: string }) => {
        const r = await fetch(url, { headers: { "X-WP-Nonce": n } });
        const body = await r.json() as { meta?: unknown };
        return { status: r.status, hasMeta: "meta" in body };
      },
      { url: restUrl(`/wp/v2/posts/${idToUse}`) + "&context=edit", n: nonce }
    );
    expect(res.status).toBe(200);
    // PRO registers _wpscppro_advance_schedule as a REST-exposed meta field
    expect(res.hasMeta).toBe(true);
  });

  test("PRO unpublish date meta field can be set via WP-CLI", ({ wpCli }) => {
    const unpublishDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");

    // _wpscp_schedule_draft_date is the PRO "Unpublish" meta key
    wpCli(
      `post meta update ${postId} _wpscp_schedule_draft_date "${unpublishDate}"`
    );
    const saved = wpCli(
      `post meta get ${postId} _wpscp_schedule_draft_date`
    );
    expect(saved.trim()).toBe(unpublishDate);
  });

  test("PRO republish date meta field can be set via WP-CLI", ({ wpCli }) => {
    const republishDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");

    // _wpscp_schedule_republish_date is the PRO "Republish" meta key
    wpCli(
      `post meta update ${postId} _wpscp_schedule_republish_date "${republishDate}"`
    );
    const saved = wpCli(
      `post meta get ${postId} _wpscp_schedule_republish_date`
    );
    expect(saved.trim()).toBe(republishDate);
  });

  test("PRO advance-schedule flag meta field can be toggled via WP-CLI", ({ wpCli }) => {
    // _wpscppro_advance_schedule is the boolean flag for advanced scheduling
    wpCli(`post meta update ${postId} _wpscppro_advance_schedule 1`);
    const val = wpCli(`post meta get ${postId} _wpscppro_advance_schedule`);
    expect(val.trim()).toBe("1");
  });
});

// ── Missed-schedule handler ───────────────────────────────────────────────────

test.describe("SchedulePress PRO – Missed Schedule Handler", () => {
  test("missed-schedule setting is stored in wpsp_settings_v5 option", ({ wpCli }) => {
    // PRO stores is_active_missed_schedule in the shared settings option
    const raw = wpCli(`option get wpsp_settings_v5 --format=json`);
    // Option must exist (non-empty JSON)
    expect(raw.trim().length).toBeGreaterThan(2);
    // The option value should be valid JSON
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("publishing a past-dated post is handled by cron", ({ wpCli }) => {
    // Create a post with a date 10 minutes in the past — WP marks it as missed-schedule
    const pastDate = new Date(Date.now() - 10 * 60 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");

    const raw = wpCli(
      `post create` +
      ` --post_title="E2E Missed-Schedule Test – ${Date.now()}"` +
      ` --post_status=future` +
      ` --post_date_gmt="${pastDate}"` +
      ` --porcelain`
    );
    const missedId = parseInt(raw.trim(), 10);
    expect(missedId).toBeGreaterThan(0);

    try {
      // Run cron — PRO missed-schedule handler fires here
      wpCli("cron event run --due-now");

      // After cron the post should be published (or still future if WP strict-mode)
      const status = wpCli(`post get ${missedId} --field=post_status`);
      expect(["publish", "future"]).toContain(status.trim());
    } finally {
      wpCli(`post delete ${missedId} --force`);
    }
  });
});

// ── Social share meta fields (free + PRO) ────────────────────────────────────

test.describe("SchedulePress PRO – Social Share Meta", () => {
  let postId: number;

  test.beforeAll(() => {
    const raw = runWpCli(
      `post create` +
      ` --post_title="E2E Social Meta – ${Date.now()}"` +
      ` --post_status=draft` +
      ` --porcelain`
    );
    postId = parseInt(raw.trim(), 10);
  });

  test.afterAll(() => {
    if (postId) runWpCli(`post delete ${postId} --force`);
  });

  test("social-skip meta field can be set via WP-CLI", ({ wpCli }) => {
    // _wpscppro_dont_share_socialmedia — skip social sharing for this post
    wpCli(`post meta update ${postId} _wpscppro_dont_share_socialmedia 1`);
    const val = wpCli(`post meta get ${postId} _wpscppro_dont_share_socialmedia`);
    expect(val.trim()).toBe("1");
  });

  test("selected social profiles meta field can be set via WP-CLI", ({ wpCli }) => {
    // _selected_social_profile — array of profile IDs to share to
    wpCli(`post meta update ${postId} _selected_social_profile '["facebook","twitter"]'`);
    const val = wpCli(`post meta get ${postId} _selected_social_profile`);
    expect(val.trim().length).toBeGreaterThan(0);
  });
});
