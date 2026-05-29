#!/usr/bin/env bash
# CI gate: fail if new mock/stub markers appear outside the allowlist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"

ALLOWLIST=(
  'src/ai/ai-gateway.service.ts'
  'src/jobs/workers/ocr.worker.ts'
  'src/payments/razorpay.service.ts'
  'src/payments/stripe.service.ts'
  'src/payments/payments.service.ts'
  'src/health/health.service.ts'
)

PATTERN='generateMock|mock-|_mock|Mock preview|mock responses|checkout\.razorpay\.com/mock|\[OCR stub\]'

if command -v rg >/dev/null 2>&1; then
  matches="$(rg -n "$PATTERN" "$SRC" || true)"
else
  matches="$(grep -RInE "$PATTERN" "$SRC" || true)"
fi

if [ -z "$matches" ]; then
  echo "check-no-mock: OK (no matches)"
  exit 0
fi

violations=0
while IFS= read -r line; do
  file="${line%%:*}"
  rel="${file#"$ROOT/"}"
  allowed=false
  for entry in "${ALLOWLIST[@]}"; do
    if [ "$rel" = "$entry" ]; then
      allowed=true
      break
    fi
  done
  if [ "$allowed" = false ]; then
    echo "DISALLOWED: $line"
    violations=$((violations + 1))
  fi
done <<< "$matches"

if [ "$violations" -gt 0 ]; then
  echo "check-no-mock: failed with $violations violation(s). Add to allowlist only for intentional dev stubs."
  exit 1
fi

echo "check-no-mock: OK (matches only in allowlist)"
exit 0
