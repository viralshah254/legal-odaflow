#!/usr/bin/env bash
# Install manifest copies and bump version so Word reloads cached add-in.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/manifest.dev.xml"
WEF_DIR="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
WEF_CACHE="$HOME/Library/Containers/com.microsoft.Word/Data/Library/Application Support/Microsoft/Office/16.0/Wef"

mkdir -p "$WEF_DIR"
cp -f "$MANIFEST" "$WEF_DIR/manifest.dev.xml"
cp -f "$MANIFEST" "$WEF_DIR/a1b2c3d4-e5f6-7890-abcd-ef1234567890.manifest.dev.xml"
xattr -c "$WEF_DIR"/*.xml 2>/dev/null || true

if [ -d "$WEF_CACHE" ]; then
  find "$WEF_CACHE" -name 'a1b2c3d4-e5f6-7890-abcd-ef1234567890*' -delete 2>/dev/null || true
fi

echo "Installed manifest copies:"
ls -la "$WEF_DIR"/*.xml
