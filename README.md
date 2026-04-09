# SchedulePress E2E Test Suite

End-to-end tests for the **SchedulePress** WordPress plugin using [Playwright](https://playwright.dev/) (TypeScript) and Docker.

---

## Prerequisites

- Node.js >= 20
- Docker Desktop >= 24 with Compose v2
- SchedulePress (free) plugin cloned as a sibling folder:

```
parent/
├── wp-scheduled-posts/     ← free plugin
└── wpsp-docker-e2e/        ← this repo
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
npm test                   # headless
npm run test:headed        # with browser visible
npm run test:ui            # interactive Playwright UI
npm run test:report        # open last HTML report
```

To run a single spec:

```bash
npx playwright test tests/schedule-post.spec.ts
```

---

## Useful Commands

```bash
npm run docker:reset       # stop containers + wipe volumes (fresh install)
npm run cron:run           # trigger WP-Cron manually
```

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)

- Supports `workflow_dispatch` with optional `free_branch` / `pro_branch` inputs to test a specific plugin branch.
- HTML report is uploaded as an artifact (14-day retention).

---

## Key Environment Variables

| Variable           | Default                  | Description              |
|--------------------|--------------------------|--------------------------|
| `WP_BASE_URL`      | `http://localhost:8080`  | WordPress URL            |
| `WP_ADMIN_USER`    | `admin`                  | Admin username           |
| `WP_ADMIN_PASS`    | `admin`                  | Admin password           |
| `PLUGIN_FREE_PATH` | `../wp-scheduled-posts`  | Path to free plugin      |
| `PLUGIN_PRO_PATH`  | *(optional)*             | Path to pro plugin       |

---

## Adding Tests

1. Create `tests/my-feature.spec.ts`
2. Import from `../fixtures/base-fixture` for the authenticated `adminPage`
3. Use helpers from `../utils/wp-helpers` for common actions
4. Call `trackPost(title)` for any posts you create — they are cleaned up automatically after each test
