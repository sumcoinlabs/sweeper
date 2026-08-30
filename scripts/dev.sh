#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v docker >/dev/null 2>&1; then
  (cd "$ROOT" && docker compose up -d postgres)
fi

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$ROOT/backend" && npm run dev) &
BACKEND_PID=$!
(cd "$ROOT/mobile" && npm start) &
METRO_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Metro PID: $METRO_PID"
echo "Open another terminal and run: cd '$ROOT/mobile' && npm run ios"
wait
