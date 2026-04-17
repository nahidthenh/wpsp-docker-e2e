---
name: feature-test
description: Analyse a plugin branch by diffing it against master for free and/or pro repos, draft Playwright test cases for review, write them to the regression suite, run them, and report results. Usage: /feature-test <branch> [--pro]
user-invocable: true
allowed-tools: Bash Read Write Edit Glob Grep
---

# feature-test — Branch Diff → Test Case → Run

## Arguments
- `<branch>` — the feature/bug branch to analyse (required)
- `--pro` — also analyse the PRO plugin repo (optional; include when user indicates pro is involved)

Extract the branch name and `--pro` flag from the args passed to this skill.
If no branch is given, ask the user: "Which branch should I analyse?"

---

## Step 1 — Resolve plugin paths from .env

Read `/Users/md.nahidhasan/wpsp-docker-e2e/.env` and parse:
- `PLUGIN_FREE_PATH` → absolute path of free plugin repo
- `PLUGIN_PRO_PATH` → absolute path of pro plugin repo

Both paths in `.env` are relative to the project root `/Users/md.nahidhasan/wpsp-docker-e2e`.
Resolve them to absolute paths (e.g. `../wpsp/wp-scheduled-posts` → `/Users/md.nahidhasan/wpsp/wp-scheduled-posts`).

---

## Step 2 — Find the branch in each repo

### Free repo (always):
```bash
cd <FREE_ABSOLUTE_PATH> && git fetch --quiet origin 2>/dev/null; git branch -a | grep -i "<branch>"
```
If the branch exists (local or remote), proceed. If not, note it as "branch not found in free repo."

### Pro repo:
Even if `--pro` was NOT passed, check silently:
```bash
cd <PRO_ABSOLUTE_PATH> && git fetch --quiet origin 2>/dev/null; git branch -a | grep -i "<branch>"
```
If the branch exists in the pro repo, automatically include it and inform the user.
If `--pro` was passed but the branch is not found there, warn the user.

---

## Step 3 — Git diff against master/main

For each repo where the branch was found, determine the default base branch:
```bash
cd <REPO_PATH> && git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}'
```
Fall back to `master` if the command fails.

Then get the diff (exclude noise files):
```bash
cd <REPO_PATH> && git diff <base-branch>...<branch> -- . ':(exclude)*.lock' ':(exclude)package-lock.json' ':(exclude)*.min.js' ':(exclude)*.min.css'
```

If the branch only exists on remote, use `origin/<branch>`.

---

## Step 4 — Analyse the diff

Read the combined diff from both repos (free + pro if applicable). Identify:
1. **What changed** — list of modified files grouped by area (PHP backend, React/JS frontend, CSS, tests, config)
2. **Feature/bug summary** — 2-4 sentence plain-English summary of what the change does
3. **Scope** — free-only / pro-only / both
4. **Test surface** — which UI flows, API endpoints, or WP-CLI behaviours are affected

---

## Step 5 — Draft test cases and ask for approval

Present the following to the user **before writing any files**:

```
## Diff Summary
<2-4 sentences describing what changed>

## Proposed Test Cases
File: tests/regression/<NN>-<slug>.spec.ts  (new)
  OR  tests/regression/<existing-file>.spec.ts  (append)

### <test.describe block name>
- [ ] <test name 1>  — <one-line rationale>
- [ ] <test name 2>  — <one-line rationale>
...

Proceed with writing these tests? (yes / adjust / skip)
```

**File placement rules:**
- If the changes touch an area already covered by an existing spec file (e.g. calendar changes → `03-calendar.spec.ts`), append to that file.
- If the changes introduce a genuinely new area, create the next numbered file: find the highest `NN` in `tests/regression/` and use `NN+1`.
- Never split related tests across multiple files for a single branch.

**Wait for the user's reply before continuing.**
- `yes` → proceed to Step 6
- `adjust` → incorporate feedback and re-present the proposal
- `skip` → stop here

---

## Step 6 — Write the test file(s)

Write Playwright/TypeScript tests following these project conventions:
- Import from `../../fixtures/base-fixture` and `../../utils/selectors`
- Use `adminPage` fixture for UI tests; `wpCli` fixture for WP-CLI checks
- No `page.waitForTimeout()` hard waits — use `expect(...).toBeVisible({ timeout: N })` instead
- Use `test.beforeAll` / `test.afterAll` for setup/teardown that creates WP content
- Always clean up WP content (posts, options) created during tests in `afterAll`
- Use `Date.now()` suffixes for unique post titles to avoid collisions
- Group all related tests inside a single `test.describe` block

After writing, confirm: "Tests written to `<file path>`."

---

## Step 7 — Run the tests

Run only the newly written/modified spec file:
```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && npx playwright test <spec-file-path> --reporter=list 2>&1
```

If Docker containers are not running, start them first:
```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && docker compose up -d && sleep 5 && npx playwright test <spec-file-path> --reporter=list 2>&1
```

Capture the full output and exit code.

---

## Step 8 — Report

Present a structured report:

```
## Test Run Report — <branch>

**Branch:** <branch>
**Repos analysed:** free [+ pro if applicable]
**Spec file:** <path>
**Tests written:** <N>
**Tests passed:** <N>
**Tests failed:** <N>

### Results
| # | Test name | Status | Notes |
|---|-----------|--------|-------|
| 1 | <name>    | PASS / FAIL | <error snippet if failed> |

### Failed Test Details
<For each failure: test name, error message, relevant line>

### Recommendation
<One paragraph: is the branch safe to merge? Any gaps in coverage?>
```

If all tests pass: "All tests passed. Branch `<branch>` looks good."
If any fail: "X test(s) failed. Review the failures above before merging."
