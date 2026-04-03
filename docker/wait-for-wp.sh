#!/bin/bash
# wait-for-wp.sh — Polls WordPress until the HTTP server responds (any non-000 status).
# HTTP 000 means the port is not yet bound; anything else means the container is up.
# wp-setup.sh handles the actual WordPress installation after this script exits.
#
# Usage: ./docker/wait-for-wp.sh [url] [max_attempts]

WP_URL="${1:-http://localhost:8080}"
MAX_ATTEMPTS="${2:-60}"
SLEEP_INTERVAL=5

echo "⏳ Waiting for WordPress container at ${WP_URL} ..."

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${WP_URL}/wp-login.php" 2>/dev/null)
  if [ "${STATUS}" != "000" ] && [ -n "${STATUS}" ]; then
    echo "✅ WordPress container is up! HTTP ${STATUS} (attempt ${i}/${MAX_ATTEMPTS})"
    exit 0
  fi
  echo "  Attempt ${i}/${MAX_ATTEMPTS}: HTTP ${STATUS} — port not ready, retrying in ${SLEEP_INTERVAL}s..."
  sleep "${SLEEP_INTERVAL}"
done

echo "❌ WordPress container did not respond after $((MAX_ATTEMPTS * SLEEP_INTERVAL))s. Aborting."
exit 1
