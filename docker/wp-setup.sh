#!/bin/bash
set -e

WP_PATH="/var/www/html"
WP_URL="http://localhost:8080"
WP_TITLE="SchedulePress E2E"
WP_ADMIN_USER="admin"
WP_ADMIN_PASS="admin"
WP_ADMIN_EMAIL="admin@example.com"

echo "⏳ Waiting for WordPress files to be available..."
until [ -f "${WP_PATH}/wp-includes/version.php" ]; do
  echo "  WordPress files not ready yet, waiting 3s..."
  sleep 3
done
echo "✅ WordPress files found."

echo "⏳ Waiting for MySQL to accept connections..."
DB_HOST="${WORDPRESS_DB_HOST%%:*}"
until php -r "
  \$c = @mysqli_connect('${DB_HOST}', '${WORDPRESS_DB_USER}', '${WORDPRESS_DB_PASSWORD}', '${WORDPRESS_DB_NAME}');
  if (\$c) { mysqli_close(\$c); exit(0); }
  exit(1);
" 2>/dev/null; do
  echo "  Database not ready yet, waiting 3s..."
  sleep 3
done
echo "✅ Database is ready."

# ── Create wp-config.php if it doesn't exist (WordPress image may not have created it yet) ──
if [ ! -f "${WP_PATH}/wp-config.php" ]; then
  echo "⚙️  Creating wp-config.php..."
  wp config create \
    --dbname="${WORDPRESS_DB_NAME}" \
    --dbuser="${WORDPRESS_DB_USER}" \
    --dbpass="${WORDPRESS_DB_PASSWORD}" \
    --dbhost="${WORDPRESS_DB_HOST}" \
    --path="${WP_PATH}" \
    --allow-root \
    --force
  echo "✅ wp-config.php created."
else
  echo "✅ wp-config.php already exists."
fi

# ── Install WordPress if not already installed ──────────────────────────────
if wp core is-installed --path="${WP_PATH}" --allow-root 2>/dev/null; then
  echo "✅ WordPress is already installed, skipping core install."
else
  echo "🚀 Installing WordPress core..."
  wp core install \
    --path="${WP_PATH}" \
    --url="${WP_URL}" \
    --title="${WP_TITLE}" \
    --admin_user="${WP_ADMIN_USER}" \
    --admin_password="${WP_ADMIN_PASS}" \
    --admin_email="${WP_ADMIN_EMAIL}" \
    --skip-email \
    --allow-root
  echo "✅ WordPress installed."
fi

# ── Update siteurl / home in case the container restarted ───────────────────
wp option update siteurl "${WP_URL}" --path="${WP_PATH}" --allow-root
wp option update home    "${WP_URL}" --path="${WP_PATH}" --allow-root

# ── Activate plugins ─────────────────────────────────────────────────────────

# Free plugin: use volume-mounted source if present, otherwise install from WordPress.org
FREE_PLUGIN_DIR="${WP_PATH}/wp-content/plugins/wp-scheduled-posts"
if [ -d "${FREE_PLUGIN_DIR}" ] && [ -n "$(ls -A "${FREE_PLUGIN_DIR}" 2>/dev/null)" ]; then
  echo "🔌 Activating SchedulePress (free) from mounted source..."
  wp plugin activate wp-scheduled-posts --path="${WP_PATH}" --allow-root
  echo "✅ wp-scheduled-posts activated (from source)."
else
  echo "📦 Installing SchedulePress (free) from WordPress.org..."
  wp plugin install wp-scheduled-posts --activate --path="${WP_PATH}" --allow-root
  echo "✅ wp-scheduled-posts installed and activated (from WordPress.org)."
fi

# PRO plugin: activate only if folder is present and non-empty (never auto-install PRO)
PRO_PLUGIN_DIR="${WP_PATH}/wp-content/plugins/wp-scheduled-posts-pro"
if [ -d "${PRO_PLUGIN_DIR}" ] && [ -n "$(ls -A "${PRO_PLUGIN_DIR}" 2>/dev/null)" ]; then
  echo "🔌 Activating SchedulePress PRO..."
  wp plugin activate wp-scheduled-posts-pro --path="${WP_PATH}" --allow-root
  echo "✅ wp-scheduled-posts-pro activated."
else
  echo "ℹ️  wp-scheduled-posts-pro not found — running in free-only mode."
fi

# ── Permalink structure (post_name required for pretty URLs) ─────────────────
echo "🔗 Setting permalink structure..."
wp rewrite structure '/%postname%/' --path="${WP_PATH}" --allow-root
wp rewrite flush --hard --path="${WP_PATH}" --allow-root

# ── Disable email notifications (avoids test noise) ─────────────────────────
wp option update admin_email_lifespan 999999999 --path="${WP_PATH}" --allow-root

# ── Disable Gutenberg Welcome Guide for all existing users ───────────────────
# Sets the `welcomeGuide` user-meta to false so the modal never appears in tests.
echo "🚫 Disabling Gutenberg Welcome Guide for all users..."
wp user list --field=ID --path="${WP_PATH}" --allow-root | while read -r uid; do
  wp user meta update "$uid" welcomeGuide false --path="${WP_PATH}" --allow-root 2>/dev/null || true
done

# ── Create a test author user ─────────────────────────────────────────────────
if wp user get testauthor --path="${WP_PATH}" --allow-root 2>/dev/null; then
  echo "ℹ️  testauthor already exists."
else
  wp user create testauthor testauthor@example.com \
    --role=author \
    --user_pass=testauthor123 \
    --path="${WP_PATH}" \
    --allow-root
  echo "✅ testauthor user created."
fi

# ── Disable wp-cron (we'll trigger it manually in tests) ────────────────────
echo "⚙️  Configuring wp-config for manual cron..."
if ! wp config get DISABLE_WP_CRON --path="${WP_PATH}" --allow-root 2>/dev/null | grep -q "true"; then
  wp config set DISABLE_WP_CRON true --raw --path="${WP_PATH}" --allow-root 2>/dev/null || true
fi

echo ""
echo "======================================================"
echo "  ✅  WordPress setup complete!"
echo "  URL    : ${WP_URL}"
echo "  User   : ${WP_ADMIN_USER}"
echo "  Pass   : ${WP_ADMIN_PASS}"
echo "======================================================"
