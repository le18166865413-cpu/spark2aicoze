#!/bin/bash
# Sub-site setup script
# Run this on a new Coze project to clone the main site code

set -e

REPO_URL="$1"
SITE_ID="$2"
SITE_NAME="$3"

if [ -z "$REPO_URL" ] || [ -z "$SITE_ID" ]; then
  echo "Usage: bash scripts/setup-sub-site.sh <github-repo-url> <site-id> [site-name]"
  echo ""
  echo "Example:"
  echo "  bash scripts/setup-sub-site.sh https://github.com/user/spark2ai.git site-01"
  echo ""
  exit 1
fi

WORK_DIR="${COZE_WORKSPACE_PATH:-/workspace/projects}"
cd "$WORK_DIR"

echo "========================================"
echo "  Spark2AI Sub-site Setup"
echo "========================================"
echo ""
echo "Repository: $REPO_URL"
echo "Site ID:    $SITE_ID"
echo "Site Name:  ${SITE_NAME:-$SITE_ID}"
echo ""

# Initialize git and clone
if [ -d ".git" ]; then
  echo "Git repository already exists. Updating remote..."
  git remote set-url origin "$REPO_URL"
else
  echo "Initializing git repository..."
  git init
  git remote add origin "$REPO_URL"
fi

echo "Pulling code from main branch..."
git pull origin main

echo ""
echo "Installing dependencies..."
pnpm install

echo ""
echo "========================================"
echo "  Setup completed!"
echo ""
echo "Next steps:"
echo "  1. Configure environment variables in Coze console:"
echo "     SITE_ID=$SITE_ID"
echo "     SITE_TYPE=sub"
echo "     MAIN_SITE_URL=<your-main-site-url>"
echo ""
echo "  2. Ensure Supabase credentials are configured"
echo ""
echo "  3. Build and start the service:"
echo "     pnpm build"
echo "     pnpm start"
echo ""
echo "  4. (Optional) Add site_id column for data isolation:"
echo "     ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS site_id TEXT DEFAULT 'main';"
echo ""
echo "  5. To sync updates later, run:"
echo "     bash scripts/sync-sub-site.sh"
echo "========================================"
