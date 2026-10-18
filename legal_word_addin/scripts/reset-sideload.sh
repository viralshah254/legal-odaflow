#!/usr/bin/env bash
# Reset Mac Word sideload cache and re-register the dev manifest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WEF_DIR="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
WEF_CACHE="$HOME/Library/Containers/com.microsoft.Word/Data/Library/Application Support/Microsoft/Office/16.0/Wef"
MANIFEST="$ROOT/manifest.dev.xml"

if pgrep -xq "Microsoft Word"; then
  echo "ERROR: Quit Microsoft Word first (Cmd+Q), then run sideload:reset again."
  exit 1
fi

echo "Stopping prior debug session (if any)..."
npx office-addin-debugging stop "$MANIFEST" desktop 2>/dev/null || true

echo "Unregistering add-in..."
npx office-addin-dev-settings unregister "$MANIFEST" 2>/dev/null || true

if [ -d "$WEF_DIR" ]; then
  echo "Clearing Word sideload folder: $WEF_DIR"
  rm -f "$WEF_DIR"/*
fi

if [ -d "$WEF_CACHE" ]; then
  echo "Clearing Word Office cache: $WEF_CACHE"
  rm -rf "$WEF_CACHE"/*
fi

echo "Done. Next:"
echo "  Terminal 1: npm run dev"
echo "  Terminal 2: npm run sideload"
