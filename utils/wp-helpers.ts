/**
 * wp-helpers.ts
 *
 * Reusable helper functions for WordPress + SchedulePress test actions.
 * All helpers accept a Playwright `Page` instance so they compose cleanly.
 */

import { Page, expect } from "@playwright/test";
import { execSync }      from "child_process";
import { BLOCK_EDITOR, POSTS_LIST, SCHEDULE_PRESS } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// Navigation helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Navigate to the WordPress admin dashboard. */
export async function gotoAdminDashboard(page: Page): Promise<void> {
  await page.goto("/wp-admin/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#wpadminbar")).toBeVisible();
}

/** Navigate to the new post editor. */
export async function gotoNewPost(page: Page): Promise<void> {
  await page.goto("/wp-admin/post-new.php", { waitUntil: "domcontentloaded" });
  // Dismiss any "Welcome to the block editor" dialog
  const welcomeDialog = page.locator('[aria-label="Close dialog"]');
  if (await welcomeDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await welcomeDialog.click();
  }
  await expect(
    page.locator(BLOCK_EDITOR.titleInput).first()
  ).toBeVisible({ timeout: 15_000 });
}

/** Navigate to the posts list filtered by a given status. */
export async function gotoPostsList(
  page: Page,
  status: "all" | "publish" | "future" | "draft" = "all"
): Promise<void> {
  const url = status === "all"
    ? "/wp-admin/edit.php"
    : `/wp-admin/edit.php?post_status=${status}&post_type=post`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Block editor helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Type a title into the block editor title field. */
export async function setPostTitle(page: Page, title: string): Promise<void> {
  const titleLocator = page.locator(BLOCK_EDITOR.titleInput).first();
  await titleLocator.click();
  await titleLocator.fill(title);
}

/** Type body content into the block editor. */
export async function setPostContent(page: Page, content: string): Promise<void> {
  // Click below the title to create a paragraph block
  await page.locator(".block-editor-writing-flow").click();
  const paragraph = page.getByRole("document", { name: "Empty block" }).first();
  if (await paragraph.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await paragraph.click();
    await paragraph.pressSequentially(content);
  } else {
    // Fallback: type after pressing Enter from the title
    await page.keyboard.press("Enter");
    await page.keyboard.type(content);
  }
}

/**
 * Schedule a post for the given Date using the block editor date picker.
 * Opens the sidebar schedule panel and fills year/month/day/hour/minute.
 */
export async function schedulePostForDate(page: Page, date: Date): Promise<void> {
  // Open the sidebar (if not already open)
  const settingsBtn = page.getByRole("button", { name: "Settings" }).first();
  if (!(await page.locator(".interface-interface-skeleton__sidebar").isVisible())) {
    await settingsBtn.click();
  }

  // Click on the "Post" tab in the sidebar
  const postTab = page.getByRole("button", { name: "Post" });
  if (await postTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await postTab.click();
  }

  // Open the date/time picker
  const datePickerTrigger = page
    .locator('button[aria-label="Change date and time"], .editor-post-schedule__dialog-toggle')
    .first();
  await datePickerTrigger.click();

  const pad = (n: number) => String(n).padStart(2, "0");
  const year   = date.getUTCFullYear();
  const month  = date.getUTCMonth() + 1;
  const day    = date.getUTCDate();
  const hour   = date.getUTCHours();
  const minute = date.getUTCMinutes();

  const { datePicker } = BLOCK_EDITOR;

  async function fillDateField(selector: string, value: string): Promise<void> {
    const field = page.locator(selector).first();
    await field.click({ clickCount: 3 });
    await field.fill(value);
    await page.keyboard.press("Tab");
  }

  await fillDateField(datePicker.month,  pad(month));
  await fillDateField(datePicker.day,    pad(day));
  await fillDateField(datePicker.year,   String(year));
  await fillDateField(datePicker.hour,   pad(hour));
  await fillDateField(datePicker.minute, pad(minute));
}

/**
 * Click the Publish / Schedule button and confirm the pre-publish dialog.
 * Returns when the post has been successfully scheduled (status = "Scheduled").
 */
export async function publishOrSchedulePost(page: Page): Promise<void> {
  // First click opens the pre-publish panel
  const publishBtn = page.locator(BLOCK_EDITOR.publishButton).first();
  await publishBtn.click();

  // The pre-publish panel may appear; click the second "Schedule" / "Publish" button
  const confirmBtn = page
    .locator('button.editor-post-publish-button__button:not([aria-disabled="true"])')
    .last();
  if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await confirmBtn.click();
  }

  // Wait for the success notice
  await expect(
    page.locator(".components-snackbar, .notice-success, .editor-post-publish-panel__header-published")
  ).toBeVisible({ timeout: 20_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Post verification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a post with the given title appears in the posts list
 * filtered by `status` (e.g., "future" = Scheduled).
 */
export async function postExistsWithStatus(
  page: Page,
  title: string,
  status: "future" | "publish" | "draft"
): Promise<boolean> {
  await gotoPostsList(page, status);
  const row = page.locator(`tr a.row-title:has-text("${title}")`).first();
  return row.isVisible({ timeout: 5_000 }).catch(() => false);
}

// ─────────────────────────────────────────────────────────────────────────────
// WP-CLI helpers  (run from the host, targeting the running container)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run WP-CLI via a disposable `docker run` container.
 * This works whether or not the `wpcli` service container is running.
 */
export function runWpCli(subcommand: string): string {
  const network  = process.env.DOCKER_NETWORK  ?? "wpsp-docker-e2e_wpsp_network";
  const dbHost   = process.env.WORDPRESS_DB_HOST     ?? "db:3306";
  const dbUser   = process.env.WORDPRESS_DB_USER     ?? "wordpress";
  const dbPass   = process.env.WORDPRESS_DB_PASSWORD ?? "wordpress";
  const dbName   = process.env.WORDPRESS_DB_NAME     ?? "wordpress";

  const cmd = [
    "docker run --rm",
    `--network ${network}`,
    "--volumes-from wpsp_wordpress",
    `-e WORDPRESS_DB_HOST=${dbHost}`,
    `-e WORDPRESS_DB_USER=${dbUser}`,
    `-e WORDPRESS_DB_PASSWORD=${dbPass}`,
    `-e WORDPRESS_DB_NAME=${dbName}`,
    "wordpress:cli-php8.2",
    "wp",
    subcommand,
    "--path=/var/www/html",
    "--allow-root",
  ].join(" ");

  try {
    return execSync(cmd, { encoding: "utf8", cwd: process.cwd() }).trim();
  } catch (e: unknown) {
    const error = e as { stderr?: string; stdout?: string; message?: string };
    throw new Error(
      `WP-CLI command failed:\n  CMD: ${cmd}\n  STDERR: ${error.stderr ?? ""}\n  STDOUT: ${error.stdout ?? ""}`
    );
  }
}

/** Trigger all due WP-Cron events. */
export function runWpCron(): void {
  console.log("[wp-helpers] Running WP-Cron...");
  const output = runWpCli("cron event run --due-now");
  console.log("[wp-helpers] Cron output:", output || "(no events ran)");
}

/** Activate a plugin by slug via WP-CLI. */
export function activatePlugin(slug: string): void {
  runWpCli(`plugin activate ${slug}`);
}

/** Deactivate a plugin by slug via WP-CLI. */
export function deactivatePlugin(slug: string): void {
  runWpCli(`plugin deactivate ${slug}`);
}

/**
 * Check if a plugin is active.
 * Returns true if the plugin's Status is "Active".
 */
export function isPluginActive(slug: string): boolean {
  try {
    const output = runWpCli(`plugin get ${slug} --field=status`);
    return output.trim() === "active";
  } catch {
    return false;
  }
}

/**
 * Delete all posts with a title matching the given prefix.
 * Useful for cleanup between test runs.
 */
export function deletePostsByTitlePrefix(prefix: string): void {
  try {
    const ids = runWpCli(
      `post list --post_title="${prefix}%" --field=ID --format=ids --post_status=any`
    );
    if (ids.trim()) {
      runWpCli(`post delete ${ids.replace(/\n/g, " ")} --force`);
    }
  } catch {
    // Ignore cleanup errors — posts may not exist
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wait until `condition()` returns true, polling every `intervalMs`.
 * Throws after `timeoutMs` if the condition never becomes true.
 */
export async function waitUntil(
  condition: () => Promise<boolean>,
  timeoutMs  = 60_000,
  intervalMs = 3_000,
  description = "condition"
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    console.log(`[waitUntil] Waiting for "${description}"...`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`[waitUntil] Timed out waiting for: ${description}`);
}
