#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  setup-branch.sh
#
#  Checks out a SchedulePress plugin branch locally and restarts Docker so
#  the new plugin code is live for Playwright tests.
#
#  Usage:
#    bash scripts/setup-branch.sh --free-branch=feature/my-branch
#    bash scripts/setup-branch.sh --pro-branch=feature/my-branch
#    bash scripts/setup-branch.sh --free-branch=feat/x --pro-branch=feat/y
#    bash scripts/setup-branch.sh --free-branch=feat/x --skip-docker
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── Parse arguments ───────────────────────────────────────────────────────────
FREE_BRANCH=""
PRO_BRANCH=""
SKIP_DOCKER=false

for arg in "$@"; do
  case $arg in
    --free-branch=*) FREE_BRANCH="${arg#*=}" ;;
    --pro-branch=*)  PRO_BRANCH="${arg#*=}"  ;;
    --skip-docker)   SKIP_DOCKER=true         ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--free-branch=<branch>] [--pro-branch=<branch>] [--skip-docker]"
      exit 1
      ;;
  esac
done

if [ -z "$FREE_BRANCH" ] && [ -z "$PRO_BRANCH" ]; then
  echo "Usage: $0 [--free-branch=<branch>] [--pro-branch=<branch>] [--skip-docker]"
  echo ""
  echo "Examples:"
  echo "  bash scripts/setup-branch.sh --free-branch=feature/my-branch"
  echo "  bash scripts/setup-branch.sh --free-branch=feat/x --pro-branch=feat/y"
  exit 0
fi

# ── Resolve project root ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Load .env for plugin paths ────────────────────────────────────────────────
ENV_FILE="${PROJECT_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
  # Export all vars from .env (ignores comments and blank lines)
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
  set +a
fi

# Fall back to defaults from .env.example if not set
PLUGIN_FREE_PATH="${PLUGIN_FREE_PATH:-../wpsp/wp-scheduled-posts}"
PLUGIN_PRO_PATH="${PLUGIN_PRO_PATH:-../wpsp/wp-scheduled-posts-pro}"

# Resolve relative paths against the project directory
cd "$PROJECT_DIR"
if [[ "$PLUGIN_FREE_PATH" != /* ]]; then
  PLUGIN_FREE_PATH="$(cd "$PLUGIN_FREE_PATH" 2>/dev/null && pwd || echo "$PROJECT_DIR/$PLUGIN_FREE_PATH")"
fi
if [[ "$PLUGIN_PRO_PATH" != /* ]]; then
  PLUGIN_PRO_PATH="$(cd "$PLUGIN_PRO_PATH" 2>/dev/null && pwd || echo "$PROJECT_DIR/$PLUGIN_PRO_PATH")"
fi

# ── Helper: checkout a branch in a plugin repo ───────────────────────────────
checkout_branch() {
  local label="$1"   # "free" or "pro"
  local dir="$2"     # absolute path to plugin repo
  local branch="$3"  # branch name to checkout

  if [ ! -d "$dir" ]; then
    echo "❌  $label plugin directory not found: $dir"
    echo "    Set PLUGIN_${label^^}_PATH in your .env to the correct path."
    exit 1
  fi

  if [ ! -d "$dir/.git" ]; then
    echo "❌  $label plugin directory is not a git repository: $dir"
    exit 1
  fi

  echo "🔀  [$label] Fetching from origin..."
  git -C "$dir" fetch origin --quiet

  echo "🔀  [$label] Checking out branch: $branch"
  git -C "$dir" checkout "$branch"

  # Pull latest only if the branch has a remote tracking ref
  if git -C "$dir" rev-parse --abbrev-ref --symbolic-full-name "@{u}" &>/dev/null; then
    git -C "$dir" pull origin "$branch" --quiet
  fi

  local current_branch current_sha
  current_branch="$(git -C "$dir" rev-parse --abbrev-ref HEAD)"
  current_sha="$(git -C "$dir" rev-parse --short HEAD)"
  echo "✅  [$label] Now at branch '$current_branch' ($current_sha)"
}

# ── Checkout requested branches ───────────────────────────────────────────────
if [ -n "$FREE_BRANCH" ]; then
  checkout_branch "free" "$PLUGIN_FREE_PATH" "$FREE_BRANCH"
fi

if [ -n "$PRO_BRANCH" ]; then
  checkout_branch "pro" "$PLUGIN_PRO_PATH" "$PRO_BRANCH"
fi

# ── Restart Docker ────────────────────────────────────────────────────────────
if [ "$SKIP_DOCKER" = false ]; then
  echo ""
  echo "🐳  Resetting Docker environment so WordPress picks up new plugin code..."
  cd "$PROJECT_DIR"
  npm run docker:reset
  echo "✅  Docker environment is ready."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  ✅  Branch setup complete!"
[ -n "$FREE_BRANCH" ] && echo "  Free  : $FREE_BRANCH"
[ -n "$PRO_BRANCH"  ] && echo "  PRO   : $PRO_BRANCH"
if [ "$SKIP_DOCKER" = true ]; then
  echo "  Docker: skipped (run 'npm run docker:reset' when ready)"
fi
echo "======================================================"
