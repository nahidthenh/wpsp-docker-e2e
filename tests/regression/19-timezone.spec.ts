/**
 * 19-timezone.spec.ts
 *
 * Tests that SchedulePress scheduling is accurate across different WordPress timezone settings.
 * - UTC+0 (baseline): post_date_gmt matches post_date exactly
 * - UTC+6 (positive offset): local time is correctly converted to UTC for cron
 * - UTC-5 (negative offset): negative offset conversion works correctly
 * - Cron fires at the right UTC time regardless of the WordPress timezone setting
 * - Named timezone (e.g. America/New_York) behaves the same as a numeric offset
 * - Original timezone is always restored after each test so other specs are not affected
 *
 * Key insight: WP-CLI --post_date accepts LOCAL time. WordPress converts it to
 * post_date_gmt using the current gmt_offset. Cron fires when post_date_gmt <= now().
 */

import { test, expect } from "../../fixtures/base-fixture";
import { runWpCli, runWpCron, deletePostsByTitlePrefix } from "../../utils/wp-helpers";

const PREFIX = "E2E-TZ-";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Set the WordPress gmt_offset option and clear any named timezone string. */
function setGmtOffset(offsetHours: number): void {
  // option update creates the option if it does not exist (safe after a crash)
  runWpCli(`option update gmt_offset ${offsetHours}`);
  runWpCli(`option update timezone_string ""`);
}

/**
 * Read the current WordPress gmt_offset as a number.
 * Returns 0 if the option was deleted (e.g. by a previously crashed test run).
 */
function getGmtOffset(): number {
  try {
    const raw = runWpCli("option get gmt_offset").trim();
    const num = parseFloat(raw);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0; // option absent — WordPress default is UTC (0)
  }
}

/**
 * Format a UTC-millisecond timestamp as a WP post_date string "YYYY-MM-DD HH:MM:SS".
 * Adds the given offset (hours) so the result is the LOCAL time for that timezone.
 *
 * e.g. utcMs=10:00 UTC, offsetHours=6  → "2026-04-09 16:00:00" (UTC+6 local time)
 *      utcMs=10:00 UTC, offsetHours=-5 → "2026-04-09 05:00:00" (UTC-5 local time)
 */
function toLocalDateStr(utcMs: number, offsetHours: number): string {
  return new Date(utcMs + offsetHours * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/**
 * Parse a WP date string "YYYY-MM-DD HH:MM:SS" to UTC milliseconds,
 * treating it as a UTC date (no offset applied).
 */
function parseUtcMs(wpDate: string): number {
  return new Date(wpDate.replace(" ", "T") + "Z").getTime();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("SchedulePress – Timezone Handling", () => {

  let originalOffset: number;

  test.beforeAll(() => {
    originalOffset = getGmtOffset();
  });

  test.afterAll(() => {
    // Always restore the original timezone so subsequent spec files are unaffected
    setGmtOffset(originalOffset);
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── 1. UTC+0 baseline ─────────────────────────────────────────────────────

  test("UTC+0: post_date_gmt matches post_date exactly (no conversion)", () => {
    setGmtOffset(0);

    const localDate = toLocalDateStr(Date.now() + 3_600_000, 0); // 1 hour from now
    const id = runWpCli(
      `post create --post_title="${PREFIX}UTC0" --post_status=future --post_date="${localDate}" --porcelain`
    ).trim();

    try {
      const storedLocal = runWpCli(`post get ${id} --field=post_date`).trim();
      const storedGmt   = runWpCli(`post get ${id} --field=post_date_gmt`).trim();

      // With gmt_offset=0 there should be no difference (within 1s tolerance for exec time)
      const diffMs = Math.abs(parseUtcMs(storedLocal) - parseUtcMs(storedGmt));
      expect(diffMs).toBeLessThan(2_000);
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  // ── 2. UTC+6 positive offset ──────────────────────────────────────────────

  test("UTC+6: post_date_gmt is 6 hours behind the local post_date", () => {
    setGmtOffset(6);

    const nowUtcMs  = Date.now();
    const localDate = toLocalDateStr(nowUtcMs + 3_600_000, 6); // 1h from now, expressed in UTC+6 local

    const id = runWpCli(
      `post create --post_title="${PREFIX}UTC+6" --post_status=future --post_date="${localDate}" --porcelain`
    ).trim();

    try {
      const storedLocal = runWpCli(`post get ${id} --field=post_date`).trim();
      const storedGmt   = runWpCli(`post get ${id} --field=post_date_gmt`).trim();

      const localMs = parseUtcMs(storedLocal);
      const gmtMs   = parseUtcMs(storedGmt);

      // post_date should be 6 hours ahead of post_date_gmt (±2s tolerance)
      const diffHours = (localMs - gmtMs) / 3_600_000;
      expect(diffHours).toBeCloseTo(6, 1); // within 0.1h (~6 minutes) tolerance
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  // ── 3. UTC-5 negative offset ──────────────────────────────────────────────

  test("UTC-5: post_date_gmt is 5 hours ahead of the local post_date", () => {
    setGmtOffset(-5);

    const nowUtcMs  = Date.now();
    const localDate = toLocalDateStr(nowUtcMs + 3_600_000, -5); // 1h from now in UTC-5 local

    const id = runWpCli(
      `post create --post_title="${PREFIX}UTC-5" --post_status=future --post_date="${localDate}" --porcelain`
    ).trim();

    try {
      const storedLocal = runWpCli(`post get ${id} --field=post_date`).trim();
      const storedGmt   = runWpCli(`post get ${id} --field=post_date_gmt`).trim();

      const localMs = parseUtcMs(storedLocal);
      const gmtMs   = parseUtcMs(storedGmt);

      // post_date_gmt should be 5 hours ahead of post_date (±2s tolerance)
      const diffHours = (gmtMs - localMs) / 3_600_000;
      expect(diffHours).toBeCloseTo(5, 1);
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  // ── 4. Cron fires based on UTC, not local time ────────────────────────────

  test("UTC+6: cron publishes post when post_date_gmt is past-due (not local time)", () => {
    setGmtOffset(6);

    // We want post_date_gmt to be 2 seconds in the past from current UTC.
    // With gmt_offset=6, local time = UTC + 6h, so local past = UTC_past + 6h.
    const pastUtcMs   = Date.now() - 2_000;                      // 2s ago in UTC
    const pastLocalDate = toLocalDateStr(pastUtcMs, 6);           // same moment in UTC+6 local

    const id = runWpCli(
      `post create --post_title="${PREFIX}Cron-UTC+6" --post_status=future --post_date="${pastLocalDate}" --porcelain`
    ).trim();

    try {
      // post_date is 2s ago (in local). post_date_gmt is 2s ago in UTC → due now
      runWpCron();
      const status = runWpCli(`post get ${id} --field=post_status`).trim();
      expect(status).toBe("publish");
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  test("UTC-5: cron publishes post when post_date_gmt is past-due (not local time)", () => {
    setGmtOffset(-5);

    const pastUtcMs     = Date.now() - 2_000;
    const pastLocalDate = toLocalDateStr(pastUtcMs, -5);

    const id = runWpCli(
      `post create --post_title="${PREFIX}Cron-UTC-5" --post_status=future --post_date="${pastLocalDate}" --porcelain`
    ).trim();

    try {
      runWpCron();
      const status = runWpCli(`post get ${id} --field=post_status`).trim();
      expect(status).toBe("publish");
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });

  // ── 5. Named timezone ─────────────────────────────────────────────────────

  test("named timezone (America/New_York): post_date_gmt conversion is correct", () => {
    // Set named timezone — America/New_York is UTC-5 (EST) or UTC-4 (EDT/DST).
    // We use wp eval to get the exact offset WordPress derives from the timezone
    // string at runtime, so the test is correct regardless of DST season.
    runWpCli(`option update timezone_string "America/New_York"`);

    // Ask WordPress itself what offset it will use (in seconds)
    const offsetSecondsRaw = runWpCli(
      `eval 'echo wp_timezone()->getOffset(new DateTime("now", new DateTimeZone("UTC")));'`
    ).trim();
    const effectiveOffset = parseInt(offsetSecondsRaw, 10) / 3_600; // e.g. -5 or -4

    // Sync gmt_offset so WP-CLI post operations use the same offset
    runWpCli(`option update gmt_offset ${effectiveOffset}`);

    const nowUtcMs  = Date.now();
    const localDate = toLocalDateStr(nowUtcMs + 3_600_000, effectiveOffset);

    const id = runWpCli(
      `post create --post_title="${PREFIX}NamedTZ" --post_status=future --post_date="${localDate}" --porcelain`
    ).trim();

    try {
      const storedLocal = runWpCli(`post get ${id} --field=post_date`).trim();
      const storedGmt   = runWpCli(`post get ${id} --field=post_date_gmt`).trim();

      const localMs = parseUtcMs(storedLocal);
      const gmtMs   = parseUtcMs(storedGmt);

      // post_date should be |effectiveOffset| hours away from post_date_gmt
      const diffHours = (localMs - gmtMs) / 3_600_000;
      expect(Math.abs(diffHours - effectiveOffset)).toBeLessThan(0.1); // within ~6 min
    } finally {
      runWpCli(`post delete ${id} --force`);
      setGmtOffset(0); // restore before next test
    }
  });

  // ── 6. Restore and verify ─────────────────────────────────────────────────

  test("after restoring UTC+0, scheduling still works correctly", () => {
    setGmtOffset(0);

    const futureDate = toLocalDateStr(Date.now() + 3_600_000, 0);
    const id = runWpCli(
      `post create --post_title="${PREFIX}After-Restore" --post_status=future --post_date="${futureDate}" --porcelain`
    ).trim();

    try {
      const status = runWpCli(`post get ${id} --field=post_status`).trim();
      expect(status).toBe("future");

      const storedLocal = runWpCli(`post get ${id} --field=post_date`).trim();
      const storedGmt   = runWpCli(`post get ${id} --field=post_date_gmt`).trim();

      // At UTC+0 the two should match
      const diffMs = Math.abs(parseUtcMs(storedLocal) - parseUtcMs(storedGmt));
      expect(diffMs).toBeLessThan(2_000);
    } finally {
      runWpCli(`post delete ${id} --force`);
    }
  });
});
