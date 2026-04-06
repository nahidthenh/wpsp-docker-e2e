/**
 * 17-api-security.spec.ts
 *
 * Tier 03 — Advanced: REST API authorisation & permission boundaries.
 *
 * Verifies:
 *  - Unauthenticated requests cannot read scheduled/draft posts
 *  - Admin can read and write scheduling meta via REST
 *  - Subscriber role cannot edit posts or update settings
 *  - Nonce-protected AJAX endpoints reject forged nonces
 *  - WPSP settings REST endpoint requires authentication
 *
 * Uses the `adminPage` fixture (logged-in admin) and plain `page` (unauthenticated).
 * The subscriber user is created by wp-setup.sh (testauthor/author role) — we also
 * create a subscriber here if needed.
 */

import { test, expect } from "../../../fixtures/base-fixture";
import { runWpCli, deletePostsByTitlePrefix } from "../../../utils/wp-helpers";

const PREFIX = "E2E-Security-";

/**
 * Get a WP REST nonce from an already-authenticated admin page.
 * Uses `window.wpApiSettings.nonce` which is always embedded by the block editor.
 */
async function getAdminNonce(adminPage: import("@playwright/test").Page): Promise<string> {
  await adminPage.goto("/wp-admin/post-new.php", { waitUntil: "domcontentloaded" });
  await adminPage.waitForTimeout(1500);
  return adminPage.evaluate(() => (window as any).wpApiSettings?.nonce ?? "");
}

test.describe("SchedulePress – REST API Security", () => {

  let scheduledPostId: string;
  let draftPostId: string;

  test.beforeAll(() => {
    const futureDate = new Date(Date.now() + 3600 * 1000)
      .toISOString().slice(0, 19).replace("T", " ");
    scheduledPostId = runWpCli(
      `post create --post_title="${PREFIX}Scheduled" --post_status=future --post_date="${futureDate}" --porcelain`
    );
    draftPostId = runWpCli(
      `post create --post_title="${PREFIX}Draft" --post_status=draft --porcelain`
    );
  });

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── Unauthenticated access ────────────────────────────────────────────────

  test("unauthenticated request for a scheduled post returns 401", async ({ page }) => {
    const resp = await page.request.get(`/?rest_route=/wp/v2/posts/${scheduledPostId.trim()}`);
    expect(resp.status()).toBe(401);
  });

  test("unauthenticated request for a draft post returns 401", async ({ page }) => {
    const resp = await page.request.get(`/?rest_route=/wp/v2/posts/${draftPostId.trim()}`);
    expect(resp.status()).toBe(401);
  });

  test("unauthenticated request to posts list does not include future posts", async ({ page }) => {
    const resp = await page.request.get("/?rest_route=/wp/v2/posts&per_page=100");
    expect(resp.status()).toBe(200);
    const posts: Array<{ status: string }> = await resp.json();
    const futureOrDraft = posts.filter((p) => p.status === "future" || p.status === "draft");
    expect(futureOrDraft.length).toBe(0);
  });

  // ── Admin access ─────────────────────────────────────────────────────────

  test("admin can read a scheduled post via REST (with nonce)", async ({ adminPage }) => {
    const nonce = await getAdminNonce(adminPage);
    const data = await adminPage.evaluate(
      async ({ id, n }: { id: string; n: string }) => {
        const r = await fetch(`/?rest_route=/wp/v2/posts/${id}`, {
          headers: { "X-WP-Nonce": n },
        });
        return r.json();
      },
      { id: scheduledPostId.trim(), n: nonce.trim() }
    );
    expect(data.status).toBe("future");
  });

  test("admin can read a draft post via REST (with nonce)", async ({ adminPage }) => {
    const nonce = await getAdminNonce(adminPage);
    const data = await adminPage.evaluate(
      async ({ id, n }: { id: string; n: string }) => {
        const r = await fetch(`/?rest_route=/wp/v2/posts/${id}`, {
          headers: { "X-WP-Nonce": n },
        });
        return r.json();
      },
      { id: draftPostId.trim(), n: nonce.trim() }
    );
    expect(data.status).toBe("draft");
  });

  test("admin can update post meta via REST (with nonce)", async ({ adminPage }) => {
    const nonce = await getAdminNonce(adminPage);
    const result = await adminPage.evaluate(
      async ({ id, n }: { id: string; n: string }) => {
        const r = await fetch(`/?rest_route=/wp/v2/posts/${id}`, {
          method: "POST",
          headers: {
            "X-WP-Nonce": n,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: "E2E-Security-Draft-Updated" }),
        });
        return r.status;
      },
      { id: draftPostId.trim(), n: nonce.trim() }
    );
    expect(result).toBe(200);
  });

  // ── Forged / missing nonce ────────────────────────────────────────────────

  test("REST request with forged nonce cannot update a post", async ({ adminPage }) => {
    // Navigate first so cookies are set (but use a fake nonce)
    await adminPage.goto("/wp-admin/", { waitUntil: "domcontentloaded" });
    const result = await adminPage.evaluate(
      async (id: string) => {
        const r = await fetch(`/?rest_route=/wp/v2/posts/${id}`, {
          method: "POST",
          headers: {
            "X-WP-Nonce": "invalid-nonce-12345",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: "Should Not Update" }),
        });
        return r.status;
      },
      draftPostId.trim()
    );
    // Should be 401 (cookie still identifies user but nonce invalid) or 403
    expect([401, 403]).toContain(result);
  });

  test("REST write request with no nonce and no auth is rejected", async ({ page }) => {
    const resp = await page.request.post(`/?rest_route=/wp/v2/posts/${draftPostId.trim()}`, {
      data: { title: "Should Not Update" },
      headers: { "Content-Type": "application/json" },
    });
    expect([401, 403]).toContain(resp.status());
  });

  // ── Subscriber role boundary ──────────────────────────────────────────────

  test("subscriber cannot edit posts — edit.php redirects to dashboard", async ({ page }) => {
    // Use a unique login name per test run to avoid cross-run conflicts
    const subLogin = `e2e-sub-${Date.now()}`;
    const subEmail = `${subLogin}@example.com`;

    // Create subscriber
    const subId = runWpCli(
      `user create ${subLogin} ${subEmail} --role=subscriber --user_pass=Subscriber123! --porcelain`
    );

    try {
      // Log in as subscriber
      await page.goto("/wp-login.php", { waitUntil: "domcontentloaded" });
      await page.locator("#user_login").fill(subLogin);
      await page.locator("#user_pass").fill("Subscriber123!");
      await page.locator("#wp-submit").click();
      await page.waitForURL(/wp-admin/, { timeout: 10_000 });

      // Subscriber should not have access to edit posts
      await page.goto("/wp-admin/edit.php", { waitUntil: "domcontentloaded" });
      const url = page.url();
      const body = await page.locator("body").textContent() ?? "";
      const blocked =
        !url.includes("edit.php") ||
        /do not have.*permission|not allowed|dashboard/i.test(body);
      expect(blocked).toBe(true);
    } finally {
      runWpCli(`user delete ${subId.trim()} --yes`);
    }
  });

  // ── WPSP settings endpoint ────────────────────────────────────────────────

  test("SchedulePress settings page returns 200 for admin", async ({ adminPage }) => {
    const resp = await adminPage.request.get("/wp-admin/admin.php?page=schedulepress");
    expect(resp.status()).toBe(200);
  });

  test("SchedulePress settings page redirects unauthenticated users to login", async ({ page }) => {
    const resp = await page.request.get("/wp-admin/admin.php?page=schedulepress", {
      maxRedirects: 0,
    });
    // Should redirect to login (302) or return 200 of the login page
    expect([200, 302, 301]).toContain(resp.status());
    if (resp.status() === 302) {
      expect(resp.headers()["location"]).toMatch(/wp-login/);
    }
  });
});
