/**
 * test-data.ts
 *
 * Centralised test data factories.
 * Using factories (not static constants) ensures every test
 * generates unique data, preventing cross-test interference.
 */

export interface ScheduledPostData {
  title:       string;
  content:     string;
  scheduleDate: Date;           // absolute Date in UTC
  tags?:       string[];
  category?:   string;
}

/**
 * Returns a post scheduled `minutesFromNow` minutes in the future (UTC).
 * Default: 2 minutes — short enough for cron tests, far enough to stay "future".
 */
export function makeScheduledPost(
  minutesFromNow = 2,
  suffix = Date.now()
): ScheduledPostData {
  const scheduleDate = new Date();
  scheduleDate.setMinutes(scheduleDate.getMinutes() + minutesFromNow);

  return {
    title:        `E2E Scheduled Post ${suffix}`,
    content:      `This is an automated E2E test post created at ${new Date().toISOString()}.`,
    scheduleDate,
    tags:         ["e2e", "automated"],
  };
}

/** Returns a post dated far in the future (won't auto-publish during test run). */
export function makeFuturePost(suffix = Date.now()): ScheduledPostData {
  const scheduleDate = new Date();
  scheduleDate.setDate(scheduleDate.getDate() + 30); // 30 days out

  return {
    title:        `E2E Future Post ${suffix}`,
    content:      `Long-lived scheduled post for calendar/status verification — ${suffix}.`,
    scheduleDate,
  };
}

// ── Credentials ───────────────────────────────────────────────────────────
export const ADMIN_CREDENTIALS = {
  username: process.env.WP_ADMIN_USER ?? "admin",
  password: process.env.WP_ADMIN_PASS ?? "admin",
} as const;

export const AUTHOR_CREDENTIALS = {
  username: "testauthor",
  password: "testauthor123",
} as const;

// ── WordPress plugin slugs ─────────────────────────────────────────────────
export const PLUGIN_SLUGS = {
  free: "wp-scheduled-posts/wp-scheduled-posts.php",
  pro:  "wp-scheduled-posts-pro/wp-scheduled-posts-pro.php",
} as const;
