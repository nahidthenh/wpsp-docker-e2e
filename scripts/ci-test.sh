#!/usr/bin/env bash
# ci-test.sh
#
# Simulates CI conditions locally so you can catch failures before pushing.
# Usage:
#   ./scripts/ci-test.sh                                 # run all tests
#   ./scripts/ci-test.sh tests/post-metabox.spec.ts     # run specific file
#   ./scripts/ci-test.sh "tests/02-medium/*.spec.ts"    # run a glob pattern

set -e

PATTERN="${1:-}"

echo ""
echo "=== CI simulation mode ==="
echo "  CI=true | retries=2 | workers=2 | headless"
[ -n "$PATTERN" ] && echo "  pattern: $PATTERN"
echo ""

# Reset auth state so setup always runs fresh (same as CI)
mkdir -p playwright/.auth
echo '{"cookies":[],"origins":[]}' > playwright/.auth/admin.json

export CI=true
export WP_BASE_URL="${WP_BASE_URL:-http://localhost:8080}"
export WP_ADMIN_USER="${WP_ADMIN_USER:-admin}"
export WP_ADMIN_PASS="${WP_ADMIN_PASS:-admin}"

if [ -n "$PATTERN" ]; then
  npx playwright test tests/auth.setup.ts --project=setup
  npx playwright test $PATTERN --project=chromium --no-deps
else
  npx playwright test
fi
