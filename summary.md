# SchedulePress E2E — Test Summary

## What the Automation Covers

### 01-basic — Plugin health and UI surfaces
| File | What we verify |
|---|---|
| `01-plugin-activation` | Free + PRO plugins are installed, active, and menus appear in wp-admin |
| `02-settings-page` | All 7 settings tabs load; all 8 social platform cards and template inputs are present |
| `03-calendar` | Calendar page renders with a working Prev / Next / Today toolbar |
| `04-schedule-post` | Create a scheduled post → verify status, admin list, REST API, calendar dot |
| `05-pro-features` | PRO meta fields exist; License and Manage Schedule tabs load; missed-schedule cron registered |

### 02-medium — UI interaction and settings persistence
| File | What we verify |
|---|---|
| `06-post-metabox` | "Schedule And Share" modal opens/closes; date picker, social checkboxes, and action buttons all visible |
| `07-settings-save` | Toggle changes persist after save + page reload (Dashboard Widget, Admin Bar, Email Notify, Social Templates) |
| `08-scheduling-hub` | Scheduling Hub sub-tabs (Advanced, Manage, Missed) appear and load without errors |
| `09-dashboard-widget` | Widget shows correct scheduled-post count; hides/reappears when toggled in Settings |
| `10-admin-bar` | Admin bar item shows correct post count; disappears/reappears when toggled in Settings |
| `11-calendar-events` | Scheduled posts appear as events on the correct calendar day; deleted posts disappear |

### 03-advanced — Full end-to-end flows
| File | What we verify |
|---|---|
| `12-full-schedule-to-publish` | Complete flow: WP-CLI schedule → cron fires → post publishes → appears in Published list |
| `13-republish-unpublish` | PRO republish/unpublish cycle: dates set via WP-CLI, cron changes status correctly |
| `14-missed-schedule-recovery` | Past-dated posts are recovered and published on the next cron tick |
| `15-social-share-queue` | **Skipped** — requires live OAuth tokens (see manual checklist below) |
| `16-advanced-schedule` | PRO multi-date advance schedule meta is writable; Advanced Schedule tab renders |
| `17-api-security` | Unauthenticated/forged requests are blocked; subscriber cannot edit or access settings |
| `18-user-roles` | Author sees only their own posts; subscriber is blocked from editor/settings/calendar; editor has full access |
| `19-timezone` | Posts publish at the correct UTC time across UTC+0, UTC+6, UTC-5, and named timezones |
| `20-post-type-scheduling` | Posts and pages schedule correctly; WPSP panel hides/shows based on the Post Types setting |

---

## What Is NOT Automated (and Why)

| Area | Reason skipped |
|---|---|
| Social OAuth connection flows | Requires real live tokens — cannot be mocked in Docker |
| Actual social post sharing | Requires connected accounts and live API calls |
| Calendar drag & drop / quick edit | Extremely flaky — mouse coordinates + animation + FullCalendar internals |
| Elementor scheduling UI | Tests Elementor's UI, not our plugin logic (hooks already tested via WP-CLI) |
| License key activation | Requires a live license validation server |
| Settings after plugin update | Requires installing an old version then upgrading — complex Docker setup for low automated value |
| Toolset / Divi / Classic Editor compat | Third-party compatibility — manual smoke test only |

---

## Manual Checklist — Before Any Release or Big Fix

Run through these manually before tagging a release or shipping a significant change.

### Social Sharing
- [ ] Connect a Facebook Page / Group and send a test share
- [ ] Connect a Twitter / X account and send a test share
- [ ] Connect a LinkedIn Page / Profile and send a test share
- [ ] Connect Pinterest, Instagram, Medium, Threads, Google Business Profile
- [ ] Verify that disabling a profile in Social Settings stops shares to that profile
- [ ] Verify the "Share Now" button from the post editor actually posts immediately
- [ ] Verify the "Disable Social Share" checkbox prevents any share on publish

### Scheduling Core
- [ ] Schedule a post from the Gutenberg editor (using the date picker in the modal)
- [ ] Verify the post appears on the calendar on the correct day
- [ ] Let WP-Cron fire naturally (or trigger it) and confirm the post publishes
- [ ] Schedule a post in the past and confirm missed-schedule recovery kicks in

### PRO Features
- [ ] Set a republish date on a draft — confirm it goes back to published on time
- [ ] Set an unpublish date on a published post — confirm it moves to draft on time
- [ ] Set up an advance schedule (multi-date) and verify each date fires in order
- [ ] Activate and deactivate the license key on the License tab

### Post Types and Settings
- [ ] Disable a post type (e.g. Page) in General Settings → confirm WPSP panel disappears on page editor
- [ ] Re-enable it → confirm panel reappears
- [ ] Toggle Dashboard Widget and Admin Bar off/on and verify the UI reflects the change

### Compatibility
- [ ] Open a post in Elementor and verify the SchedulePress scheduling options appear
- [ ] Test republish and advanced schedule inside Elementor
- [ ] Activate Classic Editor plugin and verify scheduling still works
- [ ] Test with Toolset / Divi if those are supported on the release target

### Plugin Update
- [ ] Install the previous release version, configure some settings and social profiles
- [ ] Update to the new version and confirm all settings are preserved
- [ ] Confirm no PHP errors or broken UI after the update

### Cross-Browser
- [ ] Smoke test the calendar, post panel modal, and settings page in Firefox and Safari

---

## Quick Stats

| Tier | Spec files | Approximate tests |
|---|---|---|
| 01-basic | 5 | ~131 |
| 02-medium | 6 | ~86 |
| 03-advanced | 8 (1 skipped) | ~50 |
| **Total** | **19 active** | **~267** |
