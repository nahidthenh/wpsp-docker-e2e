# SchedulePress — Playwright E2E Test Suite

Production-grade end-to-end tests for the **SchedulePress** WordPress plugin using [Playwright](https://playwright.dev/) (TypeScript) and Docker.

---

## Project Structure

```
wpsp-docker-e2e/
├── .github/workflows/e2e.yml       # GitHub Actions CI
├── docker/
│   ├── wp-setup.sh                 # WP-CLI bootstrap script
│   ├── wait-for-wp.sh              # Readiness poller
│   └── uploads.ini                 # PHP upload limits
├── fixtures/
│   └── base-fixture.ts             # Extended test fixture (auth + helpers)
├── tests/
│   ├── auth.setup.ts               # Login setup (runs before all tests)
│   ├── admin-login.spec.ts         # Login / logout flows
│   ├── plugin-activation.spec.ts   # Plugin active state checks
│   ├── schedule-post.spec.ts       # Create & schedule a post
│   ├── verify-scheduled-status.spec.ts  # Status verification (UI + REST API)
│   ├── post-publish-via-cron.spec.ts    # Cron-triggered auto-publish
│   ├── calendar-view.spec.ts       # Calendar UI tests
│   └── schedulepress-settings.spec.ts   # Settings page + dashboard widget
├── utils/
│   ├── selectors.ts                # All CSS/role selectors (no magic strings)
│   ├── test-data.ts                # Data factories
│   └── wp-helpers.ts              # Reusable page actions + WP-CLI wrappers
├── playwright/.auth/               # ← auto-generated, git-ignored
├── docker-compose.yml
├── playwright.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Prerequisites

| Tool           | Version  |
|----------------|----------|
| Node.js        | ≥ 20     |
| Docker Desktop | ≥ 24     |
| Docker Compose | v2       |

The **SchedulePress (free)** plugin must be cloned at `../wp-scheduled-posts` relative to this project (i.e. sibling folder).

```
parent/
├── wp-scheduled-posts/     ← plugin (free)
└── wpsp-docker-e2e/        ← this project
```

---

## Quick Start

```bash
# 1. Clone this repo
git clone <repo-url> wpsp-docker-e2e
cd wpsp-docker-e2e

# 2. Copy env file
cp .env.example .env

# 3. Install Node dependencies
npm install

# 4. Install Playwright browsers
npx playwright install --with-deps chromium

# 5. Start WordPress + run WP-CLI setup (one command)
npm run docker:up

# 6. Run tests
npm test
```

After `npm run docker:up` you can visit **http://localhost:8080** and log in with `admin / admin`.

---

## Running Tests

```bash
# Run all tests (headless)
npm test

# Run with browser visible
npm run test:headed

# Interactive Playwright UI mode
npm run test:ui

# Debug a single test
npm run test:debug -- tests/schedule-post.spec.ts

# Run in parallel (4 workers)
npm run test:parallel

# Open last HTML report
npm run test:report
```

---

## Triggering WP-Cron Manually

```bash
# Via npm script (uses docker-compose exec)
npm run cron:run

# Directly via Docker
docker-compose exec -T wpcli wp cron event run --due-now \
  --path=/var/www/html --allow-root
```

The `post-publish-via-cron.spec.ts` test schedules a post 1 minute in the future, waits, then calls `cronRun()` automatically.

---

## Resetting the Environment

```bash
# Stop containers and delete all volumes (fresh WordPress install)
npm run docker:reset
```

---

## CI / GitHub Actions

The workflow at `.github/workflows/e2e.yml`:

1. Checks out this repo and the plugin repo
2. Starts the Docker stack
3. Polls until WordPress returns HTTP 200
4. Runs the WP-CLI setup container
5. Runs `npx playwright test`
6. Uploads the HTML report as an artifact (14-day retention)
7. Tears down containers

---

## Environment Variables

| Variable          | Default                | Description                    |
|-------------------|------------------------|--------------------------------|
| `WP_BASE_URL`     | `http://localhost:8080`| WordPress URL                  |
| `WP_ADMIN_USER`   | `admin`                | Admin username                 |
| `WP_ADMIN_PASS`   | `admin`                | Admin password                 |
| `PLUGIN_FREE_PATH`| `../wp-scheduled-posts`| Host path to free plugin       |
| `PLUGIN_PRO_PATH` | *(commented out)*      | Host path to pro plugin        |

---

## Retry Strategy

- **CI**: 2 automatic retries per failing test (`retries: 2` in config)
- **Local**: 0 retries (fail fast)
- Traces, screenshots and videos are captured **on first retry** so failures are diagnosable

---

## Adding New Tests

1. Create `tests/my-feature.spec.ts`
2. Import from `../fixtures/base-fixture` to get the authenticated `adminPage`
3. Use helpers from `../utils/wp-helpers` for navigation and actions
4. Register any posts you create with `trackPost(title)` for automatic cleanup
