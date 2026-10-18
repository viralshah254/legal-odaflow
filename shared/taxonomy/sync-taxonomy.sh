#!/usr/bin/env bash
# Sync canonical taxonomy from shared/ to backend and web consumers.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/shared/taxonomy"
cp "$SRC/platform-taxonomy.ts" "$ROOT/legal_backend/src/config/taxonomy/platform-taxonomy.ts"
cp "$SRC/coverage-matrix.ts" "$ROOT/legal_backend/src/config/taxonomy/coverage-matrix.ts"
cp "$SRC/platform-taxonomy.ts" "$ROOT/legal_web/lib/taxonomy/platform-taxonomy.ts"
cp "$SRC/coverage-matrix.ts" "$ROOT/legal_web/lib/taxonomy/coverage-matrix.ts"
echo "Synced taxonomy → legal_backend/src/config/taxonomy/ and legal_web/lib/taxonomy/"
