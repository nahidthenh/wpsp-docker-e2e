---
name: migration-test
description: Seed SchedulePress scheduling fixtures on master, wait 10 minutes, switch to a feature branch, trigger WP cron, and produce a Pass/Fail migration report. Usage: /migration-test <branch> [--pro-branch=<branch>]
user-invocable: true
allowed-tools: Bash Read Write Edit Glob Grep ScheduleWakeup
---

# migration-test — Seed on master → Switch branch → Verify

## Arguments
- `<branch>` — feature/bug branch to test migration for (required)
- `--pro-branch=<branch>` — override the PRO plugin branch (optional; defaults to the same as free branch)

Extract both values from args. If no branch is given, ask the user: "Which branch should I run the migration test against?"

---

## Phase 0 — Detect mode

Check args for the literal string `--verify`:
- **Present** → jump directly to **Phase 4 (Migration & Verification)**; skip seeding.
- **Absent** → start at **Phase 1 (Init)**.

---

## Phase 1 — Init

1. Parse `FREE_BRANCH` from args (the non-flag token).
2. Parse `PRO_BRANCH` from `--pro-branch=<val>` if present; otherwise `PRO_BRANCH = FREE_BRANCH`.
3. Resolve plugin paths from `.env`:

```bash
source <(grep -v '^\s*#' /Users/md.nahidhasan/wpsp-docker-e2e/.env | grep -v '^\s*$')
FREE_PATH="${PLUGIN_FREE_PATH:-../wpsp/wp-scheduled-posts}"
PRO_PATH="${PLUGIN_PRO_PATH:-../wpsp/wp-scheduled-posts-pro}"
# Resolve relative paths
cd /Users/md.nahidhasan/wpsp-docker-e2e
[[ "$FREE_PATH" != /* ]] && FREE_PATH="$(cd "$FREE_PATH" 2>/dev/null && pwd)"
[[ "$PRO_PATH"  != /* ]] && PRO_PATH="$(cd "$PRO_PATH"  2>/dev/null && pwd)"
echo "Free plugin: $FREE_PATH"
echo "Pro plugin:  $PRO_PATH"
```

4. Write the state file so the verify phase can recover all context after ScheduleWakeup:

```bash
SCHED_DATE=$(date -v+12M "+%Y-%m-%d %H:%M:%S" 2>/dev/null \
  || date --date="12 minutes" "+%Y-%m-%d %H:%M:%S")
SCHED_DATE2=$(date -v+24M "+%Y-%m-%d %H:%M:%S" 2>/dev/null \
  || date --date="24 minutes" "+%Y-%m-%d %H:%M:%S")
STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > /Users/md.nahidhasan/wpsp-docker-e2e/.migration-state.json <<ENDSTATE
{
  "freeBranch": "$FREE_BRANCH",
  "proBranch":  "$PRO_BRANCH",
  "startedAt":  "$STARTED",
  "schedDate":  "$SCHED_DATE",
  "schedDate2": "$SCHED_DATE2",
  "posts": {}
}
ENDSTATE
echo "State file initialised."
```

---

## Phase 2 — Baseline: switch both plugins to master

Run the branch-setup script. This checks out master for both plugins and resets Docker so WordPress picks up clean code. **Wait for it to finish — it takes ~60–90 s.**

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && \
  bash scripts/setup-branch.sh --free-branch=master --pro-branch=master
```

After it returns, confirm WordPress is live:

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && \
  docker-compose exec -T wpcli wp core is-installed \
    --path=/var/www/html --allow-root && echo "WordPress OK"
```

If this fails, run `docker-compose logs wordpress | tail -20` and report the error before proceeding.

---

## Phase 3 — Seed test fixtures

> All posts are scheduled **12 minutes from now** (`$SCHED_DATE`). This gives a comfortable buffer for the 10-minute wakeup delay plus branch-switch time.

Run every command from `/Users/md.nahidhasan/wpsp-docker-e2e`. Capture each `--porcelain` post ID.

### T1 — Standard Schedule (post type: post)

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e
T1_ID=$(docker-compose exec -T wpcli wp post create \
  --post_title="MTEST-StandardPost-$(date +%s)" \
  --post_status=future \
  --post_date="$SCHED_DATE" \
  --post_type=post \
  --porcelain \
  --path=/var/www/html --allow-root)
echo "T1 StandardPost: $T1_ID"
docker-compose exec -T wpcli wp post get $T1_ID \
  --field=post_status --path=/var/www/html --allow-root
```

### T2 — Standard Schedule (post type: page)

```bash
T2_ID=$(docker-compose exec -T wpcli wp post create \
  --post_title="MTEST-StandardPage-$(date +%s)" \
  --post_status=future \
  --post_date="$SCHED_DATE" \
  --post_type=page \
  --porcelain \
  --path=/var/www/html --allow-root)
echo "T2 StandardPage: $T2_ID"
```

### T3 — Advanced Schedule / PRO multi-date (post type: post)

Creates a draft and attaches the PRO `_wpscppro_advance_schedule` meta with two future dates.

```bash
T3_ID=$(docker-compose exec -T wpcli wp post create \
  --post_title="MTEST-AdvancedSched-$(date +%s)" \
  --post_status=draft \
  --post_type=post \
  --porcelain \
  --path=/var/www/html --allow-root)

ADV_META="[{\"date\":\"$SCHED_DATE\",\"status\":\"publish\"},{\"date\":\"$SCHED_DATE2\",\"status\":\"draft\"}]"
docker-compose exec -T wpcli wp post meta set $T3_ID \
  _wpscppro_advance_schedule "$ADV_META" \
  --path=/var/www/html --allow-root

echo "T3 AdvancedSched: $T3_ID"
docker-compose exec -T wpcli wp post meta get $T3_ID \
  _wpscppro_advance_schedule --path=/var/www/html --allow-root
```

### T4 — Republish Scheduling / PRO

Draft post + `_wpscp_schedule_republish_date` meta set to `$SCHED_DATE`.

```bash
T4_ID=$(docker-compose exec -T wpcli wp post create \
  --post_title="MTEST-Republish-$(date +%s)" \
  --post_status=draft \
  --post_type=post \
  --porcelain \
  --path=/var/www/html --allow-root)

docker-compose exec -T wpcli wp post meta set $T4_ID \
  _wpscp_schedule_republish_date "$SCHED_DATE" \
  --path=/var/www/html --allow-root

echo "T4 Republish: $T4_ID"
```

### T5 — Unpublish Scheduling / PRO

Published post + `_wpscp_schedule_draft_date` meta set to `$SCHED_DATE`.

```bash
T5_ID=$(docker-compose exec -T wpcli wp post create \
  --post_title="MTEST-Unpublish-$(date +%s)" \
  --post_status=publish \
  --post_type=post \
  --porcelain \
  --path=/var/www/html --allow-root)

docker-compose exec -T wpcli wp post meta set $T5_ID \
  _wpscp_schedule_draft_date "$SCHED_DATE" \
  --path=/var/www/html --allow-root

echo "T5 Unpublish: $T5_ID"
```

### T6 — Auto-Schedule

Draft post with `_wpscp_schedule_type=auto`. SchedulePress will assign a slot from the configured queue on the next cron run.

```bash
T6_ID=$(docker-compose exec -T wpcli wp post create \
  --post_title="MTEST-AutoSched-$(date +%s)" \
  --post_status=draft \
  --post_type=post \
  --porcelain \
  --path=/var/www/html --allow-root)

docker-compose exec -T wpcli wp post meta set $T6_ID \
  _wpscp_schedule_type "auto" \
  --path=/var/www/html --allow-root

echo "T6 AutoSched: $T6_ID"
```

> If the auto-schedule queue is not configured, T6 will remain draft — record this as **Manual Intervention Required** in the report.

### T7 — Manual Schedule

Post with explicit `post_status=future` and `_wpscp_schedule_type=manual` — represents a post manually scheduled via the editor.

```bash
T7_ID=$(docker-compose exec -T wpcli wp post create \
  --post_title="MTEST-ManualSched-$(date +%s)" \
  --post_status=future \
  --post_date="$SCHED_DATE" \
  --post_type=post \
  --porcelain \
  --path=/var/www/html --allow-root)

docker-compose exec -T wpcli wp post meta set $T7_ID \
  _wpscp_schedule_type "manual" \
  --path=/var/www/html --allow-root

echo "T7 ManualSched: $T7_ID"
```

### Save all IDs to the state file

```bash
cat > /Users/md.nahidhasan/wpsp-docker-e2e/.migration-state.json <<ENDSTATE
{
  "freeBranch": "$FREE_BRANCH",
  "proBranch":  "$PRO_BRANCH",
  "startedAt":  "$STARTED",
  "schedDate":  "$SCHED_DATE",
  "schedDate2": "$SCHED_DATE2",
  "posts": {
    "T1": { "id": "$T1_ID", "type": "post", "feature": "Standard Schedule",  "expected": "publish" },
    "T2": { "id": "$T2_ID", "type": "page", "feature": "Standard Schedule",  "expected": "publish" },
    "T3": { "id": "$T3_ID", "type": "post", "feature": "Advanced Schedule",  "expected": "publish" },
    "T4": { "id": "$T4_ID", "type": "post", "feature": "Republish",          "expected": "publish" },
    "T5": { "id": "$T5_ID", "type": "post", "feature": "Unpublish",          "expected": "draft"   },
    "T6": { "id": "$T6_ID", "type": "post", "feature": "Auto-Schedule",      "expected": "future"  },
    "T7": { "id": "$T7_ID", "type": "post", "feature": "Manual Schedule",    "expected": "publish" }
  }
}
ENDSTATE
echo "State file written:"
cat /Users/md.nahidhasan/wpsp-docker-e2e/.migration-state.json
```

### Set the 10-minute timer

Tell the user:

> "All 7 fixtures seeded on **master** (scheduled for `$SCHED_DATE`). Setting a 10-minute timer — I'll automatically switch to branch `$FREE_BRANCH`, run WP cron, and post the verification report here."

Then call **ScheduleWakeup**:
- `delaySeconds`: 620
- `prompt`: `/migration-test --verify`
- `reason`: `Verifying migration test fixtures after 10-min schedule window`

---

## Phase 4 — Migration & Verification (--verify mode)

### Step 4a — Read the state file

```bash
cat /Users/md.nahidhasan/wpsp-docker-e2e/.migration-state.json
```

If the file is missing, tell the user: "State file not found — please re-run `/migration-test <branch>` from the beginning." Then stop.

Parse `freeBranch`, `proBranch`, and all post IDs from the JSON output.

### Step 4b — Switch to the feature branch

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && \
  bash scripts/setup-branch.sh \
    --free-branch="<freeBranch>" \
    --pro-branch="<proBranch>"
```

Wait for Docker to be ready (60–90 s). Confirm WordPress is live:

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && \
  docker-compose exec -T wpcli wp core is-installed \
    --path=/var/www/html --allow-root && echo "WordPress OK"
```

### Step 4c — Pre-cron status snapshot

For each post, confirm it still exists and record its current status:

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e
for ID in $T1_ID $T2_ID $T3_ID $T4_ID $T5_ID $T6_ID $T7_ID; do
  S=$(docker-compose exec -T wpcli wp post get $ID \
    --field=post_status --path=/var/www/html --allow-root 2>&1 || echo "NOT FOUND")
  echo "Post $ID pre-cron: $S"
done
```

### Step 4d — Trigger WP cron

Run cron twice — PRO republish/unpublish uses a two-step hook chain:

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && npm run cron:run
sleep 30
cd /Users/md.nahidhasan/wpsp-docker-e2e && npm run cron:run
```

### Step 4e — Post-cron status check

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e
for ID in $T1_ID $T2_ID $T3_ID $T4_ID $T5_ID $T6_ID $T7_ID; do
  S=$(docker-compose exec -T wpcli wp post get $ID \
    --field=post_status --path=/var/www/html --allow-root 2>&1 || echo "NOT FOUND")
  echo "Post $ID post-cron: $S"
done
```

Also verify PRO meta is intact after migration:

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e
echo "=== T3 advanced meta ==="
docker-compose exec -T wpcli wp post meta get $T3_ID \
  _wpscppro_advance_schedule --path=/var/www/html --allow-root

echo "=== T4 republish meta ==="
docker-compose exec -T wpcli wp post meta get $T4_ID \
  _wpscp_schedule_republish_date --path=/var/www/html --allow-root

echo "=== T5 unpublish meta ==="
docker-compose exec -T wpcli wp post meta get $T5_ID \
  _wpscp_schedule_draft_date --path=/var/www/html --allow-root
```

### Step 4f — Cron hook audit

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e && \
  docker-compose exec -T wpcli wp cron event list \
    --path=/var/www/html --allow-root --format=table 2>&1 \
  | grep -iE "wpsp|wcscp|schedulepress" || echo "(no WPSP cron hooks found)"
```

---

## Phase 5 — Report

Compare actual post-cron status against `expected` from the state file and print this exact format:

```
╔══════════════════════════════════════════════════════════════════╗
║          SCHEDULEPRESS MIGRATION TEST REPORT                     ║
║  Free Branch : <freeBranch>                                      ║
║  Pro Branch  : <proBranch>                                       ║
║  Tested at   : <UTC timestamp>                                   ║
╚══════════════════════════════════════════════════════════════════╝

┌─────┬──────────────────────┬───────────┬──────────┬───────────┬──────────┐
│  ID │ Feature              │ Post Type │ Expected │ Actual    │ Result   │
├─────┼──────────────────────┼───────────┼──────────┼───────────┼──────────┤
│  T1 │ Standard Schedule    │ post      │ publish  │ <actual>  │ ✅ PASS  │
│  T2 │ Standard Schedule    │ page      │ publish  │ <actual>  │ ✅ PASS  │
│  T3 │ Advanced Schedule    │ post      │ publish  │ <actual>  │ ✅ PASS  │
│  T4 │ Republish            │ post      │ publish  │ <actual>  │ ✅ PASS  │
│  T5 │ Unpublish            │ post      │ draft    │ <actual>  │ ✅ PASS  │
│  T6 │ Auto-Schedule        │ post      │ future   │ <actual>  │ ✅ PASS  │
│  T7 │ Manual Schedule      │ post      │ publish  │ <actual>  │ ✅ PASS  │
└─────┴──────────────────────┴───────────┴──────────┴───────────┴──────────┘

SUMMARY
  Passed  : X / 7
  Failed  : Y / 7
  Skipped : Z / 7

FAILURES
  (list each failure with: feature, expected status, actual status, post ID, likely cause)

MANUAL INTERVENTION REQUIRED
  - [ ] <any FAIL> — inspect post ID <id> in wp-admin › Posts, check cron via:
        npm run cron:run
  - [ ] T6 Auto-Schedule — verify queue is configured in SchedulePress › Settings › Auto Schedule
  - [ ] PRO two-step chain — if T4/T5 failed, re-run cron with 30s gap:
        npm run cron:run && sleep 30 && npm run cron:run

CRON HOOK AUDIT
  <output from Step 4f>
```

Use `✅ PASS` when actual equals expected, `❌ FAIL` when it does not, and `⏭ SKIP` when the post was not found (PRO plugin inactive or creation error).

---

## Phase 6 — Cleanup

Ask the user: "Should I delete the 7 `MTEST-` test posts and the state file?"

If yes:

```bash
cd /Users/md.nahidhasan/wpsp-docker-e2e

IDS=$(docker-compose exec -T wpcli wp post list \
  --post_title="MTEST-%" \
  --field=ID \
  --format=ids \
  --post_status=any \
  --path=/var/www/html --allow-root 2>/dev/null)

if [ -n "$IDS" ]; then
  docker-compose exec -T wpcli wp post delete $IDS --force \
    --path=/var/www/html --allow-root
  echo "Deleted: $IDS"
else
  echo "No MTEST- posts to clean up."
fi

rm -f /Users/md.nahidhasan/wpsp-docker-e2e/.migration-state.json
echo "State file removed."
```

---

## Error handling

| Situation | Action |
|---|---|
| `setup-branch.sh` fails — branch not found | Report the git error, stop. Do not seed. |
| `--porcelain` returns non-numeric output | Mark that test as SKIP, include the WP-CLI error in the report. |
| WordPress unreachable after docker:reset | Run `docker-compose logs wordpress \| tail -20`, include output in error. |
| State file missing on `--verify` | Ask user to re-run `/migration-test <branch>` from the start. |
| PRO plugin inactive | T3, T4, T5 → SKIP with note "wp-scheduled-posts-pro not active". Check with: `docker-compose exec -T wpcli wp plugin get wp-scheduled-posts-pro --field=status --path=/var/www/html --allow-root` |
