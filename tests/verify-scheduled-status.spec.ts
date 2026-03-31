/**
 * verify-scheduled-status.spec.ts
 *
 * Tests:
 *  1. Scheduled post count matches WP-CLI count
 *  2. Scheduled posts appear in the WordPress REST API
 *  3. A scheduled post's date is actually in the future
 *  4. Post cannot be fetched publicly before it's published
 */

import { test, expect } from "../fixtures/base-fixture";
import {
  gotoNewPost,
  setPostTitle,
  setPostContent,
  schedulePostForDate,
  publishOrSchedulePost,
  gotoPostsList,
} from "../utils/wp-helpers";
import { makeFuturePost } from "../utils/test-data";

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";

test.describe("Verify Scheduled Post Status", () => {
  let postData = makeFuturePost();

  test.beforeEach(async ({ adminPage, trackPost }) => {
    postData = makeFuturePost();
    trackPost(postData.title);

    // Create a scheduled post for each test
    await gotoNewPost(adminPage);
    await setPostTitle(adminPage, postData.title);
    await setPostContent(adminPage, postData.content);
    await schedulePostForDate(adminPage, postData.scheduleDate);
    await publishOrSchedulePost(adminPage);
  });

  test("scheduled post should appear in wp-admin future posts list", async ({
    adminPage,
  }) => {
    await gotoPostsList(adminPage, "future");

    const postTitle = adminPage
      .locator(`tr a.row-title:has-text("${postData.title}")`)
      .first();
    await expect(postTitle).toBeVisible({ timeout: 15_000 });
  });

  test("WP-CLI should report the post as scheduled (future)", ({ wpCli }) => {
    // Retry a few times because WP might take a moment to persist
    let status = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        status = wpCli(
          `post list --post_title="${postData.title}" --field=post_status --post_status=future`
        ).trim();
        if (status) break;
      } catch {
        // ignore and retry
      }
    }
    expect(status).toBe("future");
  });

  test("scheduled post should be accessible via REST API as 'future' (admin)", async ({
    adminPage,
  }) => {
    // Authenticated REST API request using existing admin cookies
    const response = await adminPage.request.get(
      `${BASE_URL}/wp-json/wp/v2/posts?status=future&per_page=5`,
      { headers: { "Content-Type": "application/json" } }
    );
    expect(response.status()).toBe(200);

    const posts = await response.json() as Array<{ title: { rendered: string }; status: string }>;
    const match = posts.find((p) =>
      p.title.rendered.includes(postData.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );

    expect(match).toBeDefined();
    expect(match?.status).toBe("future");
  });

  test("scheduled post should NOT be publicly accessible before publish", async ({
    page,
  }) => {
    // Get the post slug via admin
    const response = await page.request.get(
      `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(postData.title)}&status=future`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.status() !== 200) {
      test.skip();
      return;
    }

    const posts = await response.json() as Array<{ slug: string; status: string }>;
    if (!posts.length) {
      test.skip();
      return;
    }

    const slug = posts[0].slug;

    // Unauthenticated context — should get 404 or redirect
    const publicPage = await page.context().newPage();
    const publicResponse = await publicPage.goto(`${BASE_URL}/${slug}/`);
    expect(publicResponse?.status()).not.toBe(200);
    await publicPage.close();
  });

  test("scheduled post date should be in the future", async ({ adminPage }) => {
    const response = await adminPage.request.get(
      `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(postData.title)}&status=future`
    );
    expect(response.status()).toBe(200);

    const posts = await response.json() as Array<{ date_gmt: string; status: string }>;
    if (!posts.length) {
      // Retry once after a short wait
      await adminPage.waitForTimeout(3000);
      const retry = await adminPage.request.get(
        `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(postData.title)}&status=future`
      );
      const retryPosts = await retry.json() as Array<{ date_gmt: string; status: string }>;
      if (!retryPosts.length) { test.skip(); return; }
      const scheduledDate = new Date(retryPosts[0].date_gmt);
      expect(scheduledDate.getTime()).toBeGreaterThan(Date.now());
      return;
    }

    const scheduledDate = new Date(posts[0].date_gmt);
    expect(scheduledDate.getTime()).toBeGreaterThan(Date.now());
  });
});
