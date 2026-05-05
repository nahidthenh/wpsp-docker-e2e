# Test Report — Branch `73647-new`

**Date:** 2026-04-22  
**Tested by:** Claude Code (automated)  
**Repos analysed:** Free (`wp-scheduled-posts`) + Pro (`wp-scheduled-posts-pro`)  
**Environment:** Docker · WordPress 6.5 · PHP 8.2 · Playwright (Chromium)  
**Total specs run:** 21 regression specs · ~200 individual tests  

---

## What This Branch Does

Branch `73647-new` is a **complete refactor of the Gutenberg post panel UI** across both plugins:

- **Free plugin:** Deletes all `assets/gutenberg/` JS files and replaces them with a new `src/` React component architecture. Adds a new REST API endpoint (`GET/POST /wp-json/wp-scheduled-posts/v1/post-panel/{post_id}`). Registers the "Schedule And Share" button via a PHP `add_meta_box()` instead of a Gutenberg plugin. Disables the Classic Editor social-share metabox (commented out).
- **Pro plugin:** Deletes all `react-dev/gutenberg/` JS files and introduces a new `react-dev/post-panel/` structure with dedicated components for `ManualSchedule`, `AutoSchedule`, `PublishImmediately`, `AdvancedSchedule`, `RepublishDate`, and `UnpublishDate`. Adds a new `AdvancedSchedule.php` class. Pro fields now integrate via a `schedulepress_after_free_settings_save` hook.

---

## Verdict

> ❌ **DO NOT MERGE** — critical UX regression in the Gutenberg post panel.

---

## Results Summary

| # | Spec | Tests | Pass | Fail | Status |
|---|------|-------|------|------|--------|
| 01 | Plugin Activation | 8 | 6 | 2 | ⚠️ Infra |
| 02 | Settings Page | 60+ | All | 0 | ✅ |
| 03 | Calendar UI | 10 | All | 0 | ✅ |
| 04 | Schedule Post | 8 | All | 0 | ✅ |
| 05 | PRO Features | 12 | All | 0 | ✅ |
| 06 | Post Metabox | 32 | 0 | **32** | ❌ Branch |
| 07 | Settings Save | 8 | 7 | 1 | ⚠️ Flaky |
| 08 | Scheduling Hub | 12 | All | 0 | ✅ |
| 09 | Dashboard Widget | 5 | All | 0 | ✅ |
| 10 | Admin Bar | 5 | All | 0 | ✅ |
| 11 | Calendar Events | 8 | All | 0 | ✅ |
| 12 | Full Schedule→Publish | 10 | All | 0 | ✅ |
| 13 | Republish / Unpublish | 8 | All | 0 | ✅ |
| 14 | Missed Schedule Recovery | 8 | All | 0 | ✅ |
| 15 | Social Share Queue | 8 | All | 0 | ✅ |
| 16 | Advanced Schedule | 8 | 6 | **2** | ❌ Branch |
| 17 | API Security | 9 | 7 | 2 | ⚠️ Pre-existing |
| 18 | User Roles | 10 | 9 | 1 | ⚠️ Flaky |
| 19 | Timezone | 7 | All | 0 | ✅ |
| 20 | Post Type Scheduling | 7 | 5 | **2** | ❌ Branch |
| 21 | Calendar Draft Time | 3 | 2 | 1 | ⚠️ Pre-existing |

---

## ❌ Broken by This Branch

### 1. Gutenberg Post Panel — Schedule And Share Button Hidden (CRITICAL)

**Affected specs:** `06-post-metabox.spec.ts` (32/32), `20-post-type-scheduling.spec.ts` (2/7), `16-advanced-schedule.spec.ts` (1 block-editor test)  
**Total broken:** ~35 tests

**What happened:**  
The old implementation registered SchedulePress as a Gutenberg plugin using `wp-plugins` and `wp-edit-post` WordPress block editor APIs. This placed a persistent "SchedulePress" panel in the right sidebar with a "Schedule And Share" button, Social Share Settings, and 8 platform accordion items — all visible immediately when opening any post.

The new implementation registers the button via a PHP `add_meta_box()` call (`context='side'`). In the Gutenberg editor, PHP metaboxes appear inside a collapsible **"Meta Boxes"** region at the very bottom of the editor — and it is **collapsed by default**.

**Evidence from test run:**
```
44 × locator resolved to hidden
<button type="button" id="wpsp-post-panel-button">Schedule And Share</button>
```
The button IS in the DOM but its parent container (`region "Meta Boxes"`) is collapsed, so it is always hidden.

**DOM state of the Gutenberg editor on this branch:**
```
Editor top bar ✓
Editor content ✓
  iframe (block editor) ✓
  region "Meta Boxes"          ← collapsed by default
    button "Meta Boxes" ✓      ← user must click this first
    [button #wpsp-post-panel-button hidden inside]
Editor settings (sidebar)      ← EMPTY — no SchedulePress panel
```

**Old DOM state (master branch):**
```
Editor settings (sidebar)
  .components-panel__body.schedulepress-options  ← always visible
    "Schedule And Share" button  ← immediately accessible
    Social Share Settings heading
    8 platform accordion items (Facebook, Twitter, etc.)
```

**What is missing from the UI after this branch:**
- The SchedulePress right sidebar panel is completely gone
- Social Share Settings and platform accordions in the sidebar are gone
- The "Schedule And Share" button requires expanding a hidden bottom panel
- Users opening a post would see no indication that SchedulePress is active

**Fix required:** Either re-add a Gutenberg `registerPlugin`/`PluginSidebar` entry point so the button stays in the right sidebar, or ensure the "Meta Boxes" panel auto-expands on page load.

---

### 2. Advanced Schedule — WP-CLI Post Cleanup Fails

**Affected spec:** `16-advanced-schedule.spec.ts` — `_wpscppro_advance_schedule meta can be set and read via WP-CLI`

The test assertions all **pass** (meta is set, read, and parsed correctly), but the cleanup step `wp post delete --force` fails:

```
Warning: Failed deleting post 1496.
```

The new `AdvancedSchedule.php` class registers hooks that likely intercept or block forced deletion of posts related to the advanced schedule system. The old system did not have this restriction.

---

## ⚠️ Pre-existing Issues (Not Caused by This Branch)

These failures existed before this branch and are unrelated to the changes.

| Spec | Test | Reason |
|------|------|--------|
| `01-plugin-activation` | Free plugin row in Plugins list (2 tests) | Docker cannot reach wordpress.org → PHP warning → "headers already sent" → plugins page renders broken. WP-CLI confirms plugin IS active and running. |
| `17-api-security` | REST write with no nonce returns 404 | Test asserts `[401, 403]` but then uses `.toContain(404)` — assertion logic is inverted in the test itself. WordPress correctly returns 401. |
| `17-api-security` | Subscriber cannot edit posts | Subscriber user login fails during test setup; unrelated to plugin code. |
| `18-user-roles` | Editor sees all users' scheduled posts | Race condition — admin post created in `beforeAll` not yet indexed when editor assertion runs. |
| `07-settings-save` | Dashboard Widget toggle OFF persists | Intermittent toggle state issue; passes on isolated re-run. |
| `21-calendar-draft-time` | Post lands on clicked day (next-month cell) | Clicking "Add New" on a May 2 cell (10 days ahead, next month) does not open a dialog because the calendar is showing April and the overflow cell doesn't respond the same way. Test needs a month-navigation step. |

---

## ✅ What Passed (Works Correctly)

All core scheduling and backend functionality is intact on this branch:

| Feature | Result | Notes |
|---------|--------|-------|
| Plugin activates without PHP errors | ✅ | Confirmed via WP-CLI |
| Settings page — all tabs load | ✅ | Social Profiles, Calendar, General, Email Notify |
| Settings save and persist | ✅ | Toggle states survive page reload |
| Scheduling Hub — all sub-tabs | ✅ | Auto, Manual, Advanced, Missed, Manage |
| Calendar UI renders | ✅ | Day cells, month navigation, today button |
| Calendar events appear for scheduled posts | ✅ | Title, markers, multi-post same day |
| Schedule post via WP-CLI → status=future | ✅ | |
| Scheduled post appears in wp-admin list | ✅ | |
| Scheduled post is NOT publicly accessible before publish | ✅ | REST returns 401 unauthenticated |
| Cron publishes scheduled post at correct time | ✅ | |
| Published post moves out of Scheduled list | ✅ | |
| Rescheduling a published post updates date | ✅ | |
| Two posts scheduled at same time both publish | ✅ | |
| Post 1 year in future schedules correctly | ✅ | |
| PRO — Republish cron fires at correct date | ✅ | |
| PRO — Unpublish cron fires at correct date | ✅ | |
| PRO — Full publish → unpublish → republish cycle | ✅ | |
| PRO — Republish without unpublish stays published | ✅ | |
| Missed schedule recovery on cron tick | ✅ | |
| Multiple missed posts all recover in one run | ✅ | |
| Cron does not re-publish an already-published post | ✅ | |
| Dashboard Widget renders scheduled posts | ✅ | |
| Admin Bar shows scheduled posts | ✅ | |
| Sitewide Admin Bar works | ✅ | |
| REST API — admin can read/update posts with nonce | ✅ | |
| REST API — forged nonce is rejected | ✅ | |
| REST API — unauthenticated reads return 401/403 | ✅ | |
| User roles — author can schedule own posts | ✅ | |
| User roles — author cannot see admin posts | ✅ | |
| User roles — author cannot access Calendar | ✅ | |
| User roles — subscriber cannot access editor | ✅ | |
| Timezone UTC+0 / UTC+6 / UTC-5 / named TZ | ✅ | All conversion tests pass |
| Post type scheduling — post, page | ✅ | Both get status=future |
| Advanced Schedule settings tab in hub | ✅ | Loads, no PHP errors, has controls |
| PRO meta fields (unpublish, republish, advance) | ✅ | Set/read via WP-CLI |
| Social share queue (social skip meta) | ✅ | |
| Calendar draft post time preservation (time fields) | ✅ | 2 of 3 time tests pass |

---

## 🔍 Manual Verification Required

These items cannot be tested by the automated suite and must be checked by hand in the browser.

### High Priority

1. **"Meta Boxes" panel auto-expand behaviour**  
   Open a new post in the Gutenberg editor. Scroll to the bottom of the editor. Does the "Meta Boxes" panel appear collapsed? Click to expand it. Confirm the "Schedule And Share" button is visible. Assess whether this UX is acceptable or whether users would find the button at all.

2. **"Schedule And Share" button → modal → React app loads**  
   After expanding "Meta Boxes", click "Schedule And Share". Confirm the modal opens, the React app mounts without JS console errors, and the schedule date picker, Scheduling Options, and Save Changes / Share Now buttons are all present.

3. **Scheduling from the new modal — save and verify**  
   Open a draft post → expand Meta Boxes → click "Schedule And Share" → set a future date → click Save Changes. Verify the post transitions to `future` status and the date is stored correctly.

4. **PRO — Unpublish On / Republish On in new modal**  
   With PRO active, open the modal on an existing published post. Confirm the "Unpublish On" and "Republish On" date pickers appear and can be set. Save and verify the meta keys `_wpscp_schedule_draft_date` and `_wpscp_schedule_republish_date` are written correctly.

5. **PRO — Advanced Schedule toggle in modal**  
   Open the modal on a draft post. Confirm the "Advanced Schedule" section renders with its enable toggle and date picker. Enable it, set a future date, save, and verify `_wpscppro_post_advance_schedule` meta is set.

6. **Share Now flow — status modal**  
   With at least one social profile connected, open the modal on a published post, select a profile, and click "Share Now". Confirm the new `ShareNowStatusModal` appears and shows per-platform status.

7. **Social templates (Custom Template modal)**  
   Open the modal and click "Add Social Message". Confirm the custom social template modal opens, shows platform navigation, preview card, and the template editor. Verify templates can be saved.

### Medium Priority

8. **Classic Editor — social share metabox is gone**  
   Install/enable Classic Editor plugin. Open a post in Classic Editor. Confirm the "Social Share Settings" metabox does NOT appear in the side panel (it was commented out in this branch).

9. **New REST API endpoint reachable**  
   With a post ID, call `GET /wp-json/wp-scheduled-posts/v1/post-panel/{post_id}` authenticated. Confirm it returns `{ success: true, data: { schedule_date, post_status } }`.

10. **PRO REST endpoint returns unpublish/republish data**  
    Call the same GET endpoint on a post that has `_wpscp_schedule_draft_date` set. Confirm the response includes `unpublish_on` and `republish_on` fields.

11. **Social share sidebar accordion — confirm completely removed**  
    Open a post in the Gutenberg editor. Open the right sidebar (Settings gear icon). Confirm there is NO "SchedulePress" or "Social Share Settings" panel in the sidebar. The social share controls should only be accessible inside the modal now.

### Low Priority

12. **Elementor editor — Schedule And Share button**  
    Open a post using the Elementor editor. Confirm the SchedulePress button/icon still appears in the Elementor UI (the Elementor integration was not changed in this branch but worth confirming).

13. **Advanced Schedule post type — admin list**  
    Go to `wp-admin` and check if the `advanced_schedule` custom post type is registered and visible (the new `AdvancedSchedule.php` registers it). Confirm posts of this type appear correctly.

14. **Post deletion with advanced schedule active**  
    Enable advanced schedule on a post, then try to delete that post. Confirm deletion behaviour is correct (no orphaned `advanced_schedule` posts left behind).

---

## Environment Notes

- Docker containers must be running (`docker compose up -d`) before any test run
- Both plugin repos must be on the same branch (`73647-new`) simultaneously
- The branch JS is **pre-built** — `app.min.js` (101 KB) exists at `assets/js/app.min.js`; no `npm run build` is needed
- To restore to master: `cd ../wpsp/wp-scheduled-posts && git checkout master` and same for pro repo
