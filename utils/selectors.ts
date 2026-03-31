/**
 * selectors.ts
 *
 * Centralised selector constants.
 * Keeping selectors here prevents magic strings from scattering across tests
 * and makes maintenance easy when the UI changes.
 */

// ── WordPress core selectors ───────────────────────────────────────────────
export const WP_LOGIN = {
  username:    "#user_login",
  password:    "#user_pass",
  rememberMe:  "#rememberme",
  submit:      "#wp-submit",
  errorNotice: "#login_error",
} as const;

export const WP_ADMIN_BAR = {
  newPost: "#wp-admin-bar-new-post > a",
} as const;

// ── Block editor (Gutenberg) selectors ─────────────────────────────────────
export const BLOCK_EDITOR = {
  titleInput:       ".wp-block-post-title, [aria-label='Add title']",
  bodyArea:         ".block-editor-writing-flow",
  publishButton:    "button.editor-post-publish-button__button",
  saveButton:       "button.editor-post-save-draft__button, button[aria-label='Save draft']",
  statusButton:     "button.editor-post-status-trigger, button[aria-label='Change status']",
  schedulePanelBtn: "button[aria-label='Change date and time']",
  postUrlField:     ".editor-post-url__link",

  // Post Status & Visibility panel
  statusDropdown:   "select#post-status-selector",

  // Date/time picker inside the schedule panel
  datePicker: {
    year:   "input[aria-label='Year']",
    month:  "input[aria-label='Month']",
    day:    "input[aria-label='Day']",
    hour:   "input[aria-label='Hours']",
    minute: "input[aria-label='Minutes']",
  },

  // Pre-publish panel
  prePub: {
    scheduleButton: "button.editor-post-publish-button__button",
    saveButton:     ".editor-post-save-draft__button",
  },

  // Sidebar
  sidebar: {
    statusSection: ".edit-post-post-status",
    publishDate:   ".edit-post-last-revision__title, [aria-label='Published on']",
  },
} as const;

// ── SchedulePress specific selectors ───────────────────────────────────────
// Real admin slugs (verified from plugin source):
//   Main settings  → admin.php?page=schedulepress
//   Calendar        → admin.php?page=schedulepress-calendar
export const SCHEDULE_PRESS = {
  // Sidebar menu — top-level "SchedulePress" entry
  adminMenuLink:   "#adminmenu a[href*='page=schedulepress']",

  // Direct admin URLs
  urls: {
    settings:  "/wp-admin/admin.php?page=schedulepress",
    calendar:  "/wp-admin/admin.php?page=schedulepress-calendar",
  },

  // Settings page tabs (React-rendered, matched by visible text)
  settingsTabs: {
    socialProfiles: "text=Social Profiles",
    settings:       "text=Settings",
    calendar:       "text=Calendar",
    autoScheduler:  "text=Auto Scheduler",
    manualScheduler:"text=Manual Scheduler",
    // PRO-only tabs
    license:        "text=License",
    manageSchedule: "text=Manage Schedule",
  },

  // Calendar view — FullCalendar v6 selectors
  calendar: {
    root:     ".fc",
    toolbar:  ".fc-toolbar, .fc-header-toolbar",
    title:    ".fc-toolbar-title",
    prevBtn:  "button.fc-prev-button",
    nextBtn:  "button.fc-next-button",
    todayBtn: "button.fc-today-button",
    event:    ".fc-event",
    dayGrid:  ".fc-daygrid",
  },

  // Posts list
  scheduledList: {
    wrapper:  ".wpsp-scheduled-posts, .wpsp-posts-table",
    row:      ".wpsp-post-row, tr.type-post",
  },
} as const;

// ── Posts list table selectors ─────────────────────────────────────────────
export const POSTS_LIST = {
  scheduledTab:    "a[href*='post_status=future']",
  publishedTab:    "a[href*='post_status=publish']",
  draftTab:        "a[href*='post_status=draft']",
  postRowByTitle:  (title: string) => `tr a.row-title:text("${title}")`,
  statusBadge:     ".status",
  editLink:        "a.editinline, span.edit a",
} as const;
