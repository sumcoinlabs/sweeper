#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    return 1
  fi
}

echo "== Sweeper M1 setup =="

echo "Checking tools..."
need xcodebuild || { echo "Install Xcode from Apple, launch it once, then run: sudo xcodebuild -license accept"; exit 1; }
need node || { echo "Install Node 22+ with Homebrew: brew install node@22"; exit 1; }
need npm || exit 1
need python3 || exit 1

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
NODE_MINOR="$(node -p "Number(process.versions.node.split('.')[1])")"
if (( NODE_MAJOR < 22 )) || (( NODE_MAJOR == 22 && NODE_MINOR < 13 )); then
  echo "React Native 0.87 requires Node >= 22.13.0. Current: $(node -v)"
  echo "Recommended on Apple Silicon: brew install node@22"
  exit 1
fi

if [[ -d mobile ]]; then
  echo "mobile/ already exists. Refusing to overwrite it."
  echo "Delete/rename mobile/ if you want a clean bootstrap."
  exit 1
fi

echo "Creating React Native 0.87 project..."
npx @react-native-community/cli@latest init SweeperMobile --version 0.87.0
mv SweeperMobile mobile

echo "Installing native MVP dependencies..."
cd mobile
npm install \
  @react-native-community/geolocation@3.4.0 \
  @inoxialabs/react-native-nitro-location-geocoder@1.2.0 \
  react-native-ble-plx@3.5.1 \
  react-native-network-info@5.2.2 \
  react-native-tcp-socket@6.4.2 \
  react-native-vision-camera@5.2.3 \
  react-native-nitro-modules@0.37.0 \
  react-native-nitro-image@0.15.2

rm -rf src
cp -R "$ROOT/mobile-overlay/src" ./src
cp "$ROOT/mobile-overlay/App.tsx" ./App.tsx
cd "$ROOT"

"$ROOT/scripts/patch-native.sh"

echo "Installing iOS pods..."
cd mobile/ios
if command -v bundle >/dev/null 2>&1; then
  bundle install
  bundle exec pod install
elif command -v pod >/dev/null 2>&1; then
  pod install
else
  echo "CocoaPods/Bundler not found. Install with Homebrew Ruby/CocoaPods, then run:"
  echo "  cd mobile/ios && bundle install && bundle exec pod install"
fi
cd "$ROOT"

echo "Preparing backend..."
cp -n backend/.env.example backend/.env || true
cd backend
npm install
cd "$ROOT"

if command -v docker >/dev/null 2>&1; then
  docker compose up -d postgres
else
  echo "Docker not found. Install Docker Desktop/OrbStack or point DATABASE_URL at an existing PostgreSQL server."
fi

echo
echo "Setup complete."
echo "Run: ./scripts/dev.sh"
echo "Then in another terminal: cd mobile && npm run ios"
echo "For a physical iPhone, edit mobile/src/config.ts and replace 127.0.0.1 with this Mac's LAN IP."
