#!/usr/bin/env bash
# Install manifest and open Word (avoid broken auto-sideload docx on recent Mac Word).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=server-utils.sh
source "$ROOT/scripts/server-utils.sh"

if pgrep -xq "Microsoft Word"; then
  echo "ERROR: Quit Microsoft Word first (Cmd+Q), then run sideload again."
  exit 1
fi

if ! is_server_up; then
  echo "ERROR: Add-in server is not running on port 3001."
  echo ""
  echo "In a separate terminal, run:"
  echo "  npm run dev"
  echo ""
  echo "If you see 'port already in use', run:"
  echo "  npm run dev:stop"
  echo "  npm run dev"
  exit 1
fi

bash "$ROOT/scripts/install-dev-manifest.sh"

echo "Opening Word..."
open -a "Microsoft Word"

cat <<'EOF'

Manifest installed.

In Word:
  1. Open any blank document (not the old "Word add-in ..." file).
  2. Go to Home → Add-ins (or Insert → Add-ins → My Add-ins).
  3. Choose "Umbrella Legal AI (Dev)".

Safari test:
  https://localhost:3001/src/taskpane/index.html
EOF
