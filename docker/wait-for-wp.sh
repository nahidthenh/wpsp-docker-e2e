#!/bin/bash
# wait-for-wp.sh — Polls the WordPress login page until it returns HTTP 200.
# Usage: ./docker/wait-for-wp.sh [url] [max_attempts]

WP_URL="${1:-http://localhost:8080}"
MAX_ATTEMPTS="${2:-60}"
SLEEP_INTERVAL=5

echo "⏳ Waiting for WordPress at ${WP_URL} ..."

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${WP_URL}/wp-login.php" 2>/dev/null)
  if [ "${STATUS}" = "200" ]; then
    echo "✅ WordPress is ready! (attempt ${i}/${MAX_ATTEMPTS})"
    exit 0
  fi
  echo "  Attempt ${i}/${MAX_ATTEMPTS}: HTTP ${STATUS} — retrying in ${SLEEP_INTERVAL}s..."
  sleep "${SLEEP_INTERVAL}"
done

echo "❌ WordPress did not become ready after $((MAX_ATTEMPTS * SLEEP_INTERVAL))s. Aborting."
exit 1
