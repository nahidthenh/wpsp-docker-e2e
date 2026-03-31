/**
 * post-publish-via-cron.spec.ts
 *
 * Tests:
 *  1. Create a post scheduled for ~1 minute in the future
 *  2. Wait for the scheduled time to pass
 *  3. Trigger WP-Cron manually via WP-CLI
 *  4. Verify the post status changed from "future" → "publish"
 *  5. Verify the post is publicly accessible after publishing
 *
 * NOTE: This test intentionally uses a very short schedule window (1 min).
 *       It has a longer timeout (120s) to account for waiting.
 */

import { test, expect } from "../fixtures/base-fixture";
import {
  gotoNewPost,
  setPostTitle,
  setPostContent,
  schedulePostForDate,
  publishOrSchedulePost,
  waitUntil,
  runWpCron,
} from "../utils/wp-helpers";
import { makeScheduledPost } from "../utils/test-data";

const BASE_URL = process.env.WP_BASE_URL ?? "http://localhost:8080";

// This test needs extra time because it waits for the schedule window
test.setTimeout(120_000);

test.describe("Post Auto-Publish via WP-Cron", () => {
  test(
    "post should auto-publish after its scheduled time when cron runs",
    async ({ adminPage, trackPost, cronRun }) => {
      // Schedule 1 minute from now
      const postData = makeScheduledPost(1);
      trackPost(postData.title);

      // ── Step 1: Create the scheduled post ─────────────────────────────────
      await gotoNewPost(adminPage);
      await setPostTitle(adminPage, postData.title);
      await setPostContent(adminPage, postData.content);
      await schedulePostForDate(adminPage, postData.scheduleDate);
      await publishOrSchedulePost(adminPage);

      console.log(
        `[cron-test] Post "${postData.title}" scheduled for ${postData.scheduleDate.toISOString()}`
      );

      // ── Step 2: Confirm it's in "future" (scheduled) status ───────────────
      const futureCheck = await adminPage.request.get(
        `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(postData.title)}&status=future`
      );
      if (futureCheck.status() === 200) {
        const futurePosts = await futureCheck.json() as Array<{ status: string }>;
        expect(futurePosts.length).toBeGreaterThan(0);
        expect(futurePosts[0].status).toBe("future");
      }

      // ── Step 3: Wait until the scheduled time has passed ──────────────────
      const scheduledMs = postData.scheduleDate.getTime();
      const now         = Date.now();
      if (scheduledMs > now) {
        const waitMs = scheduledMs - now + 5_000; // extra 5s buffer
        console.log(`[cron-test] Waiting ${Math.ceil(waitMs / 1000)}s for scheduled time...`);
        await adminPage.waitForTimeout(waitMs);
      }

      // ── Step 4: Trigger WP-Cron ───────────────────────────────────────────
      console.log("[cron-test] Triggering WP-Cron...");
      cronRun();

      // ── Step 5: Poll until the post becomes "publish" ─────────────────────
      console.log("[cron-test] Polling for published status...");
      await waitUntil(
        async () => {
          const res = await adminPage.request.get(
            `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(postData.title)}&status=publish`,
            { headers: { "Content-Type": "application/json" } }
          );
          if (res.status() !== 200) return false;
          const posts = await res.json() as Array<{ status: string }>;
          return posts.length > 0 && posts[0].status === "publish";
        },
        45_000,   // up to 45s
        3_000,    // poll every 3s
        `post "${postData.title}" to reach 'publish' status`
      );

      // ── Step 6: Confirm publicly accessible ───────────────────────────────
      const publishedPost = await adminPage.request.get(
        `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(postData.title)}&status=publish`
      );
      const published = await publishedPost.json() as Array<{ link: string; status: string }>;
      expect(published.length).toBeGreaterThan(0);

      const postLink = published[0].link;
      const publicPage = await adminPage.context().newPage();
      const publicResponse = await publicPage.goto(postLink);

      expect(publicResponse?.status()).toBe(200);
      await expect(publicPage.locator("body")).toContainText(postData.title);

      await publicPage.close();
    }
  );

  test("WP-CLI cron event run should complete without errors", ({ cronRun }) => {
    // Simple smoke test — just ensure the WP-CLI cron command itself works
    expect(() => cronRun()).not.toThrow();
  });
});
