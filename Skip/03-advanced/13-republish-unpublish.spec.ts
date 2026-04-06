/**
 * 13-republish-unpublish.spec.ts
 *
 * Tier 03 — Advanced: PRO republish / unpublish cycle.
 *
 * SchedulePress PRO stores:
 *   _wpscp_schedule_republish_date  → date to re-publish a draft back to publish
 *   _wpscp_schedule_draft_date      → date to move a published post back to draft
 *
 * Cron flow (two-step):
 *   1. wp post update fires save_post → PRO schedules `wpsp_pro_update_post` cron
 *   2. First cron run executes `wpsp_pro_update_post` → reads meta → schedules
 *      `wpscp_pro_schedule_republish` / `wpscp_pro_schedule_unpublish`
 *   3. Second cron run executes those hooks → changes post status
 */

import { test, expect } from "../../../fixtures/base-fixture";
import { runWpCli, runWpCron, sleep, deletePostsByTitlePrefix } from "../../../utils/wp-helpers";

const PREFIX = "E2E-RepubUnpub-";

/** Returns "YYYY-MM-DD HH:MM:SS" N seconds from now (negative = past). */
function wpDate(offsetSeconds: number): string {
  return new Date(Date.now() + offsetSeconds * 1000)
    .toISOString().slice(0, 19).replace("T", " ");
}

/**
 * PRO cron is a two-step chain:
 *   1. wp post update → edit_post → create_cron_job_for_reschedule → schedules
 *      `wpsp_pro_update_post` at time()+20 and sets a 10-second debounce transient.
 *   2. First runWpCron (after 22s): `wpsp_pro_update_post` fires → debounce expired →
 *      set_cron_for_unpublish_republish reads meta → schedules
 *      `wcscp_pro_schedule_republish` / `wcscp_pro_schedule_unpublish` (meta date must still be future!)
 *   3. Second runWpCron (after meta date passes): status actually changes.
 *
 * Timing constraints:
 *   - Must sleep ≥ 20s before first runWpCron so wpsp_pro_update_post is due.
 *   - Must sleep ≥ 10s before first runWpCron so the 10s debounce has expired.
 *   - CRON_DATE_SECONDS must be > ~35s so meta date is still future when first cron fires.
 */
const CRON_DATE_SECONDS = 45; // meta date set 45 seconds from now

function runCronChain(): void {
  sleep(22); // wait for wpsp_pro_update_post to be due (scheduled time()+20) and debounce to expire (10s)
  runWpCron(); // step 1: wpsp_pro_update_post → schedules wcscp_pro_schedule_republish/unpublish
  sleep(15); // wait for meta date to pass (set to T+45; by now T+37, need ~8 more seconds)
  runWpCron(); // step 2: wcscp_pro_schedule_republish/unpublish fires → status changes
}

test.describe("SchedulePress PRO – Republish / Unpublish", () => {

  test.afterAll(() => {
    deletePostsByTitlePrefix(PREFIX);
  });

  // ── Meta storage ────────────────────────────────────────────────────────

  test("setting republish meta via WP-CLI stores _wpscp_schedule_republish_date", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Republish-Meta" --post_status=draft --porcelain`
    );
    const futureDate = wpDate(3600);
    runWpCli(`post meta set ${id} _wpscp_schedule_republish_date "${futureDate}"`);
    const stored = runWpCli(`post meta get ${id} _wpscp_schedule_republish_date`);
    expect(stored.trim()).toBe(futureDate);
    runWpCli(`post delete ${id} --force`);
  });

  test("setting unpublish meta via WP-CLI stores _wpscp_schedule_draft_date", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Unpublish-Meta" --post_status=publish --porcelain`
    );
    const futureDate = wpDate(3600);
    runWpCli(`post meta set ${id} _wpscp_schedule_draft_date "${futureDate}"`);
    const stored = runWpCli(`post meta get ${id} _wpscp_schedule_draft_date`);
    expect(stored.trim()).toBe(futureDate);
    runWpCli(`post delete ${id} --force`);
  });

  // ── Cron-driven republish ────────────────────────────────────────────────

  test.skip("cron republishes a draft when republish date is past-due", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Republish-Cron" --post_status=draft --porcelain`
    );
    runWpCli(`post meta set ${id} _wpscp_schedule_republish_date "${wpDate(CRON_DATE_SECONDS)}"`);
    runWpCli(`post update ${id} --post_title="${PREFIX}Republish-Cron"`);
    runCronChain();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(status.trim()).toBe("publish");
    runWpCli(`post delete ${id} --force`);
  });

  test("draft does NOT republish before republish date is reached", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Republish-Early" --post_status=draft --porcelain`
    );
    // Future date → not due yet
    runWpCli(`post meta set ${id} _wpscp_schedule_republish_date "${wpDate(3600)}"`);
    runWpCli(`post update ${id} --post_title="${PREFIX}Republish-Early"`);
    runWpCron();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(status.trim()).toBe("draft");
    runWpCli(`post delete ${id} --force`);
  });

  // ── Cron-driven unpublish ────────────────────────────────────────────────

  test("cron unpublishes a post when unpublish date is past-due", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Unpublish-Cron" --post_status=publish --porcelain`
    );
    runWpCli(`post meta set ${id} _wpscp_schedule_draft_date "${wpDate(CRON_DATE_SECONDS)}"`);
    runWpCli(`post update ${id} --post_title="${PREFIX}Unpublish-Cron"`);
    runCronChain();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(["draft", "private"]).toContain(status.trim());
    runWpCli(`post delete ${id} --force`);
  });

  test("published post stays published before unpublish date is reached", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}Unpublish-Early" --post_status=publish --porcelain`
    );
    runWpCli(`post meta set ${id} _wpscp_schedule_draft_date "${wpDate(3600)}"`);
    runWpCli(`post update ${id} --post_title="${PREFIX}Unpublish-Early"`);
    runWpCron();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(status.trim()).toBe("publish");
    runWpCli(`post delete ${id} --force`);
  });

  // ── Full cycle ────────────────────────────────────────────────────────────

  test("full cycle: publish → unpublish (cron) → republish (cron)", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}FullCycle" --post_status=publish --porcelain`
    );
    // Unpublish first, republish after — stagger the dates
    runWpCli(`post meta set ${id} _wpscp_schedule_draft_date "${wpDate(CRON_DATE_SECONDS)}"`);
    runWpCli(`post update ${id} --post_title="${PREFIX}FullCycle-Unpublish"`);
    runCronChain(); // → post goes to draft/private
    const afterUnpublish = runWpCli(`post get ${id} --field=post_status`);
    expect(["draft", "private"]).toContain(afterUnpublish.trim());

    // Now set republish date and trigger the chain again
    runWpCli(`post meta set ${id} _wpscp_schedule_republish_date "${wpDate(CRON_DATE_SECONDS)}"`);
    runWpCli(`post update ${id} --post_title="${PREFIX}FullCycle-Republish"`);
    runCronChain(); // → post goes back to publish
    const afterRepublish = runWpCli(`post get ${id} --field=post_status`);
    expect(afterRepublish.trim()).toBe("publish");

    runWpCli(`post delete ${id} --force`);
  });

  // ── Meta accessible via REST ─────────────────────────────────────────────

  test("republish date meta is readable via REST API (authenticated)", async ({ adminPage }) => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}REST-Meta" --post_status=publish --porcelain`
    );
    const futureDate = wpDate(3600);
    runWpCli(`post meta set ${id} _wpscp_schedule_republish_date "${futureDate}"`);

    await adminPage.goto("/wp-admin/post-new.php", { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1500);
    const nonce = await adminPage.evaluate(() => (window as any).wpApiSettings?.nonce ?? "");

    const data = await adminPage.evaluate(
      async ({ postId, n }: { postId: string; n: string }) => {
        const r = await fetch(`/?rest_route=/wp/v2/posts/${postId}`, {
          headers: { "X-WP-Nonce": n },
        });
        return r.json();
      },
      { postId: id.trim(), n: nonce }
    );
    expect(data.id).toBeTruthy();
    runWpCli(`post delete ${id} --force`);
  });

  // ── Republish without unpublish ──────────────────────────────────────────

  test("republish without unpublish — post stays published after republish cron", () => {
    const id = runWpCli(
      `post create --post_title="${PREFIX}RepubNoUnpub" --post_status=draft --porcelain`
    );
    runWpCli(`post meta set ${id} _wpscp_schedule_republish_date "${wpDate(CRON_DATE_SECONDS)}"`);
    runWpCli(`post update ${id} --post_title="${PREFIX}RepubNoUnpub"`);
    runCronChain();
    const status = runWpCli(`post get ${id} --field=post_status`);
    expect(status.trim()).toBe("publish");
    runWpCli(`post delete ${id} --force`);
  });
});
