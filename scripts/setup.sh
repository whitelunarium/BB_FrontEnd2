#!/bin/bash
# scripts/setup.sh
# Run this once to set up your local Beasts_FrontEnd Jekyll development environment.
# Usage: cd /Users/samarthvaka/Beasts_FrontEnd && bash scripts/setup.sh

set -e

echo "=== Beasts_FrontEnd Setup ==="
cd "$(dirname "$0")/.."

# ── 1. Check Ruby ────────────────────────────────────────────────────────────
echo ""
echo "[1/3] Checking Ruby version..."
ruby --version

# ── 2. Bundle install ────────────────────────────────────────────────────────
echo ""
echo "[2/3] Installing Ruby gems (Jekyll + plugins)..."
bundle config set --local path 'vendor/bundle'
bundle install
echo "      Gems installed."

# ── 3. Verify Jekyll build ───────────────────────────────────────────────────
echo ""
echo "[3/3] Running Jekyll build check..."
bundle exec jekyll build --quiet
echo "      Build succeeded. Site in _site/"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start the local dev server:"
echo "  bundle exec jekyll serve --livereload --port 4000"
echo ""
echo "Site will be at http://localhost:4000"
