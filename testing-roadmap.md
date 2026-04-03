# SchedulePress E2E Testing Roadmap

## Progress Summary

| Tier | Spec files | Tests | Status |
|---|---|---|---|
| 01-Basic | 5 | 131 | ✅ Complete |
| 02-Medium | 6 | 85 pass / 1 skip | ✅ Complete |
| 03-Advanced | 6 | ~60 planned | 🔲 Not started |
| **Total so far** | **11** | **~216** | |

---

## TIER 01 — BASIC ✅ Complete `131 tests`

> **Goal:** Prove the plugin is installed, all UI surfaces render, and core data structures exist.

| Spec | Tests | Status | What it proves |
|---|---|---|---|
| `01-plugin-activation.spec.ts` | 9 | ✅ | Both plugins active, menu links exist, no PHP fatal |
| `02-settings-page.spec.ts` | 97 | ✅ | All 7 tabs visible, all 8 social platform cards/templates present |
| `03-calendar.spec.ts` | 14 | ✅ | Calendar renders, toolbar works, month navigation works |
| `04-schedule-post.spec.ts` | 7 | ✅ | Create post → status=future → appears in admin list + calendar |
| `05-pro-features.spec.ts` | 12 | ✅ | PRO meta fields exist, License/Scheduling Hub tabs load, missed-schedule cron registered |

**Characteristic:** Read-only + WP-CLI verification. Nothing is saved through the UI. No flows completed end-to-end.

### What each spec covers

**`01-plugin-activation.spec.ts`** ✅
- Free + PRO plugin rows visible in Plugins list
- Both plugins show "Active" status
- SchedulePress top-level menu + Calendar sub-menu appear in sidebar
- Settings page loads without PHP fatal errors
- WP-CLI confirms both slugs are active

**`02-settings-page.spec.ts`** ✅
- Settings page: HTTP 200, branding, wp-admin chrome
- General tab: all field labels present (Dashboard Widget, Admin Bar, Post Types, Taxonomy, Categories, Users, Republish/Unpublish, Enhanced Publishing)
- Email Notify tab: section heading + Under Review + Scheduled toggle labels
- Social Profile tab: all 8 platform cards rendered, names visible, Add New button, description text, React-Select dropdowns (Facebook + LinkedIn)
- Social Templates tab: all 8 platform sub-tabs, template_structure input scoped per platform, placeholder tokens
- Scheduling Hub: Auto Scheduler, Manual Scheduler, Manage Schedule accessible after clicking Hub
- License tab: present in sidebar, loads without errors

**`03-calendar.spec.ts`** ✅
- Calendar page: HTTP 200, no PHP fatal, wp-admin chrome intact
- FullCalendar root (.fc) renders, day-grid cells present
- Custom WPSP toolbar (NOT native FC toolbar): visible, month title has 4-digit year
- Prev/Next/Today buttons visible and enabled
- Month navigation: clicking next changes title; today restores current month

**`04-schedule-post.spec.ts`** ✅
- Create post via WP-CLI with future date
- WP-CLI confirms status=future + correct title
- Post appears in wp-admin Posts > Scheduled list with "Scheduled" label
- REST API (cookie+nonce auth) returns status=future
- Unauthenticated request cannot access the post before publish
- Post event dot appears on the correct calendar day cell

**`05-pro-features.spec.ts`** ✅
- PRO Settings tabs: License and Manage Schedule present
- License tab loads without errors
- PRO meta fields via WP-CLI: `_wpscppro_unpublish_date`, `_wpscppro_republish_date`, `_wpscppro_advance_schedule`
- Meta accessible via REST API (cookie+nonce auth)
- Missed-schedule: setting stored in `wpsp_settings_v5` option
- Past-dated post triggers cron handling
- Social meta: `_wpscppro_social_skip`, `_wpscppro_selected_social_profile`

---

## TIER 02 — MEDIUM ✅ Complete `85 pass / 1 intentional skip`

> **Goal:** Interact with the UI, save settings, and verify persistence. Single-feature flows completed through the browser.

| Spec | Tests | Status | What it proves |
|---|---|---|---|
| `06-post-metabox.spec.ts` | ~30 | ✅ | Gutenberg Schedule And Share panel opens, date picker, social items, action buttons |
| `07-settings-save.spec.ts` | 9 | ✅ | Settings persist after React save: Dashboard Widget, Admin Bar, Email Notify, Social Templates |
| `08-scheduling-hub.spec.ts` | 15 | ✅ | Scheduling Hub sub-tabs visible, Advanced/Manage/Missed Schedule panels load |
| `09-dashboard-widget.spec.ts` | 11 | ✅ | Widget visible, count correct, collapse/expand, disappears/reappears on toggle |
| `10-admin-bar.spec.ts` | 8 | ✅ | Admin bar item visible, count matches, disappears on toggle |
| `11-calendar-events.spec.ts` | 11 | ✅ | Scheduled post appears as FC event on correct day, event disappears after delete |

**Characteristic:** Browser UI interaction + settings persistence + WP-CLI/REST cross-verification.

### Key technical patterns discovered in Tier 02

- **Gutenberg sidebar panel:** `.components-panel__body.schedulepress-options` — NOT inside the button modal
- **WPSP modal trigger:** `button#wpsp-post-panel-button` → `.wpsp-post-panel-modal`
- **Social accordion items:** `.schedulepress-options .social-accordion-item` (in sidebar, not modal)
- **Multiple Save buttons:** Each settings section has its own; use `page.evaluate()` with `offsetParent !== null` to click the first visible one
- **Settings save helper:**
  ```typescript
  await adminPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button.wprf-submit-button"));
    btns.find((b) => b.offsetParent !== null)?.click();
  });
  await adminPage.waitForTimeout(1500);
  ```
- **jQuery UI date picker:** `input[placeholder="Select date & time"]` is READ-ONLY — use `toBeAttached`, not `toBeEditable`
- **FC events:** Check `.fc-event` textContent (contains time + title), not just `.fc-event-title`
- **Strict mode — two toolbar instances:** Use `.first()` on `button.wpsp-next-button`
- **Dashboard widget collapse state:** Persists across page loads — check `aria-expanded` before asserting `.inside` visibility
- **State contamination:** `07-settings-save` disables Widget + Admin Bar → `09` and `10` use `enableDashboardWidget()` / `enableAdminBar()` in `beforeEach`
- **tsconfig.json:** Must include `"DOM"` in `lib` array for `document`, `HTMLButtonElement`, `window` inside `page.evaluate()`

### What each spec covers

**`06-post-metabox.spec.ts`** ✅
- "Schedule And Share" button visible + labeled correctly
- Modal opens on click, contains `.wpsp-post-panel`
- Close button (×) visible and functional
- "Schedule On" and "Scheduling Options" section headings visible
- Date picker input attached with correct placeholder (read-only jQuery UI widget)
- Scheduling enable/disable toggle (checkbox) attached
- "Disable Social Share" checkbox present + label visible
- 8 social platform accordion items visible in Gutenberg sidebar
- All 8 platform names verified individually (Facebook, Twitter, LinkedIn, Pinterest, Instagram, Medium, Threads, Google Business Profile)
- "Save Changes" button visible + enabled
- "Share Now", "Add Social Message", "Upload Social Banner" buttons visible
- SchedulePress Gutenberg sidebar panel present + labeled
- "Social Share Settings" heading visible in sidebar
- Button present on existing post edit page (skips if no posts)

**`07-settings-save.spec.ts`** ✅
- Dashboard Widget toggle: ON/OFF → Save → reload → state persists
- Admin Bar toggle: ON/OFF → Save → reload → state persists
- Publish Immediately Button toggle → Save → persists
- Email Notify "Under Review" toggle → Save → persists
- Email Notify "Scheduled" toggle → Save → persists
- Facebook template text changed → Save → persists
- Settings stored in `wpsp_settings_v5` DB option (WP-CLI verified)
- Save shows "Settings Saved" success notice

**`08-scheduling-hub.spec.ts`** ✅
- Scheduling Hub nav item visible and active after click
- Advanced Schedule, Manage Schedule, Missed Schedule sub-tabs appear in sidebar
- All three sub-tabs are clickable
- Advanced Schedule panel: no PHP errors, body content non-trivial, at least one settings field
- Manage Schedule panel: no PHP errors, body content non-trivial, nav item visible
- Missed Schedule panel: no PHP errors, body content non-trivial, at least one settings control
- `wpsp_settings_v5` WordPress option exists and is valid JSON

**`09-dashboard-widget.spec.ts`** ✅
- Widget visible on `/wp-admin/` when enabled
- Widget has "Scheduled Posts" title
- Widget body (`.inside`) is rendered (auto-expands if collapsed)
- Widget shows "No post is scheduled" when no posts exist
- Widget shows correct count of scheduled posts
- Widget has collapse/expand toggle button
- Clicking toggle collapses widget body
- Widget shows a scheduled post title after one is created (WP-CLI)
- Widget updates when a scheduled post is deleted
- Widget disappears when toggle disabled in settings, reappears when re-enabled

**`10-admin-bar.spec.ts`** ✅
- WPSP admin bar item present on `/wp-admin/`
- Admin bar item contains "Scheduled Posts" text
- Admin bar shows post count in parentheses
- Sub-menu element present in DOM
- Admin bar count matches WP-CLI scheduled post count
- Admin bar count updates after a post is scheduled (WP-CLI)
- Admin bar item present on WordPress homepage (sitewide)
- Admin bar item disappears when toggle disabled in settings, reappears when re-enabled

**`11-calendar-events.spec.ts`** ✅
- Scheduled post (via WP-CLI `beforeAll`) appears as FC event on calendar
- Event appears in correct day cell (`.fc-daygrid-day[data-date="YYYY-MM-DD"]`)
- Event title (via `.fc-event` textContent) contains post title
- Day cell with event has event CSS class
- Two posts on same day → both events visible
- Event on last day of next month visible after navigating forward
- Event disappears from calendar after post is deleted
- Calendar renders day cells with no events (empty state)
- Calendar grid renders all 7 weekday column headers

---

## TIER 03 — ADVANCED 🔲 Not started `~60 tests`

> **Goal:** Multi-step, cross-feature, stateful end-to-end flows. Simulate real user workflows including PRO republish/unpublish cycles, social queuing, and schedule recovery.

| Spec | Tests | Status | What it will prove |
|---|---|---|---|
| `12-full-schedule-to-publish.spec.ts` | ~12 | 🔲 | Complete scheduling flow: editor → future → cron → publish |
| `13-republish-unpublish.spec.ts` | ~12 | 🔲 | PRO republish/unpublish cycle via cron simulation |
| `14-missed-schedule-recovery.spec.ts` | ~8 | 🔲 | Past-dated post recovery on cron tick |
| `15-social-share-queue.spec.ts` | ~10 | 🔲 | Social share queue on publish, platform selection, manual trigger |
| `16-advanced-schedule.spec.ts` | ~10 | 🔲 | PRO multi-date advance schedule |
| `17-api-security.spec.ts` | ~8 | 🔲 | REST endpoint auth, role boundaries, CSRF protection |

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
✅ Phase 1:   01-plugin-activation    Basic — plugin active, menu renders
✅ Phase 2:   02-settings-page        Basic — all 7 tabs, 8 social platforms, Social Profile tab
✅ Phase 3:   03-calendar             Basic — FC renders, WPSP toolbar, navigation
✅ Phase 4:   04-schedule-post        Basic — WP-CLI schedule + REST + calendar dot
✅ Phase 5:   05-pro-features         Basic — PRO meta, cron, social meta
✅ Phase 6:   06-post-metabox         Medium — Gutenberg Schedule And Share panel
✅ Phase 7:   07-settings-save        Medium — React settings save + DB persistence
✅ Phase 8:   08-scheduling-hub       Medium — Hub sub-tabs + panel content
✅ Phase 9:   09-dashboard-widget     Medium — widget toggle, count, collapse
✅ Phase 10:  10-admin-bar            Medium — admin bar toggle, count, sitewide
✅ Phase 11:  11-calendar-events      Medium — event rendering, day cell, delete
🔲 Phase 12:  12-full-schedule        Advanced — editor → future → cron → publish
🔲 Phase 13:  13-republish-unpublish  Advanced — PRO republish/unpublish cron cycle
🔲 Phase 14:  14-missed-schedule      Advanced — past-dated recovery
🔲 Phase 15:  15-social-share-queue   Advanced — social queue on publish
🔲 Phase 16:  16-advanced-schedule    Advanced — PRO multi-date schedule
🔲 Phase 17:  17-api-security         Advanced — REST auth, role boundaries, CSRF
```

---

## Key Technical Patterns (carry forward)

- **Auth:** Cookie session + `X-WP-Nonce` via `adminPage.evaluate()` — NOT Basic Auth
- **REST URL:** `/?rest_route=/wp/v2/posts/ID` (plain permalinks) — NOT `/wp-json/`
- **WP-CLI:** `docker run --rm --network ... wordpress:cli-php8.2` — NOT `docker-compose exec`
- **Navigation:** `waitUntil: "domcontentloaded"` — NOT `"networkidle"`
- **Settings nav:** `li.wprf-tab-nav-item[data-key="layout_*"]`
- **Save button (multiple per page):** `page.evaluate()` with `offsetParent !== null` to find first visible
- **tsconfig.json:** Must include `"DOM"` in lib for `document`/`HTMLButtonElement` inside `page.evaluate()`
- **Social Templates input:** `input[name='template_structure']` scoped by parent platform
- **Social Profile wrappers:** `.wprf-{slug}_profile_list-social-profile`
- **Calendar toolbar:** `.wpsp-calender-content .toolbar` (custom WPSP, not FC native `.fc-header-toolbar`)
- **FC events:** Check `.fc-event` `textContent()` (time + title), not just `.fc-event-title`
- **Gutenberg sidebar:** `.components-panel__body.schedulepress-options` — social accordion items here, NOT in modal
- **WPSP modal:** `button#wpsp-post-panel-button` → `.wpsp-post-panel-modal`
- **jQuery UI date picker:** `input[placeholder="Select date & time"]` is READ-ONLY — use `toBeAttached`
- **Strict mode — duplicated elements:** Use `.first()` (e.g., `button.wpsp-next-button`, save buttons)
- **State contamination:** `beforeEach` helpers to restore toggles disabled by earlier tests
- **Dashboard widget collapse:** Persists across page loads — check `aria-expanded` before asserting `.inside`
- **No hard waits:** use `waitFor`, `toBeVisible`, `toContainText` with explicit timeouts
