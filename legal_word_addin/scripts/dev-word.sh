#!/usr/bin/env bash
# Serve bundled add-in over HTTPS (Word WebView cannot use Vite dev server).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=server-utils.sh
source "$ROOT/scripts/server-utils.sh"

if is_server_up; then
  echo "Add-in server is already running on port 3001."
  echo "Open https://localhost:3001/src/taskpane/index.html in Safari to verify."
  exit 0
fi

if port_in_use; then
  echo "Port 3001 is in use but not responding — clearing it..."
  stop_port_3001
fi

echo "Building add-in..."
npm run build

echo "Starting HTTPS preview on https://localhost:3001 (rebuilds on file changes)..."
vite build --watch &
WATCH_PID=$!
trap 'kill $WATCH_PID 2>/dev/null || true' EXIT INT TERM

vite preview --port 3001 --strictPort --host localhost
