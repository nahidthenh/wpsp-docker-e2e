# SchedulePress — Branch `73647-new` Review Report

**Date:** 2026-04-22  
**Branch:** `73647-new` (free + pro)  
**Tested by:** Automated Playwright E2E (claude-code)  
**Spec file:** `tests/regression/22-post-panel-revamp.spec.ts`

---

## What This Branch Does

This branch is a full architectural revamp of the SchedulePress post panel. The old Gutenberg block files (`assets/gutenberg/` in free, `react-dev/gutenberg/` in pro) have been replaced with a new React app structure (`src/` in free, `react-dev/post-panel/` in pro).

A new unified REST API endpoint now handles all scheduling saves from the editor panel:
- `GET  /wp-json/wp-scheduled-posts/v1/post-panel/{post_id}`
- `POST /wp-json/wp-scheduled-posts/v1/post-panel/{post_id}`

The free plugin handles `schedule_date`, then fires a `schedulepress_after_free_settings_save` hook so the Pro plugin can process `republish_on`, `unpublish_on`, and `advanced_schedule` fields.

---

## What Was Tested Automatically

### Suite 1 — Post Panel UI Structure (15 tests, all passed)

These tests open the Gutenberg editor on a new post, click the "Schedule And Share" button, and verify the revamped panel renders correctly.

| # | What was checked |
|---|-----------------|
| 1 | Modal opens with the `wpsp-post-panel-active` CSS class |
| 2 | Close button (×) removes the active class and hides the modal |
| 3 | **Schedule On** section heading (`h4`) is visible |
| 4 | Schedule On section contains a date picker with placeholder `Select date & time` |
| 5 | **Manage Schedule** section heading (`h4`) is visible |
| 6 | **Scheduling Options** section heading (`h4`) is visible |
| 7 | Scheduling Options shows **Unpublish On** sub-heading (`h5`) |
| 8 | Scheduling Options shows **Republish On** sub-heading (`h5`) |
| 9 | Unpublish On / Republish On fields have date inputs with placeholder `Y/M/D H:M:S` |
| 10 | PRO: **Advanced Schedule** wrapper (`.wpsp-post-items-advanced-schedule-wrapper`) is rendered |
| 11 | PRO: Advanced Schedule section title text is visible |
| 12 | **Save Changes** button (`id="wpsp-save-settings"`) is visible |
| 13 | Save Changes button is enabled (not disabled) |
| 14 | Save Changes button has the correct CSS classes (`btn primary-btn`) |

### Suite 2 — REST API (7 tests, 6 passed, 1 failed)

These tests create posts via WP-CLI, call the new REST endpoint from an authenticated browser session, then verify the result via WP-CLI.

| # | What was checked | Result |
|---|-----------------|--------|
| 1 | `GET /post-panel/{id}` returns `success: true` for a draft post | PASS |
| 2 | `GET /post-panel/{id}` returns a non-empty `schedule_date` for a future post | PASS |
| 3 | `POST /post-panel/{id}` with `schedule_date` + `is_scheduled: true` → post becomes `future` | PASS |
| 4 | `POST /post-panel/{id}` with `is_scheduled: false` → post reverts from `future` to `draft` | **FAIL** |
| 5 | `POST /post-panel/{id}` with `republish_on` saves `_wpscp_schedule_republish_date` meta (PRO) | PASS |
| 6 | `POST /post-panel/{id}` with `unpublish_on` saves `_wpscp_schedule_draft_date` meta (PRO) | PASS |
| 7 | Unauthenticated `POST` to the endpoint returns `401` or `403` | PASS |

---

## What You Need to Verify Manually

The automated tests cover rendering and API correctness but cannot fully test interactive flows and visual feedback. Please verify the following manually in the browser on the `73647-new` branch:

### Scheduling

- [ ] Open a **new draft post** in the Gutenberg editor
- [ ] Click "Schedule And Share" → select a future date in the Schedule On picker → click **Save Changes**
- [ ] Confirm: post changes to "Scheduled" status in the editor header
- [ ] Confirm: toast notification shows "Settings saved successfully"
- [ ] Confirm: the saved date is pre-filled when you re-open the panel on the same post

### Republish

- [ ] Open a **draft post** → open the panel → set a **Republish On** date → Save Changes
- [ ] Confirm: the date is stored (check WP Admin › Posts › Quick Edit or WP-CLI `post meta get`)
- [ ] Confirm: clearing the Republish On field and saving removes the meta

### Unpublish

- [ ] Open a **published post** → open the panel → set an **Unpublish On** date → Save Changes
- [ ] Confirm: the date is stored
- [ ] Confirm: clearing the Unpublish On field and saving removes the meta

### PRO — Advanced Schedule

- [ ] Open any post → open the panel → scroll to **Scheduling Options → Advanced Schedule**
- [ ] Toggle **Advanced Schedule** on — confirm the schedule date field appears below the toggle
- [ ] Set a date, click outside to close the picker — confirm date is shown in the input
- [ ] Click **Save Changes** — confirm the settings are saved without error
- [ ] Toggle Advanced Schedule back off — confirm the disable confirmation modal appears
- [ ] Confirm clicking "Disable" in that modal turns the toggle off

### PRO — Manage Schedule (Auto / Manual)

- [ ] With **Auto Schedule** active system: open a draft post panel → confirm the Auto Schedule checkbox and suggested date are shown under Manage Schedule
- [ ] With **Manual Schedule** active system: confirm a slot dropdown is shown under Manage Schedule
- [ ] For a **scheduled post** (`future` status): confirm the **Publish Immediately** option (current date / future date buttons) is shown instead of Auto/Manual

### Social Share

- [ ] Open the panel → confirm the **Social Share** section is visible with platform list
- [ ] Confirm the **Share Now** button is visible
- [ ] Confirm the **Add Social Message** and **Upload Social Banner** buttons are visible

### Classic Editor (if applicable)

- [ ] Open a post in the Classic Editor
- [ ] Confirm the "Schedule And Share" button appears in the post sidebar
- [ ] Confirm Schedule On, Scheduling Options sections load correctly
- [ ] Save Changes and confirm the post is scheduled

---

## Issue Found

### Bug: Unscheduling a post via the new REST API does not revert status to draft

**Severity:** High  
**File:** `includes/API/PostPanel.php` (free repo, `73647-new` branch)  
**Method:** `PostPanel::save_settings()`

**What happens:** When the user clears the schedule date in the panel and clicks Save Changes, the frontend sends `is_scheduled: false` + `schedule_date: ""` to the API. The handler ignores this combination and makes no `wp_update_post` call, so the post stays in `future` status.

**Expected:** Post status reverts to `draft` when `is_scheduled=false`.  
**Actual:** Post status stays `future`.

**Root cause in code:**

```php
// Current code — only handles scheduling ON:
if ( $is_scheduled && ! empty( $schedule_date ) ) {
    wp_update_post([
        'ID'          => $post_id,
        'post_status' => 'future',
        // ...
    ]);
}
// ← No else-branch to handle is_scheduled=false
```

**Suggested fix:**

```php
if ( $is_scheduled && ! empty( $schedule_date ) ) {
    $post_date     = date( 'Y-m-d H:i:s', strtotime( $schedule_date ) );
    $post_date_gmt = get_gmt_from_date( $post_date );
    wp_update_post([
        'ID'            => $post_id,
        'post_date'     => $post_date,
        'post_date_gmt' => $post_date_gmt,
        'post_status'   => 'future',
        'edit_date'     => true,
    ]);
} elseif ( ! $is_scheduled && get_post_status( $post_id ) === 'future' ) {
    wp_update_post([
        'ID'          => $post_id,
        'post_status' => 'draft',
    ]);
}
```

---

## Overall Verdict

| Area | Status |
|------|--------|
| Panel UI renders (all 3 sections + PRO components) | PASS |
| Modal open / close | PASS |
| Schedule post via new REST API | PASS |
| Republish / Unpublish meta via PRO hook | PASS |
| REST API auth boundary | PASS |
| **Unschedule (clear date → revert to draft)** | **FAIL** |

**The branch is not safe to merge until the unschedule bug is fixed.** All other automated checks pass. Complete the manual checklist above (especially Classic Editor and the Manage Schedule auto/manual flows) before final sign-off.
