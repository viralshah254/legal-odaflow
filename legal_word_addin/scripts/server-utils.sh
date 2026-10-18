#!/usr/bin/env bash
# Shared helpers for the Word add-in HTTPS server on port 3001.
set -euo pipefail

TASKPANE_URL_PATH="/src/taskpane/index.html"

is_server_up() {
  curl -k -s -o /dev/null -w '' "https://localhost:3001${TASKPANE_URL_PATH}" 2>/dev/null \
    || curl -k -s -o /dev/null -w '' "https://localhost:3001${TASKPANE_URL_PATH}" 2>/dev/null
}

port_in_use() {
  lsof -ti :3001 >/dev/null 2>&1
}

stop_port_3001() {
  if port_in_use; then
    echo "Stopping process on port 3001..."
    lsof -ti :3001 | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}
