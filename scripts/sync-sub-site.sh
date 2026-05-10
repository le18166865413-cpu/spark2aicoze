#!/bin/bash
# Sub-site auto-sync script
# Usage: bash scripts/sync-sub-site.sh
# This script pulls the latest code from the main GitHub repository

set -e

REPO_URL="${1:-$(git remote get-url origin 2>/dev/null || echo "")}"
BRANCH="${2:-main}"
WORK_DIR="${COZE_WORKSPACE_PATH:-/workspace/projects}"

echo "========================================"
echo "  Spark2AI Sub-site Auto Sync"
echo "========================================"
echo ""

if [ -z "$REPO_URL" ]; then
  echo "Error: GitHub repository URL not configured."
  echo "Please set it first:"
  echo "  git remote add origin https://github.com/username/repo.git"
  exit 1
fi

cd "$WORK_DIR"

# Check if it's a git repo
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
  git remote add origin "$REPO_URL"
fi

echo "Current Git remote: $(git remote get-url origin 2>/dev/null || echo 'none')"
echo "Current branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'none')"
echo ""

# Fetch latest changes
echo "Fetching latest code from origin/$BRANCH..."
git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "none")
REMOTE=$(git rev-parse origin/$BRANCH 2>/dev/null || echo "none")

echo "Local commit:  ${LOCAL:0:8}"
echo "Remote commit: ${REMOTE:0:8}"
echo ""

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "Already up to date. No sync needed."
  exit 0
fi

echo "New version detected! Starting sync..."
echo ""

# Stash any local changes
echo "Stashing local changes..."
git stash push -m "auto-sync-$(date +%s)"

# Pull latest code
echo "Pulling latest code..."
git pull origin "$BRANCH" --no-rebase

echo ""
echo "Installing dependencies..."
pnpm install

echo ""
echo "Building project..."
pnpm build

echo ""
echo "========================================"
echo "  Sync completed successfully!"
echo "  New version: $(git rev-parse --short HEAD)"
echo "  Updated at:  $(date)"
echo "========================================"
