#!/usr/bin/env bash
# CI gate: fail if production routes import lib/mock (demo tour uses lib/demo only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ALLOWLIST=(
  'lib/mock/'
  'lib/demo/'
)

PATTERN='from "@/lib/mock/|from '\''@/lib/mock/'

if command -v rg >/dev/null 2>&1; then
  matches="$(rg -n "$PATTERN" "$ROOT/app" "$ROOT/components" "$ROOT/lib" 2>/dev/null || true)"
else
  matches="$(grep -RInE "$PATTERN" "$ROOT/app" "$ROOT/components" "$ROOT/lib" 2>/dev/null || true)"
fi

if [ -z "$matches" ]; then
  echo "check-no-mock (web): OK"
  exit 0
fi

violations=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  rel="${file#$ROOT/}"
  allowed=false
  for prefix in "${ALLOWLIST[@]}"; do
    if [[ "$rel" == "$prefix"* ]]; then
      allowed=true
      break
    fi
  done
  if [ "$allowed" = false ]; then
    echo "VIOLATION: $line"
    violations=$((violations + 1))
  fi
done <<< "$matches"

if [ "$violations" -gt 0 ]; then
  echo "check-no-mock (web): $violations violation(s)"
  exit 1
fi

echo "check-no-mock (web): OK (only allowlisted paths)"
exit 0
