#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/mobile"
BACKEND="$ROOT/backend"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    return 1
  fi
}

echo "== Sweeper development setup =="

echo "Checking tools..."
need xcodebuild || {
  echo "Install Xcode, launch it once, and select/accept the required components."
  exit 1
}
need node || {
  echo "Install Node 22+ (for example with Homebrew)."
  exit 1
}
need npm || exit 1
need python3 || exit 1

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 22 )); then
  echo "Sweeper's React Native 0.87 baseline requires Node 22+. Current: $(node -v)"
  exit 1
fi

if [[ ! -f "$MOBILE/package.json" || ! -f "$BACKEND/package.json" ]]; then
  echo "Expected tracked Sweeper mobile/backend projects were not found under:"
  echo "  $ROOT"
  echo "Use a complete clone of sumcoinlabs/sweeper; do not recreate mobile/ with a new RN scaffold."
  exit 1
fi

echo "Installing mobile dependencies from the lock file..."
(cd "$MOBILE" && npm ci)

echo "Installing backend dependencies from the lock file..."
(cd "$BACKEND" && npm ci)

if [[ -d "$MOBILE/ios" ]]; then
  echo "Installing iOS pods..."
  if command -v bundle >/dev/null 2>&1; then
    (cd "$MOBILE" && bundle install)
    (cd "$MOBILE/ios" && BUNDLE_GEMFILE="$MOBILE/Gemfile" bundle exec pod install)
  elif command -v pod >/dev/null 2>&1; then
    (cd "$MOBILE/ios" && pod install)
  else
    echo "CocoaPods/Bundler not found. Mobile JS dependencies are installed."
    echo "Before an iOS native build, install the Ruby/CocoaPods toolchain and run:"
    echo "  cd '$MOBILE/ios' && bundle install && bundle exec pod install"
  fi
fi

cp -n "$BACKEND/.env.example" "$BACKEND/.env" || true

if command -v docker >/dev/null 2>&1; then
  echo "Starting PostgreSQL development service..."
  (cd "$ROOT" && docker compose up -d postgres)
else
  echo "Docker not found. Point DATABASE_URL at PostgreSQL or install Docker Desktop/OrbStack."
fi

echo
echo "Setup complete."
echo "Start backend + Metro with: ./scripts/dev.sh"
echo "Then launch the native target from Xcode/Android Studio or the React Native CLI."
