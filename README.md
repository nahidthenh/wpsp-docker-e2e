# SchedulePress E2E Test Suite

Automated end-to-end test suite for **[SchedulePress](https://wordpress.org/plugins/wp-scheduled-posts/)** — a WordPress plugin by [WPDeveloper](https://wpdeveloper.com/) for scheduling posts, managing an editorial calendar, and auto-sharing content to social media.

> **Plugin:** SchedulePress · **Author:** WPDeveloper · **Active installs:** 10,000+ · **Rating:** 4.6/5 · **Version:** 5.2.17

---

## Prerequisites

- Node.js >= 20
- Docker Desktop >= 24 with Compose v2
- SchedulePress plugins cloned as sibling folders:

```
parent/
├── wp-scheduled-posts/      ← free plugin (slug: wp-scheduled-posts)
├── wp-scheduled-posts-pro/  ← PRO plugin (optional)
└── wpsp-docker-e2e/         ← this repo
```

---

## Setup

```bash
cp .env.example .env
npm install
npx playwright install --with-deps chromium
npm run docker:up          # starts WordPress + runs WP-CLI bootstrap
```

WordPress is available at **http://localhost:8080** (`admin` / `admin`).

---

## Running Tests

```bash
npm test                   # headless, all tests
npm run test:headed        # with browser visible
npm run test:ui            # interactive Playwright UI
npm run test:report        # open last HTML report in browser
```

Run a single spec:

```bash
npx playwright test tests/03-advanced/18-user-roles.spec.ts
```

---

## Useful Commands

```bash
npm run docker:reset       # wipe containers + volumes (fresh WordPress install)
npm run cron:run           # trigger WP-Cron manually
```

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)

Trigger via **Actions → Run workflow** with optional inputs:

| Input | Description |
|---|---|
| `free_branch` | Branch of `wp-scheduled-posts` to test. Leave blank for default. |
| `pro_branch` | Branch of `wp-scheduled-posts-pro` to test. Leave blank for default. |
| `test_pattern` | Glob to run specific specs (e.g. `tests/03-advanced/*.spec.ts`). Leave blank for all. |

After each run the HTML report is automatically deployed to GitHub Pages and linked in the job summary.

---

## Test Results

| Resource | Link |
|---|---|
| Latest HTML Report (GitHub Pages) | [nahidthenh.github.io/wpsp-docker-e2e](https://nahidthenh.github.io/wpsp-docker-e2e/) |
| All CI Runs (GitHub Actions) | [github.com/nahidthenh/wpsp-docker-e2e/actions](https://github.com/nahidthenh/wpsp-docker-e2e/actions) |
| Artifact reports (14-day retention) | Available on each Actions run under **Artifacts** |

---

## Key Environment Variables

| Variable           | Default                  | Description              |
|--------------------|--------------------------|--------------------------|
| `WP_BASE_URL`      | `http://localhost:8080`  | WordPress URL            |
| `WP_ADMIN_USER`    | `admin`                  | Admin username           |
| `WP_ADMIN_PASS`    | `admin`                  | Admin password           |
| `PLUGIN_FREE_PATH` | `../wp-scheduled-posts`  | Path to the free plugin  |
| `PLUGIN_PRO_PATH`  | *(optional)*             | Path to the PRO plugin   |

---

## What This Suite Covers

| Tier | Specs | Tests | Focus |
|---|---|---|---|
| 01-basic | 5 | ~131 | Plugin activation, settings page, calendar UI, scheduling a post, PRO feature smoke tests |
| 02-medium | 6 | ~86 | Gutenberg panel, settings save/persist, scheduling hub, dashboard widget, admin bar, calendar events |
| 03-advanced | 8 | ~50 | Full schedule→publish flow, republish/unpublish, missed schedule recovery, API security, user roles, timezone accuracy, post type settings |

See [summary.md](summary.md) for the full breakdown and manual pre-release checklist.

---

## Adding Tests

1. Create `tests/my-feature.spec.ts`
2. Import from `../fixtures/base-fixture` for the authenticated `adminPage`
3. Use helpers from `../utils/wp-helpers` for common actions
4. Call `trackPost(title)` for any posts you create — they are deleted automatically after each test

---

## Links

- Plugin page: [wordpress.org/plugins/wp-scheduled-posts](https://wordpress.org/plugins/wp-scheduled-posts/)
- Plugin docs: [wpdeveloper.com/docs-category/wp-scheduled-posts](https://wpdeveloper.com/docs-category/wp-scheduled-posts/)
- Playwright docs: [playwright.dev](https://playwright.dev/)
