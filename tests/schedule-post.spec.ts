/**
 * schedule-post.spec.ts
 *
 * Tests:
 *  1. Create a new post and schedule it for a future date
 *  2. Confirm the editor shows the "Scheduled" success indicator
 *  3. Confirm the post appears in the "Scheduled" (future) tab of Posts list
 *  4. Confirm the post status is "Scheduled" in the posts list
 *  5. Edit a scheduled post and update its scheduled date
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

test.describe("Schedule a Post", () => {
  // Each test generates a unique post to avoid collisions
  let postData = makeFuturePost();

  test.beforeEach(() => {
    postData = makeFuturePost();
  });

  test("should schedule a post using the block editor", async ({
    adminPage,
    trackPost,
  }) => {
    trackPost(postData.title);

    await gotoNewPost(adminPage);

    // Fill title and content
    await setPostTitle(adminPage, postData.title);
    await setPostContent(adminPage, postData.content);

    // Open the sidebar schedule panel and set the date
    await schedulePostForDate(adminPage, postData.scheduleDate);

    // Click Publish → Schedule
    await publishOrSchedulePost(adminPage);

    // The editor should show a success/scheduled notice
    const successIndicator = adminPage.locator(
      ".components-snackbar__content, " +
      ".editor-post-publish-panel__header-published, " +
      "text=Scheduled"
    ).first();
    await expect(successIndicator).toBeVisible({ timeout: 20_000 });
  });

  test("scheduled post should appear in Posts → Scheduled list", async ({
    adminPage,
    trackPost,
  }) => {
    trackPost(postData.title);

    // Create the post
    await gotoNewPost(adminPage);
    await setPostTitle(adminPage, postData.title);
    await setPostContent(adminPage, postData.content);
    await schedulePostForDate(adminPage, postData.scheduleDate);
    await publishOrSchedulePost(adminPage);

    // Navigate to posts list, filtered to future/scheduled
    await gotoPostsList(adminPage, "future");

    const postTitle = adminPage
      .locator(`tr a.row-title:has-text("${postData.title}")`)
      .first();
    await expect(postTitle).toBeVisible({ timeout: 15_000 });
  });

  test("scheduled post status should read 'Scheduled' in posts list", async ({
    adminPage,
    trackPost,
  }) => {
    trackPost(postData.title);

    await gotoNewPost(adminPage);
    await setPostTitle(adminPage, postData.title);
    await setPostContent(adminPage, postData.content);
    await schedulePostForDate(adminPage, postData.scheduleDate);
    await publishOrSchedulePost(adminPage);

    await gotoPostsList(adminPage, "future");

    // Find the row containing our post
    const postRow = adminPage
      .locator(`tr:has(a.row-title:has-text("${postData.title}"))`)
      .first();
    await expect(postRow).toBeVisible({ timeout: 15_000 });

    // The "Date" column should say "Scheduled"
    await expect(
      postRow.locator("td.date, .column-date")
    ).toContainText(/scheduled/i, { timeout: 10_000 });
  });

  test("should be able to edit the scheduled date of a scheduled post", async ({
    adminPage,
    trackPost,
  }) => {
    trackPost(postData.title);

    // Create initial scheduled post
    await gotoNewPost(adminPage);
    await setPostTitle(adminPage, postData.title);
    await setPostContent(adminPage, postData.content);
    await schedulePostForDate(adminPage, postData.scheduleDate);
    await publishOrSchedulePost(adminPage);

    // Navigate to the scheduled posts list and click Edit
    await gotoPostsList(adminPage, "future");
    const postTitleLink = adminPage
      .locator(`tr a.row-title:has-text("${postData.title}")`)
      .first();
    await postTitleLink.click();

    // Wait for editor to load
    await expect(
      adminPage.locator(".wp-block-post-title, [aria-label='Add title']").first()
    ).toBeVisible({ timeout: 15_000 });

    // Update the scheduled date to a new future date
    const newDate = new Date(postData.scheduleDate);
    newDate.setDate(newDate.getDate() + 7); // push one week further
    await schedulePostForDate(adminPage, newDate);

    // Save the update
    const updateBtn = adminPage
      .locator('button:has-text("Update"), button:has-text("Schedule")')
      .first();
    await updateBtn.click();

    // Confirm update was saved
    const saveNotice = adminPage.locator(
      ".components-snackbar__content, .notice-success"
    ).first();
    await expect(saveNotice).toBeVisible({ timeout: 20_000 });
  });
});
