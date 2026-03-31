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
export const SCHEDULE_PRESS = {
  adminMenuLink:    "#adminmenu a[href*='wp-scheduled-posts']",
  dashboardTitle:   "h1.wp-heading-inline",

  // Calendar view
  calendarPage:     "#adminmenu a[href*='wpsp-calendar']",
  calendarWrapper:  ".wpsp-calendar-wrapper, #wpsp-calendar, .fc",  // FullCalendar root
  calendarTitle:    ".fc-toolbar-title, .wpsp-calendar-title",
  calendarNavNext:  "button.fc-next-button, .fc-next-button",
  calendarNavPrev:  "button.fc-prev-button, .fc-prev-button",

  // Scheduled post list
  scheduledList: {
    wrapper:      ".wpsp-scheduled-posts, .wpsp-posts-table",
    row:          ".wpsp-post-row, tr.type-post",
    editLink:     "a.row-actions-edit, a.edit-action",
  },

  // Quick schedule modal / meta box
  quickSchedule: {
    modal:        ".wpsp-modal, #wpsp-quick-schedule",
    dateField:    "input[name='wpsp_date'], input.wpsp-date-field",
    timeField:    "input[name='wpsp_time'], input.wpsp-time-field",
    saveButton:   "button.wpsp-save-schedule, button.wpsp-submit",
  },

  // Settings page
  settings: {
    pageLink:     "#adminmenu a[href*='wpsp-settings']",
    saveButton:   "input[type='submit'][name='save'], input#submit",
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
