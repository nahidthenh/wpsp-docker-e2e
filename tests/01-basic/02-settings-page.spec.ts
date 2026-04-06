/**
 * 02-settings-page.spec.ts
 *
 * Verifies the SchedulePress Settings page (admin.php?page=schedulepress).
 *
 * Left-nav structure (confirmed from live DOM — li.wprf-tab-nav-item[data-key]):
 *   data-key="layout_general"          → General tab
 *   data-key="layout_calendar"         → Calendar tab
 *   data-key="layout_email_notify"     → Email Notify tab
 *   data-key="layout_social_profile"   → Social Profile tab
 *   data-key="layout_social_template"  → Social Templates tab
 *   data-key="layout_scheduling_hub"   → Scheduling Hub tab (PRO)
 *   data-key="layout_license"          → License tab (PRO)
 *
 * Social Templates sub-tabs (data-key="layouts_*"):
 *   layouts_facebook, layouts_twitter, layouts_linkedin, layouts_pinterest,
 *   layouts_instagram, layouts_medium, layouts_threads, layouts_google_business
 */

import { test, expect } from "../../fixtures/base-fixture";
import { SCHEDULE_PRESS } from "../../utils/selectors";

test.describe("SchedulePress Settings Page", () => {

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
  });

  // ── Page-level checks ────────────────────────────────────────────────────

  test("settings page returns HTTP 200", async ({ adminPage }) => {
    const res = await adminPage.goto(SCHEDULE_PRESS.urls.settings);
    expect(res?.status()).toBe(200);
  });

  test("settings page contains SchedulePress branding", async ({ adminPage }) => {
    const body = await adminPage.locator("body").textContent() ?? "";
    expect(body.toLowerCase()).toContain("schedulepress");
  });

  test("wp-admin chrome renders correctly on settings page", async ({ adminPage }) => {
    await expect(adminPage.locator("#wpadminbar")).toBeVisible();
    await expect(adminPage.locator("#adminmenu")).toBeVisible();
    await expect(adminPage.locator("#wpbody")).toBeVisible();
  });

  // ── Free-plugin tabs (registered in free plugin Menu.php) ───────────────

  test("Social Profiles tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Social Profile$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Settings tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Settings$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("Calendar tab is visible", async ({ adminPage }) => {
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Calendar$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  // ── Scheduling Hub and its nested tabs ──────────────────────────────────
  // Auto Scheduler and Manual Scheduler live INSIDE the "Scheduling Hub" tab.
  // We must click the Hub first to expand it before the sub-content appears.

  test("Scheduling Hub tab is visible in sidebar", async ({ adminPage }) => {
    const hub = adminPage.locator("a, button, li, span").filter({ hasText: /^Scheduling Hub$/i }).first();
    await expect(hub).toBeVisible({ timeout: 15_000 });
  });

  test("Auto Scheduler content is visible after opening Scheduling Hub", async ({ adminPage }) => {
    // Open Scheduling Hub
    const hub = adminPage.locator("a, button, li, span").filter({ hasText: /^Scheduling Hub$/i }).first();
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await hub.click();

    await adminPage.getByText('Manage Schedule').click();

    // Auto Scheduler section/toggle should appear in the panel
    const autoTab = adminPage.locator("a, button, li, span, h2, h3, label").filter({ hasText: /Auto.?Sched/i }).first();
    await expect(autoTab).toBeVisible({ timeout: 15_000 });
  });

  test("Manual Scheduler content is visible after opening Scheduling Hub", async ({ adminPage }) => {
    // Open Scheduling Hub
    const hub = adminPage.locator("a, button, li, span").filter({ hasText: /^Scheduling Hub$/i }).first();
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await hub.click();

    await adminPage.getByText('Manage Schedule').click();

    // Manual Scheduler section/toggle should appear in the panel
    const manualTab = adminPage.locator("a, button, li, span, h2, h3, label").filter({ hasText: /Manual.?Sched/i }).first();
    await expect(manualTab).toBeVisible({ timeout: 15_000 });
  });

  // ── PRO-only tabs ────────────────────────────────────────────────────────

  test("Manage Schedule tab is visible after opening Scheduling Hub (PRO)", async ({ adminPage }) => {
    // "Manage Schedule" is the default active sub-tab inside Scheduling Hub
    const hub = adminPage.locator("a, button, li, span").filter({ hasText: /^Scheduling Hub$/i }).first();
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await hub.click();

    const tab = adminPage.locator("a, button, li, span, h2, h3").filter({ hasText: /Manage.?Schedule/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  test("License tab is visible in sidebar (PRO)", async ({ adminPage }) => {
    // License is a top-level PRO sidebar tab — directly visible without clicking Hub
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^License$/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  });

  // ── Social platform icons / labels ──────────────────────────────────────

  test("Social Profiles tab shows social platform options", async ({ adminPage }) => {
    // Click the Social Profiles tab
    const tab = adminPage.locator("a, button, li, span").filter({ hasText: /^Social Profile$/i }).first();
    if (await tab.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await tab.click();
    }
    // At least one social platform should appear (Facebook, Twitter, etc.)
    const body = await adminPage.locator("#wpbody").textContent() ?? "";
    const hasSocial = /facebook|twitter|linkedin|instagram/i.test(body);
    expect(hasSocial).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// General Tab
// Selector: li.wprf-tab-nav-item[data-key="layout_general"]
// Fields verified from live DOM inspection:
//   toggles: Dashboard Widget, Sitewide Admin Bar, Admin Bar
//   multi-selects: Post Types, Taxonomy as Tags, Categories, Users
//   text: Admin Bar item template, Title length, Date format
//   toggles: Publish Now button, Elementor, Post Republish/Unpublish,
//            Republish Social Share, Future Date on Publish, Auto-Share on Publish
//   section: Email Notify (notify on review / rejected / scheduled / published)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Settings – General Tab", () => {
  const NAV_SELECTOR = 'li.wprf-tab-nav-item[data-key="layout_general"]';

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    // Click the General tab nav item
    await adminPage.locator(NAV_SELECTOR).click();
    await adminPage.waitForTimeout(500);
  });

  // ── Section heading ────────────────────────────────────────────────────

  test("General Settings section heading is present", async ({ adminPage }) => {
    const heading = adminPage.locator(".wprf-section-title, h2, h3")
      .filter({ hasText: /General Settings/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── Dashboard / Admin Bar visibility toggles ───────────────────────────

  test("'Show Scheduled Posts in Dashboard Widget' toggle is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Dashboard Widget/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("'Show Scheduled Posts in Sitewide Admin Bar' toggle is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Sitewide Admin Bar/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("'Show Scheduled Posts in Admin Bar' toggle is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Show Scheduled Posts in Admin Bar/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  // ── Post type / taxonomy selects ───────────────────────────────────────

  test("'Show Post Types' field is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Show Post Types/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("'Allow Taxonomy as Tags' field is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Taxonomy as Tags/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("'Show Categories' field is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Show Categories/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("'Allow users' field is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Allow users/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  // ── Admin Bar item template ────────────────────────────────────────────

  test("Admin Bar item template section is present", async ({ adminPage }) => {
    const section = adminPage.locator(".wprf-section-title, .wprf-field-label, label")
      .filter({ hasText: /Custom item template/i }).first();
    await expect(section).toBeVisible({ timeout: 10_000 });
  });

  // ── Publishing options (PRO toggles) ──────────────────────────────────

  test("'Post Republish and Unpublish' toggle label is present (PRO)", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Post Republish and Unpublish/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("'Show Publish Post Immediately Button' toggle label is present", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Show Publish Post Immediately Button/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("Enhanced Post Publishing section heading is present", async ({ adminPage }) => {
    const heading = adminPage.locator(".wprf-section-title, .wprf-field-label")
      .filter({ hasText: /Enhanced Post Publishing/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── Email Notify tab link ──────────────────────────────────────────────
  // Email Notify is a separate left-nav tab (data-key="layout_email_notify"),
  // not a nested section inside General. Just verify its nav item is present.

  test("Email Notify tab nav item is present in sidebar", async ({ adminPage }) => {
    const navItem = adminPage.locator('li.wprf-tab-nav-item[data-key="layout_email_notify"]');
    await expect(navItem).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Social Profile Tab
// Selector: li.wprf-tab-nav-item[data-key="layout_social_profile"]
//
// DOM structure (confirmed by live inspection):
//   .wprf-tab-content.wprf-tab-layout_social_profile.wprf-active
//     .wprf-section-title            → "Social Profile"
//     .wprf-control.wprf-social-profile.wprf-{platform}_profile_list-social-profile  (×8)
//       .social-profile-card
//         .main-profile              → platform name + description text
//         .social-media-type-select  → React-Select (Facebook / LinkedIn only)
//         button.wpscp-social-tab__btn--addnew-profile  → "Add New"
//
// Platforms (8): facebook, twitter, linkedin, pinterest,
//                instagram, medium, threads, google_business_profile
// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Settings – Social Profile Tab", () => {
  const NAV_SELECTOR = 'li.wprf-tab-nav-item[data-key="layout_social_profile"]';
  const PANEL_SELECTOR = ".wprf-tab-layout_social_profile";

  /** Selector for an individual platform's wrapper div. */
  const platformWrapper = (slug: string) =>
    `.wprf-${slug}_profile_list-social-profile`;

  const platforms = [
    { slug: "facebook", label: "Facebook" },
    { slug: "twitter", label: "Twitter" },
    { slug: "linkedin", label: "LinkedIn" },
    { slug: "pinterest", label: "Pinterest" },
    { slug: "instagram", label: "Instagram" },
    { slug: "medium", label: "Medium" },
    { slug: "threads", label: "Threads" },
    { slug: "google_business", label: "Google Business Profile" },
  ];

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV_SELECTOR).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(NAV_SELECTOR).click();
    await adminPage.waitForTimeout(600);
  });

  // ── Tab navigation ─────────────────────────────────────────────────────

  test("Social Profile tab nav item is visible and clickable", async ({ adminPage }) => {
    await expect(adminPage.locator(NAV_SELECTOR)).toBeVisible({ timeout: 10_000 });
  });

  test("Social Profile panel becomes active after clicking tab", async ({ adminPage }) => {
    await expect(adminPage.locator(PANEL_SELECTOR)).toBeVisible({ timeout: 10_000 });
  });

  // ── Panel heading ──────────────────────────────────────────────────────

  test("'Social Profile' section heading is visible", async ({ adminPage }) => {
    const heading = adminPage.locator(".wprf-section-title")
      .filter({ hasText: /^Social Profile$/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── Platform card count ────────────────────────────────────────────────

  test("panel contains exactly 8 platform cards", async ({ adminPage }) => {
    const cards = adminPage.locator(`${PANEL_SELECTOR} .social-profile-card`);
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    expect(await cards.count()).toBe(8);
  });

  // ── Per-platform card visibility ───────────────────────────────────────

  for (const { slug, label } of platforms) {
    test(`${label} platform card is rendered`, async ({ adminPage }) => {
      const card = adminPage.locator(platformWrapper(slug)).locator(".social-profile-card");
      await expect(card).toBeVisible({ timeout: 10_000 });
    });
  }

  // ── Platform name text inside each card ───────────────────────────────

  for (const { slug, label } of platforms) {
    test(`${label} card shows platform name`, async ({ adminPage }) => {
      const card = adminPage.locator(platformWrapper(slug));
      await expect(card).toContainText(label, { timeout: 10_000 });
    });
  }

  // ── "Add New" button per platform ─────────────────────────────────────

  for (const { slug, label } of platforms) {
    test(`${label} card has an 'Add New' button`, async ({ adminPage }) => {
      // Most platforms use button.wpscp-social-tab__btn--addnew-profile;
      // Google Business Profile renders a classless button — match by text instead.
      const btn = adminPage
        .locator(platformWrapper(slug))
        .locator("button", { hasText: /^Add New$/i });
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await expect(btn).toBeEnabled();
    });
  }

  // ── Description text ──────────────────────────────────────────────────

  for (const { slug, label } of platforms) {
    test(`${label} card shows enable/disable description`, async ({ adminPage }) => {
      const card = adminPage.locator(platformWrapper(slug));
      await expect(card).toContainText(/You can enable\/disable/i, { timeout: 10_000 });
    });
  }

  // ── React-Select type dropdown (Facebook & LinkedIn only) ──────────────

  test("Facebook card has a profile-type select dropdown", async ({ adminPage }) => {
    const select = adminPage
      .locator(platformWrapper("facebook"))
      .locator(".social-media-type-select__control");
    await expect(select).toBeVisible({ timeout: 10_000 });
  });

  test("LinkedIn card has a profile-type select dropdown", async ({ adminPage }) => {
    const select = adminPage
      .locator(platformWrapper("linkedin"))
      .locator(".social-media-type-select__control");
    await expect(select).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Email Notify Tab
// Selector: li.wprf-tab-nav-item[data-key="layout_email_notify"]
// Fields: Under Review, Rejected, Scheduled, Published notification toggles
// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Settings – Email Notify Tab", () => {
  const NAV_SELECTOR = 'li.wprf-tab-nav-item[data-key="layout_email_notify"]';

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV_SELECTOR).waitFor({ state: "visible", timeout: 10_000 });
    await adminPage.locator(NAV_SELECTOR).click();
    await adminPage.waitForTimeout(500);
  });

  test("Email Notify tab is present and clickable", async ({ adminPage }) => {
    await expect(adminPage.locator(NAV_SELECTOR)).toBeVisible({ timeout: 10_000 });
  });

  test("Email Notify section heading is visible in panel", async ({ adminPage }) => {
    const heading = adminPage.locator(".wprf-section-title")
      .filter({ hasText: /Email Notify/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("'Under Review' notification toggle label is visible", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /Under Review/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });

  test("'Notify User when post is Scheduled' toggle label is visible", async ({ adminPage }) => {
    const label = adminPage.locator(".wprf-field-label, label")
      .filter({ hasText: /post is.*Scheduled/i }).first();
    await expect(label).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Social Templates Tab
// Selector: li.wprf-tab-nav-item[data-key="layout_social_template"]
// Sub-platform tabs (data-key="layouts_*"):
//   layouts_facebook | layouts_twitter | layouts_linkedin | layouts_pinterest
//   layouts_instagram | layouts_medium | layouts_threads | layouts_google_business
// Key field: input[name="template_structure"] — the template editor textarea
// ─────────────────────────────────────────────────────────────────────────────

test.describe("SchedulePress Settings – Social Templates Tab", () => {
  const NAV_SELECTOR = 'li.wprf-tab-nav-item[data-key="layout_social_template"]';
  const PLATFORM_SELECTOR = (key: string) => `li.wprf-tab-nav-item[data-key="${key}"]`;

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto(SCHEDULE_PRESS.urls.settings, { waitUntil: "domcontentloaded" });
    await adminPage.locator(NAV_SELECTOR).click();
    await adminPage.waitForTimeout(600);
  });

  // ── Tab navigation ─────────────────────────────────────────────────────

  test("Social Templates tab is present and clickable", async ({ adminPage }) => {
    await expect(adminPage.locator(NAV_SELECTOR)).toBeVisible({ timeout: 10_000 });
  });

  // ── Platform sub-tabs ──────────────────────────────────────────────────

  const platforms = [
    { key: "layouts_facebook", label: "Facebook" },
    { key: "layouts_twitter", label: "Twitter" },
    { key: "layouts_linkedin", label: "LinkedIn" },
    { key: "layouts_pinterest", label: "Pinterest" },
    { key: "layouts_instagram", label: "Instagram" },
    { key: "layouts_medium", label: "Medium" },
    { key: "layouts_threads", label: "Threads" },
    { key: "layouts_google_business", label: "Google Business" },
  ];

  for (const { key, label } of platforms) {
    test(`${label} platform sub-tab is visible`, async ({ adminPage }) => {
      const tab = adminPage.locator(PLATFORM_SELECTOR(key));
      await expect(tab).toBeVisible({ timeout: 10_000 });
    });
  }

  // ── Facebook template panel content ────────────────────────────────────

  test("clicking Facebook sub-tab shows its settings panel", async ({ adminPage }) => {
    await adminPage.locator(PLATFORM_SELECTOR("layouts_facebook")).click();
    await adminPage.waitForTimeout(500);
    // Section heading for Facebook settings should be visible
    const heading = adminPage.locator(".wprf-section-title")
      .filter({ hasText: /Facebook/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Facebook template has a template structure input field", async ({ adminPage }) => {
    await adminPage.locator(PLATFORM_SELECTOR("layouts_facebook")).click();
    await adminPage.waitForTimeout(500);
    // Scope by parent attribute to avoid picking another platform's hidden input
    const templateInput = adminPage.locator("input[name='template_structure'][parent*='facebook'], textarea[name='template_structure'][parent*='facebook']").first();
    await expect(templateInput).toBeVisible({ timeout: 10_000 });
  });

  test("Facebook template input contains placeholder tokens", async ({ adminPage }) => {
    await adminPage.locator(PLATFORM_SELECTOR("layouts_facebook")).click();
    await adminPage.waitForTimeout(500);
    const templateInput = adminPage.locator("input[name='template_structure'][parent*='facebook']").first();
    await expect(templateInput).toBeVisible({ timeout: 10_000 });
    const value = await templateInput.inputValue();
    // Default template uses {title}, {content}, {url}, {tags} tokens
    expect(value).toMatch(/\{title\}|\{url\}|\{content\}/);
  });

  // ── Twitter template ───────────────────────────────────────────────────

  test("clicking Twitter sub-tab shows its settings panel", async ({ adminPage }) => {
    await adminPage.locator(PLATFORM_SELECTOR("layouts_twitter")).click();
    await adminPage.waitForTimeout(500);
    const heading = adminPage.locator(".wprf-section-title")
      .filter({ hasText: /Twitter/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Twitter template has a template structure input field", async ({ adminPage }) => {
    await adminPage.locator(PLATFORM_SELECTOR("layouts_twitter")).click();
    await adminPage.waitForTimeout(500);
    const templateInput = adminPage.locator("input[name='template_structure'][parent*='twitter']").first();
    await expect(templateInput).toBeVisible({ timeout: 10_000 });
  });

  // ── LinkedIn template ──────────────────────────────────────────────────

  test("clicking LinkedIn sub-tab shows its settings panel", async ({ adminPage }) => {
    await adminPage.locator(PLATFORM_SELECTOR("layouts_linkedin")).click();
    await adminPage.waitForTimeout(500);
    const heading = adminPage.locator(".wprf-section-title")
      .filter({ hasText: /LinkedIn/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ── All platform tabs render a template_structure field ────────────────

  for (const { key, label } of platforms) {
    test(`${label} platform has a template structure field`, async ({ adminPage }) => {
      // Extract platform name from key: "layouts_google_business" → "google_business"
      const platformName = key.replace("layouts_", "");
      await adminPage.locator(PLATFORM_SELECTOR(key)).click();
      await adminPage.waitForTimeout(500);
      // Scope by parent attribute so we get THIS platform's input, not Facebook's
      const field = adminPage.locator(`input[name='template_structure'][parent*='${platformName}']`).first();
      await expect(field).toBeVisible({ timeout: 10_000 });
    });
  }
});
