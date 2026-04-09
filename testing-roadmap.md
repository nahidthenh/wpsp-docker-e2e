# SchedulePress E2E Testing Roadmap

## Progress Summary

| Tier | Spec files | Tests | Status |
|---|---|---|---|
| 01-Basic | 5 | 131 | ✅ Complete |
| 02-Medium | 6 | 85 pass / 1 skip | ✅ Complete |
| 03-Advanced | 5 of 6 | ~50 implemented | ✅ Mostly complete |
| 04-New | 3 planned | ~20 planned | 🔄 In progress |
| **Total** | **16** | **~286** | |

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

---

## TIER 03 — ADVANCED ✅ Mostly complete `~50 tests`

> **Goal:** Multi-step, cross-feature, stateful end-to-end flows. Simulate real user workflows including PRO republish/unpublish cycles and schedule recovery.

| Spec | Tests | Status | What it proves |
|---|---|---|---|
| `12-full-schedule-to-publish.spec.ts` | ~11 | ✅ | Complete scheduling flow: WP-CLI → future → cron → publish → REST + calendar verified |
| `13-republish-unpublish.spec.ts` | 9 (1 skip) | ✅ | PRO republish/unpublish cron cycle — timing-sensitive, 45s window |
| `14-missed-schedule-recovery.spec.ts` | ~8 | ✅ | Past-dated post recovery on cron tick, idempotency, batch recovery |
| `15-social-share-queue.spec.ts` | — | ❌ Skipped | Requires live OAuth tokens — not automatable in Docker |
| `16-advanced-schedule.spec.ts` | ~8 | ✅ | PRO multi-date advance schedule meta + Gutenberg panel |
| `17-api-security.spec.ts` | ~11 | ✅ | REST auth, role boundaries (subscriber blocked), nonce protection, no data leak |

### Key technical patterns discovered in Tier 03

- **Cron chain timing (republish/unpublish):** `wpsp_pro_update_post` schedules at `time()+20`; debounce blocks `set_cron_for_unpublish_republish` for 10s → need `sleep(22)` before first cron run, `sleep(15)` before second
- **`CRON_DATE_SECONDS = 45`:** Minimum safe window for the full cron chain to execute
- **WP-Cron simulation:** `wp cron event run --due-now` via `runWpCron()` helper
- **`sleep()` helper:** Calls `execSync("sleep N")` — blocks the Node process (intentional for cron tests)
- **REST nonce:** Retrieved via `adminPage.evaluate(() => window.wpApiSettings?.nonce)` inside authenticated browser context
- **`gmt_offset = 0`:** WordPress instance runs UTC — no timezone adjustment needed in cron timing tests

### What each spec covers

**`12-full-schedule-to-publish.spec.ts`** ✅
- Post created with future date → status=future via WP-CLI
- Appears in wp-admin Scheduled list
- REST API returns status=future (authenticated)
- Unauthenticated request blocked before publish
- Cron tick → post publishes → status=publish
- Published post appears in Published list, not Scheduled list
- Published post publicly accessible via REST
- Calendar event removed after publish
- Two posts scheduled same time → both publish on one cron tick
- Post with future date > 1 year schedules correctly
- Rescheduling a published post resets it to future

**`13-republish-unpublish.spec.ts`** ✅ (1 intentional skip)
- Republish meta `_wpscp_schedule_republish_date` set via WP-CLI
- Unpublish meta `_wpscp_schedule_draft_date` set via WP-CLI
- Draft does NOT republish before republish date
- Cron unpublishes a post when unpublish date is past-due
- Published post stays published before unpublish date
- Full cycle: publish → cron unpublish → cron republish
- Republish date meta readable via REST (authenticated)
- Republish without unpublish — post stays published after republish cron

**`14-missed-schedule-recovery.spec.ts`** ✅
- Past-scheduled post recognised as status=future by WordPress
- Missed post publishes after cron tick
- Multiple missed posts all recover in one cron run
- Cron does not re-publish an already-published post (idempotent)
- `wpsp_settings_v5` option is present and valid JSON
- Missed Schedule tab visible in Scheduling Hub
- Missed Schedule panel loads without PHP errors
- Future post does not publish prematurely when cron runs

**`15-social-share-queue.spec.ts`** ❌ Permanently skipped
- Requires real OAuth tokens for Facebook, Twitter, LinkedIn etc.
- Live API calls cannot be reliably mocked in Docker
- Cover via manual pre-release checklist instead

**`16-advanced-schedule.spec.ts`** ✅
- `_wpscppro_advance_schedule` meta set/read/deleted via WP-CLI
- Meta survives a post update
- Advanced Schedule sub-tab visible in Scheduling Hub
- Panel loads without PHP errors
- Panel has at least one settings control
- Gutenberg sidebar panel visible in block editor
- "Schedule And Share" button present in block editor

**`17-api-security.spec.ts`** ✅
- Unauthenticated request for scheduled post returns 401
- Unauthenticated request for draft post returns 401
- Unauthenticated posts list does not include future posts
- Admin can read scheduled post via REST (with nonce)
- Admin can read draft post via REST (with nonce)
- Admin can update post meta via REST (with nonce)
- REST request with forged nonce cannot update a post
- REST write request with no nonce and no auth rejected
- Subscriber cannot edit posts — redirected to dashboard
- Settings page returns 200 for admin
- Settings page redirects unauthenticated users to login

---

## TIER 04 — NEW ADDITIONS 🔲 Not started `~20 tests`

> **Goal:** Cover the gaps identified in checklist review. High ROI tests that catch real regressions and are feasible in Docker without OAuth or third-party dependencies.

| Spec | Tests | Priority | What it proves |
|---|---|---|---|
| `18-user-roles.spec.ts` | 11 | ✅ Done | Role-based access to scheduling, calendar, and social options |
| `19-timezone.spec.ts` | 7 | ✅ Done | Posts publish at correct UTC time with offset and location-based timezone |
| `20-post-type-scheduling.spec.ts` | ~6 | 🟡 Medium | Scheduling works for post/page/custom post types per settings |

### `18-user-roles.spec.ts` (~8 tests)

**Why:** Role bugs are common and invisible during manual testing. `testauthor` user already exists in setup — low implementation cost.

| # | Test | Verify |
|---|---|---|
| 1 | Author can schedule a post (future date via WP-CLI) | Status = future, WP-CLI confirms |
| 2 | Author can see their own scheduled posts in admin list | List filtered correctly |
| 3 | Author cannot see other users' scheduled posts | Access scoped correctly |
| 4 | Subscriber cannot access `/wp-admin/edit.php` | Redirected to dashboard |
| 5 | Subscriber cannot access SchedulePress settings page | Redirected or 403 |
| 6 | Subscriber cannot access SchedulePress calendar page | Redirected or 403 |
| 7 | Editor can schedule any post type | Scheduling not blocked |
| 8 | Editor can view the SchedulePress calendar | Calendar renders for editor |

### `19-timezone.spec.ts` (~5 tests)

**Why:** Timezone bugs cause posts to publish at completely wrong times — high-impact silent failures that are easy to miss manually.

| # | Test | Verify |
|---|---|---|
| 1 | WordPress set to UTC+0 — post scheduled at T+60s publishes on cron | Published within expected window |
| 2 | WordPress set to UTC+6 — post scheduled at local T+60s publishes at correct UTC time | UTC conversion correct |
| 3 | WordPress set to UTC-5 — negative offset handled correctly | No early/late publish |
| 4 | Calendar shows event on correct day for non-UTC timezone | Day cell matches local date, not UTC date |
| 5 | Restore UTC+0 setting — subsequent tests not affected | Teardown resets offset |

### `20-post-type-scheduling.spec.ts` (~6 tests)

**Why:** "Show Post Types" is a settings field. If a post type is disabled, scheduling UI should not appear. Easy to break silently.

| # | Test | Verify |
|---|---|---|
| 1 | Scheduling a `post` via WP-CLI → status=future | Core post type works |
| 2 | Scheduling a `page` via WP-CLI → status=future | Page scheduling works |
| 3 | SchedulePress Gutenberg panel visible on `post` edit screen | Panel renders for posts |
| 4 | SchedulePress Gutenberg panel visible on `page` edit screen | Panel renders for pages |
| 5 | Disabling `page` in Post Types setting → panel hidden on page editor | Setting respected |
| 6 | Re-enabling `page` in Post Types setting → panel reappears | Toggle restores correctly |

---

## What We Are NOT Implementing (and Why)

| Checklist Item | Decision | Reason |
|---|---|---|
| Calendar drag & drop | ❌ Skip | Flaky by nature — mouse coordinates + animation timing + FullCalendar internals = very high maintenance, low signal |
| Calendar quick edit | ❌ Skip | Fragile UI interaction; covered implicitly by `11-calendar-events` event rendering tests |
| Elementor scheduling / republish / advanced | ❌ Skip | Same PHP hooks as Gutenberg — logic already tested via WP-CLI. Adding Elementor means testing Elementor's UI, not our plugin |
| Social OAuth connection | ❌ Skip | Requires real live tokens. Cannot be mocked reliably. Manual pre-release checklist only |
| Actual social post sharing | ❌ Skip | Requires live API calls + connected accounts. Impossible in Docker |
| License key activation | ❌ Skip | Tab loads — already tested. Real key validation requires a live license server |
| Settings after plugin update | ❌ Skip | Requires installing old version → update to new. Complex Docker versioning for minimal automated value — make it a manual release gate |
| Toolset / Divi / Classic Editor compat | ❌ Skip | Third-party plugin compatibility. Testing their UI is their responsibility. Manual smoke test before release |

---

## Implementation Order

```
✅ Phase 1:   01-plugin-activation         Basic — plugin active, menu renders
✅ Phase 2:   02-settings-page             Basic — all 7 tabs, 8 social platforms, Social Profile tab
✅ Phase 3:   03-calendar                  Basic — FC renders, WPSP toolbar, navigation
✅ Phase 4:   04-schedule-post             Basic — WP-CLI schedule + REST + calendar dot
✅ Phase 5:   05-pro-features              Basic — PRO meta, cron, social meta
✅ Phase 6:   06-post-metabox              Medium — Gutenberg Schedule And Share panel
✅ Phase 7:   07-settings-save             Medium — React settings save + DB persistence
✅ Phase 8:   08-scheduling-hub            Medium — Hub sub-tabs + panel content
✅ Phase 9:   09-dashboard-widget          Medium — widget toggle, count, collapse
✅ Phase 10:  10-admin-bar                 Medium — admin bar toggle, count, sitewide
✅ Phase 11:  11-calendar-events           Medium — event rendering, day cell, delete
✅ Phase 12:  12-full-schedule-to-publish  Advanced — WP-CLI → future → cron → publish → REST
✅ Phase 13:  13-republish-unpublish       Advanced — PRO republish/unpublish cron cycle
✅ Phase 14:  14-missed-schedule-recovery  Advanced — past-dated recovery, idempotency
❌ Phase 15:  15-social-share-queue        Advanced — SKIPPED (requires OAuth)
✅ Phase 16:  16-advanced-schedule         Advanced — PRO multi-date schedule meta + Gutenberg
✅ Phase 17:  17-api-security              Advanced — REST auth, role boundaries, nonce protection
✅ Phase 18:  18-user-roles               New — role-based scheduling + calendar access
✅ Phase 19:  19-timezone                 New — UTC offset and location-based scheduling accuracy
🔲 Phase 20:  20-post-type-scheduling     New — post/page/custom type scheduling per settings
```

---

## Manual Release Checklist (not automatable)

These items should be verified manually before each release:

- Social profile OAuth connection flows (Facebook, Twitter, LinkedIn, Pinterest, Instagram, Medium, Threads, Google Business Profile)
- Posts actually sharing on connected profiles/pages/boards
- License key activation and deactivation
- Elementor scheduling, republish/unpublish, and advanced scheduling UI
- Calendar drag & drop and quick edit
- Toolset plugin + Divi theme + Classic Editor compatibility
- Settings preserved after plugin update (free → free, pro → pro)

---

## Key Technical Patterns (carry forward to all new specs)

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
- **Cron timing:** `sleep(22)` before first cron run, `sleep(15)` before second — see `13-republish-unpublish`
- **No hard waits:** use `waitFor`, `toBeVisible`, `toContainText` with explicit timeouts
- **Gutenberg Welcome Guide:** Disabled via `wp_persisted_preferences` user meta in `wp-setup.sh` — `dismissWelcomeGuide()` remains as safety net with 5s `waitFor`
