# SchedulePress E2E Testing Roadmap

## Overview

| Tier | Spec files | Approx tests | Focus |
|---|---|---|---|
| 01-Basic | 5 (done) | 131 | Rendering + data existence |
| 02-Medium | 6 (planned) | ~80 | UI interaction + settings persistence |
| 03-Advanced | 6 (planned) | ~60 | End-to-end flows + cron + PRO cycles |
| **Total** | **17** | **~270** | |

---

## TIER 01 — BASIC (Done) `131 tests`

> **Goal:** Prove the plugin is installed, all UI surfaces render, and core data structures exist.

| Spec | Tests | What it proves |
|---|---|---|
| `01-plugin-activation.spec.ts` | 9 | Both plugins active, menu links exist, no PHP fatal |
| `02-settings-page.spec.ts` | 97 | All 7 tabs visible, all 8 social platform cards/templates present |
| `03-calendar.spec.ts` | 14 | Calendar renders, toolbar works, month navigation works |
| `04-schedule-post.spec.ts` | 7 | Create post → status=future → appears in admin list + calendar |
| `05-pro-features.spec.ts` | 12 | PRO meta fields exist, License/Scheduling Hub tabs load, missed-schedule cron registered |

**Characteristic:** Read-only + WP-CLI verification. Nothing is saved through the UI. No flows are completed end-to-end.

### What each spec covers

**`01-plugin-activation.spec.ts`**
- Free + PRO plugin rows visible in Plugins list
- Both plugins show "Active" status
- SchedulePress top-level menu + Calendar sub-menu appear in sidebar
- Settings page loads without PHP fatal errors
- WP-CLI confirms both slugs are active

**`02-settings-page.spec.ts`**
- Settings page: HTTP 200, branding, wp-admin chrome
- General tab: all field labels present (Dashboard Widget, Admin Bar, Post Types, Taxonomy, Categories, Users, Republish/Unpublish, Enhanced Publishing)
- Email Notify tab: section heading + Under Review + Scheduled toggle labels
- Social Profile tab: all 8 platform cards rendered, names visible, Add New button, description text, React-Select dropdowns (Facebook + LinkedIn)
- Social Templates tab: all 8 platform sub-tabs, template_structure input scoped per platform, placeholder tokens
- Scheduling Hub: Auto Scheduler, Manual Scheduler, Manage Schedule accessible after clicking Hub
- License tab: present in sidebar, loads without errors

**`03-calendar.spec.ts`**
- Calendar page: HTTP 200, no PHP fatal, wp-admin chrome intact
- FullCalendar root (.fc) renders, day-grid cells present
- Custom WPSP toolbar (NOT native FC toolbar): visible, month title has 4-digit year
- Prev/Next/Today buttons visible and enabled
- Month navigation: clicking next changes title; today restores current month

**`04-schedule-post.spec.ts`**
- Create post via WP-CLI with future date
- WP-CLI confirms status=future + correct title
- Post appears in wp-admin Posts > Scheduled list with "Scheduled" label
- REST API (cookie+nonce auth) returns status=future
- Unauthenticated request cannot access the post before publish
- Post event dot appears on the correct calendar day cell

**`05-pro-features.spec.ts`**
- PRO Settings tabs: License and Manage Schedule present
- License tab loads without errors
- PRO meta fields via WP-CLI: `_wpscppro_unpublish_date`, `_wpscppro_republish_date`, `_wpscppro_advance_schedule`
- Meta accessible via REST API (cookie+nonce auth)
- Missed-schedule: setting stored in `wpsp_settings_v5` option
- Past-dated post triggers cron handling
- Social meta: `_wpscppro_social_skip`, `_wpscppro_selected_social_profile`

---

## TIER 02 — MEDIUM (Planned) `~80 tests`

> **Goal:** Interact with the UI, save settings, and verify persistence. Single-feature flows completed through the browser.

### `06-post-metabox.spec.ts` — Post Editor Scheduling Metabox (~15 tests)

**Priority: HIGH** — most-used user surface, zero coverage currently.

| # | Test | Verify |
|---|---|---|
| 1 | Metabox renders in Classic Editor | `.wpsp-schedule-metabox` or equivalent container visible |
| 2 | Metabox renders in Gutenberg sidebar | WPSP sidebar panel visible in block editor |
| 3 | Date/time picker opens on click | Date input becomes interactive |
| 4 | Set future date → save draft → status = future | WP-CLI confirms `post_status=future` |
| 5 | Set past date → save draft → status = draft | WP-CLI confirms no scheduled status |
| 6 | "Publish Immediately" button visible when toggle ON | Button appears in metabox/sidebar |
| 7 | "Publish Immediately" click publishes post | Post status becomes `publish` immediately |
| 8 | Social share checkbox is visible in metabox | Checkbox/toggle present |
| 9 | Social share checkbox is toggleable | State changes on click |
| 10 | Clearing the date → post status stays draft | No `future` status without a date |
| 11 | Scheduled post title editable and saves | Title update persists after save |
| 12 | Metabox shows existing schedule for saved posts | Re-opening shows previously set date/time |
| 13 | Date format respects WordPress date format setting | Displayed format matches WP setting |
| 14 | Time zone label is displayed | Site timezone shown near date input |
| 15 | Metabox present for custom post types (if enabled) | Metabox appears for CPTs configured in General settings |

### `07-settings-save.spec.ts` — Settings Persist After Save (~20 tests)

**Priority: HIGH** — confirms the React settings app actually writes to the DB.

| # | Test | Verify |
|---|---|---|
| 1 | Toggle "Dashboard Widget" ON → Save → reload → still ON | Toggle state persists |
| 2 | Toggle "Dashboard Widget" OFF → Save → reload → still OFF | Toggle off persists |
| 3 | Toggle "Sitewide Admin Bar" ON → Save → reload | State persists |
| 4 | Toggle "Admin Bar" ON → Save → reload | State persists |
| 5 | Change Admin Bar item template text → Save → reload | Text value persists |
| 6 | Enable "Show Publish Post Immediately Button" → Save → reload | Toggle persists |
| 7 | Enable "Post Republish and Unpublish" → Save → reload | Toggle persists |
| 8 | Email Notify: enable "Under Review" → Save → reload | Toggle persists |
| 9 | Email Notify: enable "Scheduled" → Save → reload | Toggle persists |
| 10 | Email Notify: enable "Published" → Save → reload | Toggle persists |
| 11 | Social Templates: change Facebook template text → Save → reload | New value persists |
| 12 | Social Templates: change Twitter template text → Save → reload | New value persists |
| 13 | Settings saved to `wpsp_settings_v5` DB option | WP-CLI `option get wpsp_settings_v5` reflects UI value |
| 14 | Save shows success notice | "Settings Saved" or equivalent toast/notice appears |
| 15 | Invalid value rejected with validation message | Error shown for bad input |
| 16 | Calendar tab: change setting → Save → reload | Setting persists |
| 17 | General: Add Post Type → Save → reload → type still selected | Multi-select persists |
| 18 | General: Remove Post Type → Save → reload → type gone | Removal persists |
| 19 | Settings survive page navigation away and back | No data loss on tab switch |
| 20 | Concurrent save (double-click Save) → only one write | No duplicate DB entries |

### `08-scheduling-hub.spec.ts` — Auto & Manual Scheduler UI (~20 tests)

**Priority: MEDIUM** — core PRO scheduling feature.

| # | Test | Verify |
|---|---|---|
| 1 | Auto Scheduler enable toggle is present | Toggle exists in panel |
| 2 | Toggle Auto Scheduler ON → Save → reload → ON | Persists |
| 3 | Toggle Auto Scheduler OFF → Save → reload → OFF | Persists |
| 4 | Add a time slot → Save → slot appears after reload | Time slot persists |
| 5 | Add multiple time slots → Save → all appear | Multiple slots persist |
| 6 | Remove a time slot → Save → slot gone after reload | Deletion persists |
| 7 | Time slot input validates HH:MM format | Invalid time rejected |
| 8 | Manual Scheduler panel renders | Panel visible |
| 9 | Switch to Manual mode → Save → mode persists | Mode setting saved |
| 10 | Manage Schedule table renders | Table/list visible |
| 11 | Manage Schedule table has correct columns | Title, Date, Status columns present |
| 12 | Manage Schedule filter by post type works | Filter dropdown changes visible rows |
| 13 | Manage Schedule filter by status works | Status filter narrows results |
| 14 | Manage Schedule pagination works (if >10 items) | Page 2 loads different rows |
| 15 | Manage Schedule: edit scheduled time inline | Date change saves via REST |
| 16 | Manage Schedule: delete a schedule entry | Entry removed from table |
| 17 | Advanced Schedule tab renders in Scheduling Hub | Tab visible and clickable |
| 18 | Missed Schedule tab renders in Scheduling Hub | Tab visible and clickable |
| 19 | Missed Schedule: recovery option toggle saves | Setting persists |
| 20 | Scheduling Hub settings saved to correct DB key | WP-CLI confirms option value |

### `09-dashboard-widget.spec.ts` — Dashboard Widget (~10 tests)

**Priority: MEDIUM** — visible on every WP admin login.

| # | Test | Verify |
|---|---|---|
| 1 | Enable widget in General settings → navigate to /wp-admin/ → widget panel visible | Widget container present |
| 2 | Widget shows correct count of scheduled posts | Count matches WP-CLI post count |
| 3 | Widget shows correct post titles | Titles match scheduled posts |
| 4 | Widget links to each post's edit screen | Links are valid hrefs |
| 5 | Disable widget → navigate to /wp-admin/ → widget gone | Widget container absent |
| 6 | Widget updates after new post is scheduled | Count increments |
| 7 | Widget updates after scheduled post is deleted | Count decrements |
| 8 | Widget handles zero scheduled posts gracefully | "No posts" message or empty state |
| 9 | Widget respects post type filter from General settings | Only configured types shown |
| 10 | Widget is not visible to non-admin users | Subscriber cannot see widget |

### `10-admin-bar.spec.ts` — Admin Bar Scheduled Posts (~10 tests)

**Priority: LOW-MEDIUM** — secondary surface but customer-visible.

| # | Test | Verify |
|---|---|---|
| 1 | Enable "Sitewide Admin Bar" → frontend page → scheduled posts menu visible | Menu item in admin bar |
| 2 | Correct scheduled post count in admin bar | Count matches WP-CLI |
| 3 | Admin bar item template renders `{title}` token | Actual post title shown |
| 4 | Admin bar item template renders `{count}` token | Count shown in template |
| 5 | Disable admin bar → frontend page → no WPSP menu item | Menu item absent |
| 6 | Admin bar works on wp-admin pages too | Consistent across frontend + backend |
| 7 | Admin bar does not appear for logged-out users | No WPSP item for guests |
| 8 | Admin bar does not appear for subscribers | Role restriction respected |
| 9 | Clicking admin bar item navigates to post edit screen | Correct URL |
| 10 | Admin bar shows only posts in configured post types | CPT filter respected |

### `11-calendar-events.spec.ts` — Calendar Event Interaction (~8 tests)

**Priority: HIGH** — extends current calendar coverage to actual data.

| # | Test | Verify |
|---|---|---|
| 1 | Create scheduled post via WP-CLI → load calendar → event dot visible on correct day | Event rendered on right cell |
| 2 | Event tooltip/popup shows post title on click | Post title displayed |
| 3 | Event popup has link to post edit screen | Edit link is correct href |
| 4 | Multiple posts on same day → multiple events shown | All events rendered |
| 5 | Event color matches post type | Color coding works |
| 6 | Navigating to correct month shows event | Event on month boundary visible |
| 7 | Deleting post → event disappears from calendar | Calendar reflects deletion |
| 8 | Drag event to different day → `_publish_datetime` meta updates | Meta reflects new date |

---

## TIER 03 — ADVANCED (Planned) `~60 tests`

> **Goal:** Multi-step, cross-feature, stateful end-to-end flows. Simulate real user workflows including PRO republish/unpublish cycles, social queuing, and schedule recovery.

### `12-full-schedule-to-publish.spec.ts` — Complete Scheduling Flow (~12 tests)

**Priority: HIGH** — the core plugin promise: schedule a post, it publishes.

| # | Test | Verify |
|---|---|---|
| 1 | Create post via editor → set future date → save → status = future | WP-CLI + REST confirm future |
| 2 | Create post via editor → set future date → post appears in Scheduled list | Admin list shows it |
| 3 | Simulate cron tick (WP-CLI `wp cron event run`) → post status = publish | WP-CLI confirms publish |
| 4 | Published post is publicly accessible via REST | Unauthenticated REST returns 200 |
| 5 | Published post no longer in Scheduled list | Admin list cleared |
| 6 | Published post appears in Published list | Correct admin list |
| 7 | Published post's calendar event is removed | No event on calendar after publish |
| 8 | Post publish triggers WordPress `publish_post` hook (verify via custom meta flag) | Side effect confirmed |
| 9 | Two posts scheduled same time → both publish on cron tick | Both posts publish |
| 10 | Post with future date > 1 year → schedules correctly | No date overflow |
| 11 | Scheduling post in editor respects WordPress timezone setting | UTC offset applied correctly |
| 12 | Re-scheduling a published post resets it to future | Reschedule workflow works |

### `13-republish-unpublish.spec.ts` — PRO Republish/Unpublish Cycle (~12 tests)

**Priority: HIGH** — flagship PRO feature.

| # | Test | Verify |
|---|---|---|
| 1 | Set republish date via post metabox → Save → meta `_wpscppro_republish_date` set | WP-CLI confirms meta |
| 2 | Set unpublish date via post metabox → Save → meta `_wpscppro_unpublish_date` set | WP-CLI confirms meta |
| 3 | Simulate cron at republish time → post transitions to publish | Status = publish |
| 4 | Simulate cron at unpublish time → post transitions to draft | Status = draft |
| 5 | Full cycle: publish → cron republish → cron unpublish | Both transitions work |
| 6 | Republish date must be after publish date → validation | Error shown for past date |
| 7 | Unpublish date must be after publish date → validation | Error shown for invalid range |
| 8 | Republish without unpublish → post stays published | No unexpected unpublish |
| 9 | Unpublish without republish → post goes to draft once | No repeated unpublish |
| 10 | Republish date cleared after use | Meta cleaned up post-republish |
| 11 | Unpublish date cleared after use | Meta cleaned up post-unpublish |
| 12 | Republish/unpublish cycle visible in Manage Schedule table | Table reflects both dates |

### `14-missed-schedule-recovery.spec.ts` — Missed Schedule Handler (~8 tests)

**Priority: MEDIUM** — reliability feature.

| # | Test | Verify |
|---|---|---|
| 1 | Insert post with past scheduled date via WP-CLI → trigger cron → post published | Status = publish |
| 2 | Missed schedule recovery setting ON → recovery happens | Post publishes |
| 3 | Missed schedule recovery setting OFF → post stays future | Post not auto-published |
| 4 | Multiple missed posts → all recovered in one cron run | Batch recovery works |
| 5 | Recovery does not double-publish already-published posts | Idempotent |
| 6 | Missed post notification email sent (check wp_mail log or hook) | Email triggered |
| 7 | Missed Schedule tab in Scheduling Hub shows recovered posts | UI reflects history |
| 8 | Recovery time gap configurable in settings and respected | Setting honored |

### `15-social-share-queue.spec.ts` — Social Share on Publish (~10 tests)

**Priority: MEDIUM** — PRO social feature.

| # | Test | Verify |
|---|---|---|
| 1 | Enable social share on post → publish → `_wpscppro_social_share` meta set | Meta confirms share enabled |
| 2 | Social-skip flag ON → share queue entry NOT created | No queue entry |
| 3 | Selected platforms meta restricts which platforms queued | Only selected platforms queued |
| 4 | Social share queue entry appears in Manage Schedule table | Table shows pending share |
| 5 | All platforms deselected → no share attempted | No queue entries |
| 6 | Share queued for Facebook only → only Facebook entry in queue | Platform-specific queue |
| 7 | Instant Share: publish triggers immediate share attempt | Share attempted at publish time |
| 8 | Failed share → retry queue entry created | Retry logic present |
| 9 | Share on republish → new share queued for republished post | Republish triggers share |
| 10 | Manage Schedule table "Send Now" button triggers immediate share | Manual trigger works |

### `16-advanced-schedule.spec.ts` — PRO Advanced Schedule (~10 tests)

**Priority: MEDIUM** — PRO Gutenberg feature.

| # | Test | Verify |
|---|---|---|
| 1 | Enable advance-schedule toggle in post editor → extra fields appear | Additional date fields visible |
| 2 | Set multiple scheduled dates → Save → all dates in meta | All dates stored |
| 3 | Cron processes first date → post publishes | First transition correct |
| 4 | Cron processes second date → post transitions again | Second transition correct |
| 5 | Advance schedule dates shown in Manage Schedule table | Table shows all dates |
| 6 | Removing a date from advance schedule → Save → date gone | Deletion persists |
| 7 | Advance schedule works with Gutenberg block editor | Gutenberg-specific UI works |
| 8 | Advance schedule works with Classic Editor | Classic-specific UI works |
| 9 | Date order validation: later date cannot precede earlier | Validation rejects out-of-order dates |
| 10 | Advance schedule disabled → extra date fields hidden | Toggle hides fields |

### `17-api-security.spec.ts` — REST API Authorization & Permissions (~8 tests)

**Priority: HIGH** — security validation.

| # | Test | Verify |
|---|---|---|
| 1 | WPSP custom REST endpoints return 401 without auth | Unauthenticated blocked |
| 2 | WPSP REST endpoints return 403 for subscriber role | Role-based access enforced |
| 3 | Admin can read scheduling meta via REST | Admin access works |
| 4 | Admin can write scheduling meta via REST | Admin write works |
| 5 | Editor can schedule posts but not change plugin settings | Role boundary respected |
| 6 | Nonce-protected AJAX actions reject forged nonces | CSRF protection works |
| 7 | REST endpoint does not leak draft content to unauthenticated users | No data leakage |
| 8 | Brute-force protection: repeated bad nonce attempts blocked | Rate-limit or lockout triggered |

---

## Implementation Order

```
Phase 1 (now):   06-post-metabox      → highest user-surface coverage gain
Phase 2:         07-settings-save     → validates React settings app writes to DB
Phase 3:         11-calendar-events   → extends existing calendar tests with data
Phase 4:         08-scheduling-hub    → PRO Auto/Manual scheduler UI
Phase 5:         12-full-schedule     → first true end-to-end flow
Phase 6:         13-republish         → PRO flagship feature E2E
Phase 7:         09-dashboard-widget  → secondary surface
Phase 8:         10-admin-bar         → secondary surface
Phase 9:         14-missed-schedule   → reliability edge case
Phase 10:        15-social-share      → PRO social queue
Phase 11:        16-advanced-schedule → PRO Gutenberg feature
Phase 12:        17-api-security      → security hardening
```

---

## Key Technical Patterns (carry forward from Tier 01)

- **Auth:** Cookie session + `X-WP-Nonce` via `adminPage.evaluate()` — NOT Basic Auth
- **REST URL:** `/?rest_route=/wp/v2/posts/ID` (plain permalinks) — NOT `/wp-json/`
- **WP-CLI:** `docker run --rm --network ... wordpress:cli-php8.2` — NOT `docker-compose exec`
- **Navigation:** `waitUntil: "domcontentloaded"` — NOT `"networkidle"`
- **Settings nav:** `li.wprf-tab-nav-item[data-key="layout_*"]`
- **Social Templates input:** `input[name='template_structure'][parent*='platform']` — scoped by parent attribute
- **Social Profile wrappers:** `.wprf-{slug}_profile_list-social-profile`
- **Calendar toolbar:** `.wpsp-calender-content .toolbar` (custom, not FC native `.fc-header-toolbar`)
- **No hard waits:** use `waitFor`, `toBeVisible`, `toContainText` with explicit timeouts
