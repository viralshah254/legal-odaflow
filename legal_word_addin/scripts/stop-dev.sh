#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=server-utils.sh
source "$ROOT/scripts/server-utils.sh"
stop_port_3001
echo "Stopped any process on port 3001."
